# ============================================================================
# routes/stats.py
# ============================================================================
# Descriptive statistics endpoints. All the math lives in stats_service.py —
# this file just receives requests and returns JSON.
# ============================================================================

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from models import Dataset
from services import stats_service

bp = Blueprint("stats", __name__)


def _get_dataset_or_404(dataset_id):
    """
    Helper: find a dataset owned by the current user, or return None.

    Leading underscore means "private to this file" (Python convention).
    We use this pattern in every route that takes a dataset_id.
    """
    dataset = Dataset.query.get(dataset_id)
    if not dataset or dataset.project.user_id != current_user.id:
        return None
    return dataset


@bp.route("/<int:dataset_id>/descriptives", methods=["POST"])
@login_required
def descriptives(dataset_id):
    """
    POST /api/stats/<dataset_id>/descriptives
    Body: { "columns": ["age", "fare", ...] }

    Returns mean, median, SD, min, max, skew, kurtosis for each column.

    --- What is a "descriptive statistic"? ---
    The basic numerical summary of a column. Mean tells you the center,
    SD tells you the spread, skew tells you if it's lopsided, etc.
    Usually the first thing you compute when you get a new dataset.
    """
    dataset = _get_dataset_or_404(dataset_id)
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    data = request.json or {}
    columns = data.get("columns", [])

    if not columns:
        return jsonify({"error": "At least one column is required"}), 400

    result = stats_service.compute_descriptives(dataset, columns)
    return jsonify(result)


@bp.route("/<int:dataset_id>/frequencies", methods=["POST"])
@login_required
def frequencies(dataset_id):
    """
    POST /api/stats/<dataset_id>/frequencies
    Body: { "column": "sex" }

    Returns counts and percentages for each unique value in the column.
    Best for categorical columns (sex, class, country).
    """
    dataset = _get_dataset_or_404(dataset_id)
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    data = request.json or {}
    column = data.get("column")
    if not column:
        return jsonify({"error": "Column name is required"}), 400

    result = stats_service.compute_frequencies(dataset, column)
    return jsonify(result)


@bp.route("/<int:dataset_id>/normality", methods=["POST"])
@login_required
def normality(dataset_id):
    """
    POST /api/stats/<dataset_id>/normality
    Body: { "column": "age" }

    Tests whether a column follows a normal (bell-curve) distribution.

    --- Why test normality? ---
    Many stats tests (t-test, ANOVA, linear regression) ASSUME the data is
    roughly normal. If it isn't, results can be misleading. So we test first.
    Returns Shapiro-Wilk p-value + histogram data.
    """
    dataset = _get_dataset_or_404(dataset_id)
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    data = request.json or {}
    column = data.get("column")
    if not column:
        return jsonify({"error": "Column name is required"}), 400

    result = stats_service.compute_normality(dataset, column)
    return jsonify(result)
