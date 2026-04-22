# ============================================================================
# routes/data.py
# ============================================================================
# Handles data import, preview, and export.
#
# Route files are thin — they just parse the request and hand off to services.
# The real work (reading CSVs, computing previews) lives in data_service.py.
# ============================================================================

import os

from flask import Blueprint, request, jsonify, send_file
from flask_login import login_required, current_user

from database import db
from models import Project, Dataset, Step
from services import data_service

bp = Blueprint("data", __name__)


@bp.route("/", methods=["GET"])
@login_required
def list_user_datasets():
    """
    GET /api/data/
    Every dataset the current user has across all their projects.

    Used by the Files page. Each row is annotated with the owning
    project's id + name so the UI can link back into the workspace.
    """
    datasets = (
        Dataset.query.join(Project)
        .filter(Project.user_id == current_user.id)
        .order_by(Dataset.created_at.desc())
        .all()
    )

    return jsonify({
        "datasets": [
            {
                **d.to_dict(),
                "project_id": d.project_id,
                "project_name": d.project.name,
            }
            for d in datasets
        ]
    })


@bp.route("/<int:dataset_id>/export", methods=["GET"])
@login_required
def export_dataset(dataset_id):
    """
    GET /api/data/<dataset_id>/export
    Stream the underlying file back to the user as a download.
    """
    dataset = Dataset.query.get(dataset_id)
    if not dataset or dataset.project.user_id != current_user.id:
        return jsonify({"error": "Dataset not found"}), 404

    if not os.path.exists(dataset.storage_path):
        return jsonify({"error": "File missing from server"}), 410

    return send_file(
        dataset.storage_path,
        as_attachment=True,
        download_name=dataset.original_filename,
    )


@bp.route("/<int:project_id>/upload", methods=["POST"])
@login_required
def upload(project_id):
    """
    POST /api/data/<project_id>/upload
    Body: multipart/form-data with a "file" field.

    Accepts: .csv, .xlsx, .json, .tsv
    """
    # --- Find the project and make sure it belongs to the user ---
    project = Project.query.filter_by(id=project_id, user_id=current_user.id).first()
    if not project:
        return jsonify({"error": "Project not found"}), 404

    # --- Get the uploaded file from the request ---
    # Flask puts uploaded files in request.files, keyed by the form field name
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    # --- Hand off to the service ---
    # This saves the file, parses it, and creates a Dataset row
    try:
        dataset = data_service.save_and_parse_upload(project, file)
    except ValueError as e:
        # The service raises ValueError for user-facing errors (e.g. "Unsupported format")
        return jsonify({"error": str(e)}), 400

    # --- Log this as a timeline step ---
    next_order = len(project.steps)
    step = Step(
        project_id=project.id,
        step_type="import",
        title=f"Imported {dataset.original_filename}",
        details=f'{{"rows": {dataset.row_count}, "cols": {dataset.column_count}}}',
        order_index=next_order,
    )
    db.session.add(step)
    db.session.commit()

    return jsonify({"dataset": dataset.to_dict()}), 201


@bp.route("/<int:dataset_id>/preview", methods=["GET"])
@login_required
def preview(dataset_id):
    """
    GET /api/data/<dataset_id>/preview?page=1&per_page=50
    Returns a page of rows from the dataset.
    """
    # Find the dataset and verify ownership (via its project)
    dataset = Dataset.query.get(dataset_id)
    if not dataset or dataset.project.user_id != current_user.id:
        return jsonify({"error": "Dataset not found"}), 404

    # Pagination parameters with sensible defaults
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 50)), 200)  # cap at 200

    result = data_service.get_preview(dataset, page=page, per_page=per_page)
    return jsonify(result)
