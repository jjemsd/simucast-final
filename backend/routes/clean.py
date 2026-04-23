# ============================================================================
# routes/clean.py
# ============================================================================
# HTTP endpoints for data cleaning. Each one delegates to clean_service.
# Every cleaning operation returns the NEW Dataset + the Step that was logged.
# ============================================================================

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from models import Dataset, Project
from services import clean_service

bp = Blueprint("clean", __name__)


def _get_dataset_and_project(dataset_id):
    """
    Helper: find a dataset owned by the current user, return (dataset, project)
    or (None, None) if not found or not owned.
    """
    dataset = Dataset.query.get(dataset_id)
    if not dataset:
        return None, None
    project = Project.query.get(dataset.project_id)
    if project.user_id != current_user.id:
        return None, None
    return dataset, project


@bp.route("/<int:dataset_id>/missing", methods=["POST"])
@login_required
def missing(dataset_id):
    """
    POST /api/clean/<dataset_id>/missing
    Body: { "column": "age", "strategy": "mean", "fill_value": null }
    """
    dataset, project = _get_dataset_and_project(dataset_id)
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    data = request.json or {}
    column = data.get("column")
    strategy = data.get("strategy")
    fill_value = data.get("fill_value")

    if not column or not strategy:
        return jsonify({"error": "column and strategy are required"}), 400

    try:
        new_dataset, step = clean_service.fill_missing(
            project, dataset, column, strategy, fill_value=fill_value
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({"dataset": new_dataset.to_dict(), "step": step.to_dict()}), 201


@bp.route("/<int:dataset_id>/outliers", methods=["POST"])
@login_required
def outliers(dataset_id):
    """
    POST /api/clean/<dataset_id>/outliers
    Body: { "column": "age", "method": "iqr", "threshold": 1.5 }
    """
    dataset, project = _get_dataset_and_project(dataset_id)
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    data = request.json or {}
    column = data.get("column")
    method = data.get("method", "iqr")
    threshold = data.get("threshold", 1.5)

    if not column:
        return jsonify({"error": "column is required"}), 400

    try:
        new_dataset, step = clean_service.remove_outliers(
            project, dataset, column, method=method, threshold=float(threshold)
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({"dataset": new_dataset.to_dict(), "step": step.to_dict()}), 201


@bp.route("/<int:dataset_id>/delete-columns", methods=["POST"])
@login_required
def delete_columns(dataset_id):
    """
    POST /api/clean/<dataset_id>/delete-columns
    Body: { "columns": ["legacy_id", "all_null_column", "placeholder_tbd"] }
    """
    dataset, project = _get_dataset_and_project(dataset_id)
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    data = request.json or {}
    columns = data.get("columns", [])

    if not columns:
        return jsonify({"error": "At least one column is required"}), 400

    try:
        new_dataset, step = clean_service.delete_columns(project, dataset, columns)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({"dataset": new_dataset.to_dict(), "step": step.to_dict()}), 201


@bp.route("/<int:dataset_id>/rename-column", methods=["POST"])
@login_required
def rename_column(dataset_id):
    """
    POST /api/clean/<dataset_id>/rename-column
    Body: { "old_name": "Zip", "new_name": "zip_code" }
    """
    dataset, project = _get_dataset_and_project(dataset_id)
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    data = request.json or {}
    old_name = (data.get("old_name") or "").strip()
    new_name = (data.get("new_name") or "").strip()

    if not old_name or not new_name:
        return jsonify({"error": "old_name and new_name are required"}), 400

    try:
        new_dataset, step = clean_service.rename_column(project, dataset, old_name, new_name)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({"dataset": new_dataset.to_dict(), "step": step.to_dict()}), 201


@bp.route("/<int:dataset_id>/convert-type", methods=["POST"])
@login_required
def convert_type(dataset_id):
    """
    POST /api/clean/<dataset_id>/convert-type
    Body: { "column": "age", "target_type": "int", "date_format": null }
    """
    dataset, project = _get_dataset_and_project(dataset_id)
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    data = request.json or {}
    column = data.get("column")
    target_type = data.get("target_type")
    date_format = data.get("date_format")

    if not column or not target_type:
        return jsonify({"error": "column and target_type are required"}), 400

    try:
        new_dataset, step = clean_service.convert_column_type(
            project, dataset, column, target_type, date_format=date_format
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({"dataset": new_dataset.to_dict(), "step": step.to_dict()}), 201


@bp.route("/<int:dataset_id>/deduplicate", methods=["POST"])
@login_required
def deduplicate(dataset_id):
    """
    POST /api/clean/<dataset_id>/deduplicate
    Body: { "subset": ["email"] }   (optional — omit to dedupe across all columns)
    """
    dataset, project = _get_dataset_and_project(dataset_id)
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    data = request.json or {}
    subset = data.get("subset") or None

    try:
        new_dataset, step = clean_service.deduplicate(project, dataset, subset=subset)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({"dataset": new_dataset.to_dict(), "step": step.to_dict()}), 201
