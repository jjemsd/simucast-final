# ============================================================================
# routes/projects.py
# ============================================================================
# CRUD on projects. A "project" is a dataset + all the work done on it.
# ============================================================================

import os

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from database import db
from models import Dataset, File, Project

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


@bp.route("/<int:project_id>", methods=["PATCH"])
@login_required
def update_project(project_id):
    """
    PATCH /api/projects/<id>
    Body: { "name": "...", "description": "..." }  (both optional)

    Used by the Rename modal on the Projects page. Only touches the
    fields that are actually provided in the request body.
    """
    project = Project.query.filter_by(id=project_id, user_id=current_user.id).first()
    if not project:
        return jsonify({"error": "Project not found"}), 404

    data = request.json or {}

    if "name" in data:
        new_name = (data.get("name") or "").strip()
        if not new_name:
            return jsonify({"error": "Project name cannot be empty"}), 400
        project.name = new_name

    if "description" in data:
        project.description = (data.get("description") or "").strip()

    db.session.commit()
    return jsonify({"project": project.to_dict()})


@bp.route("/<int:project_id>/files", methods=["GET"])
@login_required
def project_files(project_id):
    """
    GET /api/projects/<id>/files
    Files attached to this project, each with the number of OTHER projects
    using the same file. The frontend uses this to decide whether
    "also delete files" is safe (unused == safe, shared == keep).
    """
    project = Project.query.filter_by(id=project_id, user_id=current_user.id).first()
    if not project:
        return jsonify({"error": "Project not found"}), 404

    # Unique files used by this project's datasets.
    files = (
        db.session.query(File)
        .join(Dataset, Dataset.file_id == File.id)
        .filter(Dataset.project_id == project.id)
        .distinct()
        .all()
    )

    out = []
    for f in files:
        # How many OTHER projects also reference this file?
        other_count = (
            db.session.query(Dataset.project_id)
            .filter(Dataset.file_id == f.id, Dataset.project_id != project.id)
            .distinct()
            .count()
        )
        out.append({
            "id": f.id,
            "original_filename": f.original_filename,
            "shared_with_other_projects": other_count,
        })

    return jsonify({"files": out})


@bp.route("/<int:project_id>", methods=["DELETE"])
@login_required
def delete_project(project_id):
    """
    DELETE /api/projects/<id>[?delete_files=1]

    Always removes the project and its datasets/steps.
    If delete_files=1 is passed, also deletes any File that ONLY this
    project was using. Files shared with other projects are kept.
    Returns { deleted_files: [...] } so the UI can show what was removed.
    """
    project = Project.query.filter_by(id=project_id, user_id=current_user.id).first()

    if not project:
        return jsonify({"error": "Project not found"}), 404

    delete_files = request.args.get("delete_files") in ("1", "true", "yes")
    deleted_files = []

    if delete_files:
        # Find files used only by this project's datasets.
        candidate_files = (
            db.session.query(File)
            .join(Dataset, Dataset.file_id == File.id)
            .filter(Dataset.project_id == project.id)
            .distinct()
            .all()
        )
        for f in candidate_files:
            used_elsewhere = (
                db.session.query(Dataset.project_id)
                .filter(Dataset.file_id == f.id, Dataset.project_id != project.id)
                .distinct()
                .count()
            )
            if used_elsewhere == 0:
                # Safe to delete: no one else references it.
                if f.storage_path and os.path.exists(f.storage_path):
                    try:
                        os.remove(f.storage_path)
                    except OSError:
                        pass
                deleted_files.append(
                    {"id": f.id, "original_filename": f.original_filename}
                )
                db.session.delete(f)

    db.session.delete(project)
    db.session.commit()

    return jsonify({"ok": True, "deleted_files": deleted_files})
