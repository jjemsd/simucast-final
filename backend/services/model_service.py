# ============================================================================
# services/model_service.py
# ============================================================================
# Train predictive models (linear regression, logistic regression, decision tree).
#
# How this fits with the rest of SimuCast:
#   - Models DON'T modify data, so we don't create new Dataset rows
#   - Each trained model is stored as:
#       1. A pickle file on disk (uploads/model_{uuid}.pkl)
#       2. A Step row with step_type="model_trained" whose details JSON holds
#          everything What-If needs to rebuild input forms and make predictions
#   - The What-If module reads those Step rows to list available models
#
# Why pickle? sklearn models have custom classes — pickle serializes them
# faithfully. For production we'd use joblib (slightly faster for numpy arrays)
# but pickle is stdlib and good enough for student-size data.
# ============================================================================

import os
import json
import uuid
import pickle

import numpy as np
import pandas as pd

from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.tree import DecisionTreeRegressor, DecisionTreeClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    r2_score, mean_squared_error, mean_absolute_error,
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, roc_auc_score,
)
from flask import current_app

from database import db
from models import Step
from services import data_service


# ============================================================================
# Core helpers
# ============================================================================

def _prepare_data(df, target, features):
    """
    Turn raw features into what sklearn wants. Handles:
      - Dropping rows with NaN in target or features
      - One-hot encoding categorical features (so models handle text values)
      - Detecting numeric vs categorical columns
      - Capturing stats for the What-If slider defaults

    Returns a dict packed with everything needed for training AND prediction.
    """
    # Validate
    if target not in df.columns:
        raise ValueError(f"Target column '{target}' not found")
    for f in features:
        if f not in df.columns:
            raise ValueError(f"Feature '{f}' not found")
    if target in features:
        raise ValueError("Target column cannot also be a feature")

    # Drop rows with NaN in target or any feature
    needed = [target] + features
    clean = df[needed].dropna()
    if len(clean) < 20:
        raise ValueError(f"Only {len(clean)} complete rows — need at least 20 to train")

    # Split numeric vs categorical
    numeric_cols = [c for c in features if pd.api.types.is_numeric_dtype(clean[c])]
    categorical_cols = [c for c in features if c not in numeric_cols]

    # Capture stats for What-If sliders (before one-hot encoding!)
    # The UI uses these to build sliders with sensible min/max/default values.
    feature_stats = {}
    for col in numeric_cols:
        feature_stats[col] = {
            "type": "numeric",
            "mean": float(clean[col].mean()),
            "std": float(clean[col].std()),
            "min": float(clean[col].min()),
            "max": float(clean[col].max()),
        }
    for col in categorical_cols:
        feature_stats[col] = {
            "type": "categorical",
            "values": sorted(clean[col].unique().tolist()),
        }

    # One-hot encode categorical features
    # get_dummies turns ["red","blue","red"] into two columns ["color_red","color_blue"]
    # drop_first=True drops one level per category to avoid perfect collinearity
    # (the "dummy variable trap" that breaks linear/logistic models)
    X_encoded = pd.get_dummies(
        clean[features],
        columns=categorical_cols,
        drop_first=True,
    )
    encoded_columns = list(X_encoded.columns)

    y = clean[target]

    # Detect target type (tells us whether to use regression or classification)
    if pd.api.types.is_numeric_dtype(y) and y.nunique() > 10:
        target_type = "continuous"
    elif y.nunique() == 2:
        target_type = "binary"
    else:
        target_type = "multiclass"

    return {
        "X": X_encoded,
        "y": y,
        "feature_stats": feature_stats,
        "numeric_cols": numeric_cols,
        "categorical_cols": categorical_cols,
        "features_encoded": encoded_columns,
        "features_original": features,
        "target_type": target_type,
        "n_rows_used": len(clean),
    }


def _save_model(project, dataset, prep, model, scaler, model_type, metrics, step_title):
    """
    Pickle the model bundle to disk, create a Step row pointing to it.

    Returns the Step object.
    """
    # --- Pickle the model + preprocessing together so What-If has everything ---
    bundle = {
        "model": model,
        "scaler": scaler,
        "features_original": prep["features_original"],
        "features_encoded": prep["features_encoded"],
        "numeric_cols": prep["numeric_cols"],
        "categorical_cols": prep["categorical_cols"],
        "feature_stats": prep["feature_stats"],
        "target_type": prep["target_type"],
    }

    safe_name = f"model_{uuid.uuid4().hex}.pkl"
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    model_path = os.path.join(upload_folder, safe_name)
    with open(model_path, "wb") as f:
        pickle.dump(bundle, f)

    # --- Create Step row ---
    # Store everything the UI needs to display the model + build What-If forms.
    # The pickle is only loaded when we actually run a prediction.
    next_order = len(project.steps)

    step = Step(
        project_id=project.id,
        step_type="model_trained",
        title=step_title,
        order_index=next_order,
        details=json.dumps({
            "model_type": model_type,
            "target_type": prep["target_type"],
            "target": None,  # set below
            "features_original": prep["features_original"],
            "feature_stats": prep["feature_stats"],
            "numeric_cols": prep["numeric_cols"],
            "categorical_cols": prep["categorical_cols"],
            "metrics": metrics,
            "model_path": model_path,
            "dataset_id": dataset.id,
            "n_rows_used": prep["n_rows_used"],
        }),
    )
    db.session.add(step)
    db.session.commit()

    return step


def _update_step_target(step, target):
    """Set target name on step details (we know it from the caller but couldn't pass cleanly)."""
    details = json.loads(step.details)
    details["target"] = target
    step.details = json.dumps(details)
    db.session.commit()


# ============================================================================
# Linear regression (for continuous targets)
# ============================================================================

def train_linear_regression(project, dataset, target, features, test_size=0.2):
    """
    Fit ordinary least squares. Target must be numeric/continuous.

    Why we scale features:
      Linear regression coefficients are interpretable, but when features have
      wildly different scales (e.g. age [18-80] vs income [$20K-$200K]) the
      coefficients become hard to compare. Scaling puts them on equal footing.
    """
    df = data_service.load_dataframe(dataset)
    prep = _prepare_data(df, target, features)

    if prep["target_type"] != "continuous":
        raise ValueError(
            "Linear regression needs a continuous numeric target. "
            f"'{target}' looks like {prep['target_type']}."
        )

    # --- Scale features so coefficients are comparable ---
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(prep["X"])

    # --- Train/test split ---
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, prep["y"], test_size=test_size, random_state=42,
    )

    # --- Fit the model ---
    model = LinearRegression()
    model.fit(X_train, y_train)

    # --- Evaluate on both train and test ---
    y_pred_train = model.predict(X_train)
    y_pred_test = model.predict(X_test)

    metrics = {
        "r2_train":   round(float(r2_score(y_train, y_pred_train)), 4),
        "r2_test":    round(float(r2_score(y_test, y_pred_test)), 4),
        "rmse_train": round(float(np.sqrt(mean_squared_error(y_train, y_pred_train))), 4),
        "rmse_test":  round(float(np.sqrt(mean_squared_error(y_test, y_pred_test))), 4),
        "mae_test":   round(float(mean_absolute_error(y_test, y_pred_test)), 4),
        "intercept":  round(float(model.intercept_), 4),
        # Coefficients in the SAME order as features_encoded
        "coefficients": [
            {"feature": f, "value": round(float(c), 4)}
            for f, c in zip(prep["features_encoded"], model.coef_)
        ],
        # Sample of predicted vs actual for a small scatter plot
        "sample_predictions": [
            {"actual": round(float(a), 4), "predicted": round(float(p), 4)}
            for a, p in zip(y_test.values[:50], y_pred_test[:50])
        ],
    }

    step = _save_model(
        project, dataset, prep, model, scaler,
        model_type="linear_regression",
        metrics=metrics,
        step_title=f"Linear regression predicting {target} (R²={metrics['r2_test']})",
    )
    _update_step_target(step, target)
    return step


# ============================================================================
# Logistic regression (for binary classification)
# ============================================================================

def train_logistic_regression(project, dataset, target, features, test_size=0.2):
    """
    Binary classification via logistic regression.
    Target must have exactly 2 unique values.
    """
    df = data_service.load_dataframe(dataset)
    prep = _prepare_data(df, target, features)

    if prep["target_type"] != "binary":
        raise ValueError(
            "Logistic regression needs a binary target (exactly 2 values). "
            f"'{target}' looks like {prep['target_type']}."
        )

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(prep["X"])

    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, prep["y"], test_size=test_size, random_state=42, stratify=prep["y"],
    )

    # max_iter=1000 in case the solver doesn't converge at the default 100
    model = LogisticRegression(max_iter=1000)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    # predict_proba gives the probability of each class — we want the positive one
    y_proba = model.predict_proba(X_test)[:, 1]

    # Pos label for binary — sklearn needs to know which class = "positive"
    # We pick whichever unique value is alphabetically last (deterministic)
    pos_label = sorted(prep["y"].unique())[-1]

    metrics = {
        "accuracy":  round(float(accuracy_score(y_test, y_pred)), 4),
        "precision": round(float(precision_score(y_test, y_pred, pos_label=pos_label, zero_division=0)), 4),
        "recall":    round(float(recall_score(y_test, y_pred, pos_label=pos_label, zero_division=0)), 4),
        "f1":        round(float(f1_score(y_test, y_pred, pos_label=pos_label, zero_division=0)), 4),
        "roc_auc":   round(float(roc_auc_score(y_test, y_proba)), 4),
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
        "class_labels": [str(c) for c in model.classes_],
        "positive_class": str(pos_label),
        "coefficients": [
            {"feature": f, "value": round(float(c), 4)}
            for f, c in zip(prep["features_encoded"], model.coef_[0])
        ],
    }

    step = _save_model(
        project, dataset, prep, model, scaler,
        model_type="logistic_regression",
        metrics=metrics,
        step_title=f"Logistic regression predicting {target} (accuracy={metrics['accuracy']})",
    )
    _update_step_target(step, target)
    return step


# ============================================================================
# Decision tree (classifier OR regressor depending on target)
# ============================================================================

def train_decision_tree(project, dataset, target, features, max_depth=5, test_size=0.2):
    """
    Decision tree. Auto-picks classifier vs regressor based on target type.

    max_depth limits how deep the tree grows — shallower trees generalize
    better (less overfitting) and are easier to interpret.
    """
    df = data_service.load_dataframe(dataset)
    prep = _prepare_data(df, target, features)

    # Trees don't need feature scaling (they split on thresholds, not distances)
    X_train, X_test, y_train, y_test = train_test_split(
        prep["X"], prep["y"], test_size=test_size, random_state=42,
    )

    if prep["target_type"] == "continuous":
        model = DecisionTreeRegressor(max_depth=max_depth, random_state=42)
        model.fit(X_train, y_train)

        y_pred_test = model.predict(X_test)
        metrics = {
            "r2_test":    round(float(r2_score(y_test, y_pred_test)), 4),
            "rmse_test":  round(float(np.sqrt(mean_squared_error(y_test, y_pred_test))), 4),
            "mae_test":   round(float(mean_absolute_error(y_test, y_pred_test)), 4),
            "max_depth":  max_depth,
            "n_leaves":   int(model.get_n_leaves()),
            "feature_importances": [
                {"feature": f, "value": round(float(v), 4)}
                for f, v in zip(prep["features_encoded"], model.feature_importances_)
            ],
        }
        title = f"Decision tree regressor for {target} (R²={metrics['r2_test']})"

    else:
        # Both binary and multiclass use the classifier
        model = DecisionTreeClassifier(max_depth=max_depth, random_state=42)
        model.fit(X_train, y_train)

        y_pred_test = model.predict(X_test)
        metrics = {
            "accuracy":            round(float(accuracy_score(y_test, y_pred_test)), 4),
            "f1":                  round(float(f1_score(y_test, y_pred_test, average="weighted", zero_division=0)), 4),
            "max_depth":           max_depth,
            "n_leaves":            int(model.get_n_leaves()),
            "confusion_matrix":    confusion_matrix(y_test, y_pred_test).tolist(),
            "class_labels":        [str(c) for c in model.classes_],
            "feature_importances": [
                {"feature": f, "value": round(float(v), 4)}
                for f, v in zip(prep["features_encoded"], model.feature_importances_)
            ],
        }
        title = f"Decision tree classifier for {target} (accuracy={metrics['accuracy']})"

    step = _save_model(
        project, dataset, prep, model,
        scaler=None,  # Trees don't need scaling
        model_type="decision_tree",
        metrics=metrics,
        step_title=title,
    )
    _update_step_target(step, target)
    return step


# ============================================================================
# Reading trained models (used by What-If)
# ============================================================================

def list_trained_models(project):
    """Return all trained model Steps for a project (newest first, non-reverted only)."""
    steps = Step.query.filter_by(
        project_id=project.id,
        step_type="model_trained",
        reverted=False,
    ).order_by(Step.order_index.desc()).all()

    return [{
        "id": s.id,
        "title": s.title,
        "order_index": s.order_index,
        "details": json.loads(s.details),
        "created_at": s.created_at.isoformat(),
    } for s in steps]


def load_model_bundle(step_id):
    """
    Load the pickle for a trained model step.
    Returns the full bundle dict (model + scaler + metadata).
    """
    step = Step.query.get(step_id)
    if not step or step.step_type != "model_trained":
        raise ValueError("Model not found")
    if step.reverted:
        raise ValueError("This model has been rolled back")

    details = json.loads(step.details)
    path = details.get("model_path")
    if not path or not os.path.exists(path):
        raise ValueError("Model file missing from disk")

    with open(path, "rb") as f:
        bundle = pickle.load(f)

    return step, details, bundle
