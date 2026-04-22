# ============================================================================
# routes/files.py
# ============================================================================
# Phase B: Files are now first-class, user-owned resources. This blueprint
# owns CRUD + preview + export for them, and the "new project from file"
# handoff that seeds a Project with an existing File.
#
# Routes (all mounted under /api/files):
#   GET    /                    list the current user's files
#   POST   /                    upload a new file
#   GET    /<id>                metadata
#   GET    /<id>/preview        paged rows
#   GET    /<id>/export         download the raw file
#   PATCH  /<id>                rename
#   DELETE /<id>                delete (warns if used by projects)
#   POST   /<id>/new-project    create a project seeded from this file
# ============================================================================

import os

from flask import Blueprint, request, jsonify, send_file
from flask_login import login_required, current_user

from database import db
from models import Dataset, File, Project, Step
from services import data_service

bp = Blueprint("files", __name__)


def _dict_with_usage(file):
    """File.to_dict() plus a project_count for the Files page UI."""
    project_count = (
        db.session.query(Dataset.project_id)
        .filter(Dataset.file_id == file.id)
        .distinct()
        .count()
    )
    return file.to_dict(project_count=project_count)


# --------------------------------------------------------------------------- #
# List + upload                                                                #
# --------------------------------------------------------------------------- #

@bp.route("/", methods=["GET"])
@login_required
def list_files():
    """
    GET /api/files/
    Every file the current user has uploaded, newest first.
    Each entry includes `project_count` (how many projects use it).
    """
    files = (
        File.query.filter_by(user_id=current_user.id)
        .order_by(File.created_at.desc())
        .all()
    )
    return jsonify({"files": [_dict_with_usage(f) for f in files]})


@bp.route("/", methods=["POST"])
@login_required
def upload_file():
    """
    POST /api/files/
    Body: multipart/form-data with a "file" field.

    Creates a File row but NOT a Dataset — that happens when the user
    attaches the file to a project (see /<id>/new-project below, or the
    existing /api/data/<project>/upload flow).
    """
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    uploaded = request.files["file"]
    if uploaded.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    try:
        file = data_service.save_and_parse_file(current_user, uploaded)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({"file": _dict_with_usage(file)}), 201


# --------------------------------------------------------------------------- #
# Per-file endpoints                                                           #
# --------------------------------------------------------------------------- #

def _get_owned_file_or_404(file_id):
    """Return the File iff it belongs to the current user, else None."""
    return File.query.filter_by(id=file_id, user_id=current_user.id).first()


@bp.route("/<int:file_id>", methods=["GET"])
@login_required
def get_file(file_id):
    file = _get_owned_file_or_404(file_id)
    if not file:
        return jsonify({"error": "File not found"}), 404
    return jsonify({"file": _dict_with_usage(file)})


@bp.route("/<int:file_id>/preview", methods=["GET"])
@login_required
def preview_file(file_id):
    """
    GET /api/files/<id>/preview?page=1&per_page=50
    Reuses the same pandas-based preview as Dataset previews, but looks
    up the bytes directly by File rather than Dataset.
    """
    file = _get_owned_file_or_404(file_id)
    if not file:
        return jsonify({"error": "File not found"}), 404

    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 50)), 200)

    # The preview function takes a "dataset-like" object — anything with a
    # storage_path attribute works. File has one, so pass it directly.
    result = data_service.get_preview(file, page=page, per_page=per_page)
    return jsonify(result)


@bp.route("/<int:file_id>/export", methods=["GET"])
@login_required
def export_file(file_id):
    file = _get_owned_file_or_404(file_id)
    if not file:
        return jsonify({"error": "File not found"}), 404
    if not os.path.exists(file.storage_path):
        return jsonify({"error": "File missing from server"}), 410
    return send_file(
        file.storage_path,
        as_attachment=True,
        download_name=file.original_filename,
    )


@bp.route("/<int:file_id>", methods=["PATCH"])
@login_required
def rename_file(file_id):
    """
    PATCH /api/files/<id>
    Body: { "original_filename": "new name.csv" }
    """
    file = _get_owned_file_or_404(file_id)
    if not file:
        return jsonify({"error": "File not found"}), 404

    data = request.json or {}
    new_name = (data.get("original_filename") or "").strip()
    if not new_name:
        return jsonify({"error": "Filename cannot be empty"}), 400

    file.original_filename = new_name

    # Keep any Dataset rows that still carry the legacy mirror in sync.
    for ds in file.datasets:
        ds.original_filename = new_name

    db.session.commit()
    return jsonify({"file": _dict_with_usage(file)})


@bp.route("/<int:file_id>", methods=["DELETE"])
@login_required
def delete_file(file_id):
    """
    DELETE /api/files/<id>[?force=1]

    By default we refuse to delete a file that's attached to any project
    (returns 409 with the list of project names). Pass `force=1` to
    delete anyway — the owning datasets are removed too, which will
    make those projects' analyses unusable.
    """
    file = _get_owned_file_or_404(file_id)
    if not file:
        return jsonify({"error": "File not found"}), 404

    force = request.args.get("force") in ("1", "true", "yes")

    # Projects currently using this file.
    using_projects = (
        db.session.query(Project)
        .join(Dataset, Dataset.project_id == Project.id)
        .filter(Dataset.file_id == file.id)
        .distinct()
        .all()
    )

    if using_projects and not force:
        return jsonify({
            "error": "File is in use",
            "used_in_projects": [
                {"id": p.id, "name": p.name} for p in using_projects
            ],
        }), 409

    # Force path: drop the datasets that reference this file first.
    if using_projects:
        Dataset.query.filter_by(file_id=file.id).delete()

    # Remove the on-disk bytes (ignore if already missing).
    if file.storage_path and os.path.exists(file.storage_path):
        try:
            os.remove(file.storage_path)
        except OSError:
            pass  # best-effort — the DB row is the source of truth

    db.session.delete(file)
    db.session.commit()
    return jsonify({"ok": True})


@bp.route("/<int:file_id>/new-project", methods=["POST"])
@login_required
def new_project_from_file(file_id):
    """
    POST /api/files/<id>/new-project
    Body: { "name": "...", "description": "..." (optional) }

    Creates a new Project owned by the current user and attaches the
    given File as its initial Dataset. Also records an "import" step so
    the Timeline shows the origin.
    """
    file = _get_owned_file_or_404(file_id)
    if not file:
        return jsonify({"error": "File not found"}), 404

    data = request.json or {}
    name = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip()
    if not name:
        return jsonify({"error": "Project name is required"}), 400

    project = Project(
        name=name,
        description=description,
        user_id=current_user.id,
    )
    db.session.add(project)
    db.session.flush()  # assigns project.id

    dataset = data_service.attach_file_to_project(project, file)

    step = Step(
        project_id=project.id,
        step_type="import",
        title=f"Imported {file.original_filename}",
        details=f'{{"rows": {file.row_count}, "cols": {file.column_count}}}',
        order_index=0,
    )
    db.session.add(step)
    db.session.commit()

    return jsonify({
        "project": project.to_dict(),
        "dataset": dataset.to_dict(),
    }), 201
