# ============================================================================
# services/whatif_service.py
# ============================================================================
# The signature SimuCast feature. Takes a trained model + user-chosen input
# values and returns a prediction, plus a sensitivity analysis showing
# which features matter most.
# ============================================================================

import json
import numpy as np
import pandas as pd

from database import db
from models import Step
from services import model_service


# ============================================================================
# Helpers
# ============================================================================

def _build_input_row(bundle, inputs):
    """
    Convert user-submitted inputs dict into a properly-shaped input for the model.

    The model expects the ENCODED features (with one-hot applied) in a specific
    column order. The user sends ORIGINAL feature values. We have to:
      1. Validate the user provided every original feature
      2. Apply one-hot encoding the same way training did
      3. Arrange columns in the exact order the model expects

    `inputs` example:  { "age": 35, "income": 50000, "gender": "Male" }
    Returns: numpy array shape (1, n_encoded_features) ready for model.predict()
    """
    # Start with a DataFrame of one row, original columns only
    original_features = bundle["features_original"]
    missing = [f for f in original_features if f not in inputs]
    if missing:
        raise ValueError(f"Missing inputs for: {', '.join(missing)}")

    # Single-row DataFrame. Dict-of-scalars needs index=[0] to work.
    raw = pd.DataFrame([{f: inputs[f] for f in original_features}])

    # One-hot encode the categoricals
    # The same drop_first=True as training, using the same columns
    encoded = pd.get_dummies(raw, columns=bundle["categorical_cols"], drop_first=True)

    # After encoding, our DataFrame might be missing some dummy columns
    # (e.g. if the training data had gender in ["Male","Female","Other"] and
    # the user picks "Male", we won't have a gender_Other column here).
    # We need to add missing columns (as zeros) and match the training column order.
    for col in bundle["features_encoded"]:
        if col not in encoded.columns:
            encoded[col] = 0

    # Subset to exactly the training columns, in the training order
    encoded = encoded[bundle["features_encoded"]]

    # Apply the scaler if one was used
    # Trees use scaler=None; linear/logistic regression have a fitted scaler
    X = encoded.values
    if bundle["scaler"] is not None:
        X = bundle["scaler"].transform(X)

    return X


def _format_prediction(bundle, raw_prediction, model_obj):
    """Turn a raw model output into a user-friendly response."""
    target_type = bundle["target_type"]

    if target_type == "continuous":
        return {
            "target_type": "continuous",
            "value": round(float(raw_prediction[0]), 4),
        }

    elif target_type == "binary":
        # Also return probability of the positive class
        proba = None
        if hasattr(model_obj, "predict_proba"):
            probs = model_obj.predict_proba(_prediction_input_for_proba(bundle, raw_prediction))
            # probs is shape (1, 2); take the positive class probability
            proba = round(float(probs[0][1]), 4)
        return {
            "target_type": "binary",
            "value": str(raw_prediction[0]),
            "class_labels": [str(c) for c in model_obj.classes_],
            "probability": proba,
        }

    else:  # multiclass
        return {
            "target_type": "multiclass",
            "value": str(raw_prediction[0]),
            "class_labels": [str(c) for c in model_obj.classes_],
        }


def _prediction_input_for_proba(bundle, raw_prediction):
    """Quick stub to silence the linter — we don't actually re-scale here.
    The real probability lookup happens in predict() below where we have X."""
    # Unused — we compute probabilities inline in predict() now
    return None


# ============================================================================
# Main API
# ============================================================================

def predict(step_id, inputs):
    """
    Run a single prediction with user-provided input values.

    Returns:
        {
            "prediction": {...},
            "inputs_used": {...},  # echo back for the frontend to display
        }
    """
    step, details, bundle = model_service.load_model_bundle(step_id)

    # Build the input row (applies encoding + scaling)
    X = _build_input_row(bundle, inputs)

    model = bundle["model"]
    y_pred = model.predict(X)

    target_type = bundle["target_type"]

    if target_type == "continuous":
        prediction = {
            "target_type": "continuous",
            "value": round(float(y_pred[0]), 4),
        }
    else:
        # Classification — also return class probabilities
        result = {
            "target_type": target_type,
            "value": str(y_pred[0]),
            "class_labels": [str(c) for c in model.classes_],
        }
        if hasattr(model, "predict_proba"):
            probs = model.predict_proba(X)[0]
            result["probabilities"] = [round(float(p), 4) for p in probs]
            # For binary, also expose the "positive class" probability as a single number
            if target_type == "binary":
                result["probability"] = result["probabilities"][-1]
        prediction = result

    return {
        "prediction": prediction,
        "inputs_used": inputs,
        "target": details.get("target"),
    }


# ============================================================================
# Sensitivity analysis
# ============================================================================

def sensitivity(step_id, base_inputs):
    """
    How much does each feature move the prediction?

    Strategy for numeric features:
      - Compute prediction at base_inputs (baseline)
      - For each numeric feature F:
          Vary F by ±1 standard deviation (from training data)
          Measure how much the prediction changes
      - Magnitude of that change = "sensitivity" for that feature

    Strategy for categorical features:
      - Try every other category value, measure max prediction change

    Returns a list sorted by impact (biggest first), so the UI can show
    the horizontal-bar "which levers matter" chart.
    """
    step, details, bundle = model_service.load_model_bundle(step_id)
    model = bundle["model"]

    # --- Baseline prediction ---
    X_base = _build_input_row(bundle, base_inputs)
    baseline_raw = model.predict(X_base)

    # For classification, we use probability if available; for regression, use value
    def extract_scalar(raw, X_input):
        if bundle["target_type"] == "continuous":
            return float(raw[0])
        # classification — use positive-class probability (binary) or class index (multi)
        if hasattr(model, "predict_proba"):
            probs = model.predict_proba(X_input)[0]
            # Sum of probabilities weighted by class index — a scalar summary
            # For binary this is just the positive class probability.
            return float(probs[-1])
        # Fallback: treat class label numerically if possible
        try:
            return float(raw[0])
        except (ValueError, TypeError):
            return 0.0

    baseline_scalar = extract_scalar(baseline_raw, X_base)

    sensitivities = []

    for feature in bundle["features_original"]:
        stats = bundle["feature_stats"][feature]

        if stats["type"] == "numeric":
            # Perturb by ±1 SD (or min/max if SD is zero)
            step_size = stats["std"] if stats["std"] > 0 else max(1, stats["max"] - stats["min"])

            inputs_plus = {**base_inputs, feature: stats["mean"] + step_size}
            inputs_minus = {**base_inputs, feature: stats["mean"] - step_size}

            X_plus = _build_input_row(bundle, inputs_plus)
            X_minus = _build_input_row(bundle, inputs_minus)

            plus_scalar = extract_scalar(model.predict(X_plus), X_plus)
            minus_scalar = extract_scalar(model.predict(X_minus), X_minus)

            # Impact = half the total range across the ±1 SD perturbation
            impact = abs(plus_scalar - minus_scalar) / 2

        else:
            # Categorical — try each value, pick the biggest deviation from baseline
            max_impact = 0.0
            for value in stats["values"]:
                if value == base_inputs.get(feature):
                    continue
                test_inputs = {**base_inputs, feature: value}
                X_test = _build_input_row(bundle, test_inputs)
                test_scalar = extract_scalar(model.predict(X_test), X_test)
                max_impact = max(max_impact, abs(test_scalar - baseline_scalar))
            impact = max_impact

        sensitivities.append({
            "feature": feature,
            "impact": round(float(impact), 4),
            "type": stats["type"],
        })

    # Sort biggest first
    sensitivities.sort(key=lambda x: x["impact"], reverse=True)

    return {
        "baseline_prediction": baseline_scalar,
        "sensitivities": sensitivities,
    }


# ============================================================================
# Scenarios — save named input combinations for comparison
# ============================================================================

def save_scenario(project, model_step_id, name, inputs, prediction):
    """Store a named scenario as a Step. Returns the created step."""
    model_step = Step.query.get(model_step_id)
    if not model_step or model_step.project_id != project.id:
        raise ValueError("Model not found")

    next_order = len(project.steps)
    step = Step(
        project_id=project.id,
        step_type="scenario",
        title=f"Scenario: {name}",
        order_index=next_order,
        details=json.dumps({
            "model_step_id": model_step_id,
            "name": name,
            "inputs": inputs,
            "prediction": prediction,
        }),
    )
    db.session.add(step)
    db.session.commit()

    return {
        "id": step.id,
        "name": name,
        "inputs": inputs,
        "prediction": prediction,
        "created_at": step.created_at.isoformat(),
    }


def list_scenarios(project, model_step_id):
    """Return all saved scenarios for a given model, newest first."""
    steps = Step.query.filter_by(
        project_id=project.id,
        step_type="scenario",
        reverted=False,
    ).order_by(Step.order_index.desc()).all()

    scenarios = []
    for s in steps:
        details = json.loads(s.details)
        if details.get("model_step_id") == model_step_id:
            scenarios.append({
                "id": s.id,
                "name": details.get("name"),
                "inputs": details.get("inputs"),
                "prediction": details.get("prediction"),
                "created_at": s.created_at.isoformat(),
            })
    return scenarios


def delete_scenario(project, scenario_step_id):
    """Delete a saved scenario."""
    step = Step.query.get(scenario_step_id)
    if not step or step.project_id != project.id or step.step_type != "scenario":
        raise ValueError("Scenario not found")
    db.session.delete(step)
    db.session.commit()
