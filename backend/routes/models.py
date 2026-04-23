# ============================================================================
# routes/models.py
# ============================================================================
# HTTP endpoints for model training.
# Note the filename — it's "models.py" like the DB models file. Because these
# are in different folders (routes/ vs root), Python doesn't confuse them.
# ============================================================================

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from models import Dataset, Project
from services import model_service

bp = Blueprint("models", __name__)


def _get_dataset_and_project(dataset_id):
    dataset = Dataset.query.get(dataset_id)
    if not dataset:
        return None, None
    project = Project.query.get(dataset.project_id)
    if project.user_id != current_user.id:
        return None, None
    return dataset, project


@bp.route("/<int:dataset_id>/linear", methods=["POST"])
@login_required
def linear(dataset_id):
    """
    POST /api/models/<dataset_id>/linear
    Body: { "target": "income", "features": ["age", "education"] }
    """
    dataset, project = _get_dataset_and_project(dataset_id)
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    data = request.json or {}
    try:
        step = model_service.train_linear_regression(
            project, dataset,
            target=data.get("target"),
            features=data.get("features", []),
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Training failed: {str(e)}"}), 500

    return jsonify({"step": step.to_dict()}), 201


@bp.route("/<int:dataset_id>/logistic", methods=["POST"])
@login_required
def logistic(dataset_id):
    """
    POST /api/models/<dataset_id>/logistic
    Body: { "target": "survived", "features": ["age", "fare", "sex"] }
    """
    dataset, project = _get_dataset_and_project(dataset_id)
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    data = request.json or {}
    try:
        step = model_service.train_logistic_regression(
            project, dataset,
            target=data.get("target"),
            features=data.get("features", []),
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Training failed: {str(e)}"}), 500

    return jsonify({"step": step.to_dict()}), 201


@bp.route("/<int:dataset_id>/tree", methods=["POST"])
@login_required
def tree(dataset_id):
    """
    POST /api/models/<dataset_id>/tree
    Body: { "target": "survived", "features": [...], "max_depth": 5 }
    """
    dataset, project = _get_dataset_and_project(dataset_id)
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    data = request.json or {}
    try:
        step = model_service.train_decision_tree(
            project, dataset,
            target=data.get("target"),
            features=data.get("features", []),
            max_depth=int(data.get("max_depth", 5)),
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Training failed: {str(e)}"}), 500

    return jsonify({"step": step.to_dict()}), 201


@bp.route("/<int:dataset_id>/forest", methods=["POST"])
@login_required
def forest(dataset_id):
    """
    POST /api/models/<dataset_id>/forest
    Body: { "target": "...", "features": [...], "n_estimators": 100, "max_depth": null }
    """
    dataset, project = _get_dataset_and_project(dataset_id)
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    data = request.json or {}
    try:
        step = model_service.train_random_forest(
            project, dataset,
            target=data.get("target"),
            features=data.get("features", []),
            n_estimators=int(data.get("n_estimators", 100)),
            max_depth=data.get("max_depth"),
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Training failed: {str(e)}"}), 500

    return jsonify({"step": step.to_dict()}), 201


@bp.route("/<int:dataset_id>/gbm", methods=["POST"])
@login_required
def gbm(dataset_id):
    """
    POST /api/models/<dataset_id>/gbm
    Body: { "target": "...", "features": [...],
            "n_estimators": 100, "learning_rate": 0.1, "max_depth": 3 }
    """
    dataset, project = _get_dataset_and_project(dataset_id)
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404

    data = request.json or {}
    try:
        step = model_service.train_gradient_boosting(
            project, dataset,
            target=data.get("target"),
            features=data.get("features", []),
            n_estimators=int(data.get("n_estimators", 100)),
            learning_rate=float(data.get("learning_rate", 0.1)),
            max_depth=int(data.get("max_depth", 3)),
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Training failed: {str(e)}"}), 500

    return jsonify({"step": step.to_dict()}), 201


@bp.route("/<int:project_id>/list", methods=["GET"])
@login_required
def list_models(project_id):
    """
    GET /api/models/<project_id>/list
    Returns all trained models for this project (used by What-If to pick one).
    """
    project = Project.query.filter_by(id=project_id, user_id=current_user.id).first()
    if not project:
        return jsonify({"error": "Project not found"}), 404

    models = model_service.list_trained_models(project)
    return jsonify({"models": models})
