# ============================================================================
# routes/ai.py
# ============================================================================
# All AI-powered endpoints. Delegates to ai_service.py which talks to Claude.
# ============================================================================

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from database import db
from models import Dataset, Step
from services import ai_service, data_service

bp = Blueprint("ai", __name__)


@bp.route("/chat", methods=["POST"])
@login_required
def chat():
    """
    POST /api/ai/chat
    Body: {
        "message": "What tests should I run?",
        "dataset_id": 42,  (optional — gives Claude context about the data)
        "history": [ {"role": "user", "content": "..."}, ... ]  (optional)
    }

    Returns Claude's text response.
    """
    data = request.json or {}
    message = data.get("message", "").strip()
    dataset_id = data.get("dataset_id")
    history = data.get("history", [])

    if not message:
        return jsonify({"error": "Message is required"}), 400

    # --- Get dataset context if provided ---
    # This lets Claude see column names, types, and a data sample —
    # so it can answer questions like "what test should I run on age vs survived?"
    dataset_context = None
    if dataset_id:
        dataset = Dataset.query.get(dataset_id)
        if dataset and dataset.project.user_id == current_user.id:
            dataset_context = dataset

    response_text = ai_service.chat(message, history=history, dataset=dataset_context)
    return jsonify({"response": response_text})


@bp.route("/interpret", methods=["POST"])
@login_required
def interpret():
    """
    POST /api/ai/interpret
    Body: {
        "analysis_type": "t_test",
        "result": { ...raw result dict... }
    }

    Returns plain-English interpretation. Fires automatically after any test.
    """
    data = request.json or {}
    analysis_type = data.get("analysis_type", "")
    result = data.get("result", {})

    if not analysis_type or not result:
        return jsonify({"error": "analysis_type and result are required"}), 400

    text = ai_service.interpret(analysis_type, result)
    return jsonify({"interpretation": text})


@bp.route("/overview", methods=["GET"])
@login_required
def overview():
    """
    GET /api/ai/overview?dataset_id=42
    AI-generated summary of dataset health + suggested next steps.
    Uses the per-column profile as input so the prompt stays small.
    """
    dataset_id = request.args.get("dataset_id")
    if not dataset_id:
        return jsonify({"error": "dataset_id is required"}), 400

    dataset = Dataset.query.get(dataset_id)
    if not dataset or dataset.project.user_id != current_user.id:
        return jsonify({"error": "Dataset not found"}), 404

    profile = data_service.build_profile(dataset)
    result = ai_service.overview(dataset, profile)
    return jsonify(result)


@bp.route("/suggestions", methods=["GET"])
@login_required
def ai_suggestions():
    """
    GET /api/ai/suggestions?dataset_id=42&module=clean
    Returns 2-4 contextual "what should I do next" cards for the given
    module, grounded in the dataset profile.
    """
    dataset_id = request.args.get("dataset_id")
    module = (request.args.get("module") or "data").strip()
    if not dataset_id:
        return jsonify({"error": "dataset_id is required"}), 400

    dataset = Dataset.query.get(dataset_id)
    if not dataset or dataset.project.user_id != current_user.id:
        return jsonify({"error": "Dataset not found"}), 404

    profile = data_service.build_profile(dataset)
    result = ai_service.suggestions(dataset, profile, module)
    return jsonify(result)


@bp.route("/explain-step", methods=["POST"])
@login_required
def explain_step():
    """
    POST /api/ai/explain-step
    Body: { "step_id": 42, "force": false }

    Returns {"reasoning": "..."} and caches it on the Step row so the
    next caller gets an instant response. Pass force=true to ignore
    the cache and regenerate.
    """
    data = request.json or {}
    step_id = data.get("step_id")
    force = bool(data.get("force", False))
    if not step_id:
        return jsonify({"error": "step_id is required"}), 400

    step = Step.query.get(step_id)
    if not step or step.project.user_id != current_user.id:
        return jsonify({"error": "Step not found"}), 404

    if step.reasoning and not force:
        return jsonify({"reasoning": step.reasoning, "cached": True})

    try:
        text = ai_service.explain_step(step)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    step.reasoning = text
    db.session.commit()
    return jsonify({"reasoning": text, "cached": False})


@bp.route("/suggest-column-name", methods=["POST"])
@login_required
def suggest_column_name():
    """
    POST /api/ai/suggest-column-name
    Body: { "source_columns": ["age"], "operation": "zscore", "description": "z-score of age" }
    """
    data = request.json or {}
    source = data.get("source_columns") or []
    operation = (data.get("operation") or "").strip()
    if not source or not operation:
        return jsonify({"error": "source_columns and operation are required"}), 400

    try:
        name = ai_service.suggest_column_name(source, operation, data.get("description"))
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    return jsonify({"name": name})


@bp.route("/suggest-model-features", methods=["POST"])
@login_required
def suggest_model_features():
    """
    POST /api/ai/suggest-model-features
    Body: { "dataset_id": 42, "target": "survived" }
    """
    data = request.json or {}
    dataset_id = data.get("dataset_id")
    target = (data.get("target") or "").strip()
    if not dataset_id or not target:
        return jsonify({"error": "dataset_id and target are required"}), 400

    dataset = Dataset.query.get(dataset_id)
    if not dataset or dataset.project.user_id != current_user.id:
        return jsonify({"error": "Dataset not found"}), 404

    profile = data_service.build_profile(dataset)
    return jsonify(ai_service.suggest_model_features(dataset, profile, target))


@bp.route("/recommend_test", methods=["POST"])
@login_required
def recommend_test():
    """
    POST /api/ai/recommend_test
    Body: {
        "dataset_id": 42,
        "question": "Is there a difference in survival between men and women?"
    }

    Claude picks the right test and explains why.
    """
    data = request.json or {}
    dataset_id = data.get("dataset_id")
    question = data.get("question", "").strip()

    if not dataset_id or not question:
        return jsonify({"error": "dataset_id and question are required"}), 400

    dataset = Dataset.query.get(dataset_id)
    if not dataset or dataset.project.user_id != current_user.id:
        return jsonify({"error": "Dataset not found"}), 404

    result = ai_service.recommend_test(dataset, question)
    return jsonify(result)
