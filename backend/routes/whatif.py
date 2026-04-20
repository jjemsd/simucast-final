# ============================================================================
# routes/whatif.py
# ============================================================================
# Endpoints for the What-If analysis feature.
# ============================================================================

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from models import Project, Step
from services import whatif_service

bp = Blueprint("whatif", __name__)


def _get_project_owned(project_id):
    return Project.query.filter_by(id=project_id, user_id=current_user.id).first()


def _verify_model_step(step_id, user_id):
    """Returns the Step if it's a model_trained step the user owns, else None."""
    step = Step.query.get(step_id)
    if not step or step.step_type != "model_trained":
        return None
    if step.project.user_id != user_id:
        return None
    return step


@bp.route("/<int:step_id>/predict", methods=["POST"])
@login_required
def predict(step_id):
    """
    POST /api/whatif/<step_id>/predict
    Body: { "inputs": {"age": 35, "income": 50000, "gender": "Male"} }
    """
    if not _verify_model_step(step_id, current_user.id):
        return jsonify({"error": "Model not found"}), 404

    data = request.json or {}
    inputs = data.get("inputs", {})

    try:
        result = whatif_service.predict(step_id, inputs)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Prediction failed: {str(e)}"}), 500

    return jsonify(result)


@bp.route("/<int:step_id>/sensitivity", methods=["POST"])
@login_required
def sensitivity(step_id):
    """
    POST /api/whatif/<step_id>/sensitivity
    Body: { "inputs": {...} }
    Returns each feature's impact on the prediction (for the sensitivity chart).
    """
    if not _verify_model_step(step_id, current_user.id):
        return jsonify({"error": "Model not found"}), 404

    data = request.json or {}
    base_inputs = data.get("inputs", {})

    try:
        result = whatif_service.sensitivity(step_id, base_inputs)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Sensitivity failed: {str(e)}"}), 500

    return jsonify(result)


@bp.route("/<int:step_id>/scenarios", methods=["GET"])
@login_required
def list_scenarios(step_id):
    """GET /api/whatif/<step_id>/scenarios — all scenarios saved against this model."""
    step = _verify_model_step(step_id, current_user.id)
    if not step:
        return jsonify({"error": "Model not found"}), 404

    scenarios = whatif_service.list_scenarios(step.project, step_id)
    return jsonify({"scenarios": scenarios})


@bp.route("/<int:step_id>/scenarios", methods=["POST"])
@login_required
def save_scenario(step_id):
    """
    POST /api/whatif/<step_id>/scenarios
    Body: { "name": "Best case", "inputs": {...}, "prediction": {...} }
    """
    step = _verify_model_step(step_id, current_user.id)
    if not step:
        return jsonify({"error": "Model not found"}), 404

    data = request.json or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Scenario name is required"}), 400

    try:
        scenario = whatif_service.save_scenario(
            step.project, step_id, name,
            inputs=data.get("inputs", {}),
            prediction=data.get("prediction", {}),
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({"scenario": scenario}), 201


@bp.route("/scenarios/<int:scenario_id>", methods=["DELETE"])
@login_required
def delete_scenario(scenario_id):
    """DELETE /api/whatif/scenarios/<id>"""
    step = Step.query.get(scenario_id)
    if not step or step.step_type != "scenario" or step.project.user_id != current_user.id:
        return jsonify({"error": "Scenario not found"}), 404

    try:
        whatif_service.delete_scenario(step.project, scenario_id)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({"ok": True})
