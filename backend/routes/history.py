# ============================================================================
# routes/history.py
# ============================================================================
# Endpoints for timeline / rollback.
# ============================================================================

from flask import Blueprint, jsonify
from flask_login import login_required, current_user

from models import Project, Step
from services import history_service

bp = Blueprint("history", __name__)


@bp.route("/<int:project_id>/rollback/<int:step_id>", methods=["POST"])
@login_required
def rollback(project_id, step_id):
    """
    POST /api/history/<project_id>/rollback/<step_id>

    Reverts the given step and everything after it. Returns:
        { "reverted_count": N, "current_dataset_id": X }
    """
    project = Project.query.filter_by(id=project_id, user_id=current_user.id).first()
    if not project:
        return jsonify({"error": "Project not found"}), 404

    try:
        result = history_service.rollback_to_step(project, step_id)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify(result)


@bp.route("/<int:project_id>/steps", methods=["GET"])
@login_required
def list_steps(project_id):
    """
    GET /api/history/<project_id>/steps
    Returns all steps ordered by timeline position.
    """
    project = Project.query.filter_by(id=project_id, user_id=current_user.id).first()
    if not project:
        return jsonify({"error": "Project not found"}), 404

    steps = Step.query.filter_by(project_id=project.id) \
        .order_by(Step.order_index.asc()).all()

    return jsonify({"steps": [s.to_dict() for s in steps]})
