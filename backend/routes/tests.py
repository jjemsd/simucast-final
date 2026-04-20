# ============================================================================
# routes/tests.py
# ============================================================================
# Endpoints for statistical tests. All real work happens in tests_service.
# ============================================================================

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from models import Dataset
from services import tests_service

bp = Blueprint("tests", __name__)


def _get_dataset_or_404(dataset_id):
    dataset = Dataset.query.get(dataset_id)
    if not dataset or dataset.project.user_id != current_user.id:
        return None
    return dataset


# ============================================================================
# T-tests
# ============================================================================

@bp.route("/<int:dataset_id>/t-test/one-sample", methods=["POST"])
@login_required
def t_test_one_sample(dataset_id):
    """
    POST /api/tests/<dataset_id>/t-test/one-sample
    Body: { "column": "age", "test_value": 30 }
    """
    dataset = _get_dataset_or_404(dataset_id)
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    data = request.json or {}
    try:
        result = tests_service.t_test_one_sample(
            dataset,
            column=data.get("column"),
            test_value=data.get("test_value"),
        )
    except (ValueError, TypeError) as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({"result": result})


@bp.route("/<int:dataset_id>/t-test/independent", methods=["POST"])
@login_required
def t_test_independent(dataset_id):
    """
    POST /api/tests/<dataset_id>/t-test/independent
    Body: { "numeric_col": "income", "group_col": "gender" }
    """
    dataset = _get_dataset_or_404(dataset_id)
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    data = request.json or {}
    try:
        result = tests_service.t_test_independent(
            dataset,
            numeric_col=data.get("numeric_col"),
            group_col=data.get("group_col"),
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({"result": result})


@bp.route("/<int:dataset_id>/t-test/paired", methods=["POST"])
@login_required
def t_test_paired(dataset_id):
    """
    POST /api/tests/<dataset_id>/t-test/paired
    Body: { "col_a": "before", "col_b": "after" }
    """
    dataset = _get_dataset_or_404(dataset_id)
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    data = request.json or {}
    try:
        result = tests_service.t_test_paired(
            dataset,
            col_a=data.get("col_a"),
            col_b=data.get("col_b"),
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({"result": result})


# ============================================================================
# ANOVA
# ============================================================================

@bp.route("/<int:dataset_id>/anova", methods=["POST"])
@login_required
def anova(dataset_id):
    """
    POST /api/tests/<dataset_id>/anova
    Body: { "numeric_col": "satisfaction_score", "group_col": "tier_level" }
    """
    dataset = _get_dataset_or_404(dataset_id)
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    data = request.json or {}
    try:
        result = tests_service.anova_one_way(
            dataset,
            numeric_col=data.get("numeric_col"),
            group_col=data.get("group_col"),
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({"result": result})


# ============================================================================
# Correlation
# ============================================================================

@bp.route("/<int:dataset_id>/correlation", methods=["POST"])
@login_required
def correlation(dataset_id):
    """
    POST /api/tests/<dataset_id>/correlation
    Body: { "col_a": "age", "col_b": "income", "method": "pearson" }
    """
    dataset = _get_dataset_or_404(dataset_id)
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    data = request.json or {}
    try:
        result = tests_service.correlation(
            dataset,
            col_a=data.get("col_a"),
            col_b=data.get("col_b"),
            method=data.get("method", "pearson"),
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({"result": result})


# ============================================================================
# Chi-square
# ============================================================================

@bp.route("/<int:dataset_id>/chi-square", methods=["POST"])
@login_required
def chi_square(dataset_id):
    """
    POST /api/tests/<dataset_id>/chi-square
    Body: { "col_a": "gender", "col_b": "tier_level" }
    """
    dataset = _get_dataset_or_404(dataset_id)
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    data = request.json or {}
    try:
        result = tests_service.chi_square_independence(
            dataset,
            col_a=data.get("col_a"),
            col_b=data.get("col_b"),
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({"result": result})
