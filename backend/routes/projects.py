# ============================================================================
# routes/projects.py
# ============================================================================
# CRUD on projects. A "project" is a dataset + all the work done on it.
# ============================================================================

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from database import db
from models import Project

bp = Blueprint("projects", __name__)


@bp.route("/", methods=["GET"])
@login_required
def list_projects():
    """
    GET /api/projects/
    Returns all projects owned by the logged-in user, newest first.
    """
    # current_user.projects uses the relationship we defined in models.py
    projects = Project.query.filter_by(user_id=current_user.id) \
        .order_by(Project.updated_at.desc()) \
        .all()

    return jsonify({"projects": [p.to_dict() for p in projects]})


@bp.route("/", methods=["POST"])
@login_required
def create_project():
    """
    POST /api/projects/
    Body: { "name": "...", "description": "..." (optional) }
    """
    data = request.json or {}
    name = data.get("name", "").strip()
    description = data.get("description", "").strip()

    if not name:
        return jsonify({"error": "Project name is required"}), 400

    project = Project(
        name=name,
        description=description,
        user_id=current_user.id,
    )
    db.session.add(project)
    db.session.commit()

    return jsonify({"project": project.to_dict()}), 201


@bp.route("/<int:project_id>", methods=["GET"])
@login_required
def get_project(project_id):
    """
    GET /api/projects/<id>
    Returns a single project with its datasets and steps.
    """
    # Make sure this project belongs to the current user
    project = Project.query.filter_by(id=project_id, user_id=current_user.id).first()

    if not project:
        return jsonify({"error": "Project not found"}), 404

    return jsonify({
        "project": project.to_dict(),
        "datasets": [d.to_dict() for d in project.datasets],
        "steps": [s.to_dict() for s in sorted(project.steps, key=lambda s: s.order_index)],
    })


@bp.route("/<int:project_id>", methods=["DELETE"])
@login_required
def delete_project(project_id):
    """DELETE /api/projects/<id>"""
    project = Project.query.filter_by(id=project_id, user_id=current_user.id).first()

    if not project:
        return jsonify({"error": "Project not found"}), 404

    db.session.delete(project)
    db.session.commit()

    return jsonify({"ok": True})
