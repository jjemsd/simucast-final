# ============================================================================
# routes/synthetic.py
# ============================================================================
# Endpoints for synthetic data generation.
# ============================================================================

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from models import Project
from services import synthetic_service

bp = Blueprint("synthetic", __name__)


def _get_project_owned(project_id):
    return Project.query.filter_by(id=project_id, user_id=current_user.id).first()


@bp.route("/<int:project_id>/schema", methods=["POST"])
@login_required
def schema(project_id):
    """
    POST /api/synthetic/<project_id>/schema
    Body: { "num_rows": 500, "columns": [...], "filename": "optional.csv" }
    """
    project = _get_project_owned(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404

    data = request.json or {}
    try:
        dataset, step = synthetic_service.generate_from_schema(project, data)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Generation failed: {str(e)}"}), 500

    return jsonify({"dataset": dataset.to_dict(), "step": step.to_dict()}), 201


@bp.route("/<int:project_id>/ai", methods=["POST"])
@login_required
def ai(project_id):
    """
    POST /api/synthetic/<project_id>/ai
    Body: { "description": "...", "num_rows": 50, "filename": "optional.csv" }
    """
    project = _get_project_owned(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404

    data = request.json or {}
    description = (data.get("description") or "").strip()
    if not description:
        return jsonify({"error": "Description is required"}), 400

    try:
        dataset, step = synthetic_service.generate_with_ai(
            project,
            description=description,
            num_rows=data.get("num_rows", 50),
            filename=data.get("filename"),
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"AI generation failed: {str(e)}"}), 500

    return jsonify({"dataset": dataset.to_dict(), "step": step.to_dict()}), 201
