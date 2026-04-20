# ============================================================================
# routes/expand.py
# ============================================================================
# HTTP endpoints for feature engineering. Thin wrappers around expand_service.
# ============================================================================

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from models import Dataset, Project
from services import expand_service

bp = Blueprint("expand", __name__)


def _get_dataset_and_project(dataset_id):
    """Same helper pattern as in clean.py."""
    dataset = Dataset.query.get(dataset_id)
    if not dataset:
        return None, None
    project = Project.query.get(dataset.project_id)
    if project.user_id != current_user.id:
        return None, None
    return dataset, project


@bp.route("/<int:dataset_id>/math", methods=["POST"])
@login_required
def math(dataset_id):
    """
    POST /api/expand/<dataset_id>/math
    Body: { "column": "age", "transform": "log", "new_column_name": "log_age" }
    """
    dataset, project = _get_dataset_and_project(dataset_id)
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    data = request.json or {}
    try:
        new_dataset, step = expand_service.apply_math_transform(
            project, dataset,
            column=data.get("column"),
            transform=data.get("transform"),
            new_column_name=data.get("new_column_name") or None,
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({"dataset": new_dataset.to_dict(), "step": step.to_dict()}), 201


@bp.route("/<int:dataset_id>/interaction", methods=["POST"])
@login_required
def interaction(dataset_id):
    """
    POST /api/expand/<dataset_id>/interaction
    Body: { "col_a": "height_cm", "col_b": "weight_kg",
            "operation": "multiply", "new_column_name": "..." }
    """
    dataset, project = _get_dataset_and_project(dataset_id)
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    data = request.json or {}
    try:
        new_dataset, step = expand_service.create_interaction(
            project, dataset,
            col_a=data.get("col_a"),
            col_b=data.get("col_b"),
            operation=data.get("operation"),
            new_column_name=data.get("new_column_name") or None,
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({"dataset": new_dataset.to_dict(), "step": step.to_dict()}), 201


@bp.route("/<int:dataset_id>/bins", methods=["POST"])
@login_required
def bins(dataset_id):
    """
    POST /api/expand/<dataset_id>/bins
    Body: { "column": "age", "num_bins": 4, "method": "quantile",
            "new_column_name": "age_quartile" }
    """
    dataset, project = _get_dataset_and_project(dataset_id)
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    data = request.json or {}
    try:
        new_dataset, step = expand_service.create_bins(
            project, dataset,
            column=data.get("column"),
            num_bins=data.get("num_bins", 4),
            method=data.get("method", "equal_width"),
            new_column_name=data.get("new_column_name") or None,
            labels=data.get("labels"),
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({"dataset": new_dataset.to_dict(), "step": step.to_dict()}), 201


@bp.route("/<int:dataset_id>/suggest", methods=["POST"])
@login_required
def suggest(dataset_id):
    """
    POST /api/expand/<dataset_id>/suggest
    (No body required.) Returns Claude's feature suggestions for the dataset.
    """
    dataset, project = _get_dataset_and_project(dataset_id)
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    try:
        suggestions = expand_service.suggest_features(dataset)
    except Exception as e:
        return jsonify({"error": f"AI suggestion failed: {str(e)}"}), 500

    return jsonify({"suggestions": suggestions})


@bp.route("/<int:dataset_id>/apply-suggestion", methods=["POST"])
@login_required
def apply_suggestion(dataset_id):
    """
    POST /api/expand/<dataset_id>/apply-suggestion
    Body: { "name": "BMI", "formula": "weight_kg / (height_cm / 100) ** 2",
            "source_columns": ["height_cm", "weight_kg"] }
    """
    dataset, project = _get_dataset_and_project(dataset_id)
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    data = request.json or {}
    try:
        new_dataset, step = expand_service.apply_ai_suggestion(
            project, dataset,
            name=data.get("name", "ai_feature"),
            formula=data.get("formula", ""),
            source_columns=data.get("source_columns", []),
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({"dataset": new_dataset.to_dict(), "step": step.to_dict()}), 201
