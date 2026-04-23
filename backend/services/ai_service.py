# ============================================================================
# services/ai_service.py
# ============================================================================
# All calls to Claude go through here.
#
# We keep this in one file so:
#   - The API key is only read in one place
#   - Prompt templates live together where we can tune them
#   - If we ever swap Claude for another AI, we only change this file
# ============================================================================

import json
from anthropic import Anthropic

from config import Config


# --- Create the Anthropic client once, when this file is imported ---
# The client reuses the same HTTP connection across calls, which is faster.
_client = Anthropic(api_key=Config.ANTHROPIC_API_KEY) if Config.ANTHROPIC_API_KEY else None


def _ensure_client():
    """Raise a clear error if the API key isn't configured."""
    if _client is None:
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set. Add it to your .env file."
        )


def _build_dataset_context(dataset):
    """
    Build a short text summary of a dataset to include in the prompt.

    We give Claude column names and types so it can answer things like
    "what test should I run?" without us having to send the full data
    (which would waste tokens and break privacy).
    """
    if not dataset:
        return ""

    columns = json.loads(dataset.columns_info) if dataset.columns_info else {}

    lines = [
        f"The user is working with a dataset called '{dataset.original_filename}'.",
        f"It has {dataset.row_count} rows and {dataset.column_count} columns.",
        "Columns and their types:",
    ]
    for col, dtype in columns.items():
        lines.append(f"  - {col} ({dtype})")

    return "\n".join(lines)


def chat(message, history=None, dataset=None):
    """
    General chat with Claude, optionally grounded in a dataset.

    Arguments:
        message:  the new user message (string)
        history:  list of prior messages in Anthropic format:
                  [ {"role": "user", "content": "..."}, {"role": "assistant", ...} ]
        dataset:  optional Dataset model instance for context

    Returns:
        Claude's response as a string.
    """
    _ensure_client()

    # --- Build the system prompt ---
    # The system prompt tells Claude who it is and how to behave.
    # We prepend dataset context here so it's always available.
    system_prompt = (
        "You are SimuCast's built-in AI assistant. You help students and "
        "casual analysts understand their data and pick the right statistical "
        "tests. Be concise, explain technical terms in plain English, and "
        "suggest concrete next steps."
    )

    if dataset:
        system_prompt += "\n\n" + _build_dataset_context(dataset)

    # --- Assemble the messages list ---
    # Claude's API takes a list of {role, content} dicts.
    messages = list(history or [])  # copy so we don't mutate the caller's list
    messages.append({"role": "user", "content": message})

    response = _client.messages.create(
        model=Config.CLAUDE_MODEL,
        max_tokens=1024,
        system=system_prompt,
        messages=messages,
    )

    # response.content is a list of content blocks. For plain text, there's
    # usually just one block with type="text". We pull out the text.
    return response.content[0].text


def interpret(analysis_type, result):
    """
    Turn a raw test result into a plain-English explanation.

    Called automatically after every test runs, so the user sees the
    numbers AND what they mean side-by-side.
    """
    _ensure_client()

    system_prompt = (
        "You explain statistical results in plain English for students. "
        "Keep responses to 2-3 short sentences. Focus on: (1) what the result "
        "means practically, (2) whether it's significant, (3) what the user "
        "should do next. Avoid jargon unless you immediately define it."
    )

    user_message = (
        f"Analysis type: {analysis_type}\n"
        f"Result (JSON): {json.dumps(result, indent=2)}\n\n"
        "Explain this result briefly."
    )

    response = _client.messages.create(
        model=Config.CLAUDE_MODEL,
        max_tokens=300,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )

    return response.content[0].text


def overview(dataset, profile):
    """
    Summarise the state of a dataset and suggest cleanup actions.

    Arguments:
        dataset: the Dataset model (for filename / dimensions)
        profile: output of data_service.build_profile() — a dict of
                 per-column stats. We send this to Claude instead of the
                 raw rows, keeping the prompt small.

    Returns a dict:
        {
          "summary": "One sentence describing overall data health.",
          "issues": [
            {"column": "...", "type": "nulls|errors|mixed|...",
             "description": "..."},
            ...
          ],
          "suggestions": ["...", "..."]
        }
    """
    _ensure_client()

    # Pre-process the profile into a short, token-friendly digest so we
    # don't blow the context window on 100-column datasets. Only include
    # columns that actually have something worth reporting.
    digest_lines = []
    for col, stats in profile.get("columns", {}).items():
        parts = [f"type={stats['dtype']}"]
        if stats["null_count"] > 0:
            parts.append(f"nulls={stats['null_count']}")
        if stats["error_count"] > 0:
            parts.append(f"errors={stats['error_count']}")
        if stats.get("categorical") and stats["categorical"].get("top_values"):
            top = stats["categorical"]["top_values"][:3]
            parts.append(
                "top=" + ", ".join(f"{t['value']}({t['count']})" for t in top)
            )
        if stats.get("numeric"):
            nm = stats["numeric"]
            parts.append(f"range=[{nm['min']}..{nm['max']}]")
        digest_lines.append(f"- {col}: {', '.join(parts)}")

    digest = "\n".join(digest_lines) or "(no columns)"

    system_prompt = (
        "You are a data-quality reviewer. Given a profile of a dataset, "
        "you return JSON describing its state and what to do next. "
        "Respond ONLY with a JSON object in this exact shape:\n"
        '{"summary": "...", "issues": [{"column": "...", '
        '"type": "nulls|errors|mixed|low_variance|other", '
        '"description": "..."}], "suggestions": ["..."]}\n'
        "Keep the summary to one sentence. List up to 6 issues and up to "
        "5 suggestions. No markdown, no code fences, no other text."
    )

    user_message = (
        f"Dataset: {dataset.original_filename}\n"
        f"Rows: {profile.get('row_count', '?')} | "
        f"Columns: {profile.get('column_count', '?')}\n\n"
        f"Column profile:\n{digest}\n\n"
        "Review this dataset."
    )

    response = _client.messages.create(
        model=Config.CLAUDE_MODEL,
        max_tokens=800,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )

    raw = response.content[0].text.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"summary": raw, "issues": [], "suggestions": []}


def suggestions(dataset, profile, module):
    """
    Per-module contextual "what should the user do next" card.

    Claude gets a compact profile digest + the module the user is on,
    and returns 2-4 actionable suggestions. Each suggestion has:
      - title: short headline
      - description: one-sentence why
      - module: which module it belongs to (echoed back)
      - action: optional machine-readable hint the UI can use to pre-fill
                a form ("fill_missing", "run_ttest", "train_logistic", etc.)
      - params: optional dict with columns / strategy / etc.
    """
    _ensure_client()

    # Digest the profile: column: dtype, null count, numeric range or top values.
    digest_lines = []
    for col, stats in profile.get("columns", {}).items():
        parts = [f"type={stats['dtype']}"]
        if stats["null_count"] > 0:
            parts.append(f"nulls={stats['null_count']}")
        if stats.get("numeric"):
            nm = stats["numeric"]
            parts.append(f"range=[{nm['min']}..{nm['max']}]")
        elif stats.get("categorical") and stats["categorical"].get("top_values"):
            top = stats["categorical"]["top_values"][:3]
            parts.append(
                "values=" + ",".join(f"{t['value']}({t['count']})" for t in top)
            )
        digest_lines.append(f"- {col}: {', '.join(parts)}")
    digest = "\n".join(digest_lines) or "(no columns)"

    # Per-module system prompt tweaks — keeps the output focused.
    module_hints = {
        "data":  "Focus on data quality: missing values, mixed types, suspect columns.",
        "clean": "Suggest specific cleaning operations: fill missing, remove outliers, drop columns, convert types.",
        "expand":"Suggest derived columns the user could compute (ratios, z-scores, bins, combinations).",
        "stats": "Suggest which descriptive statistics (descriptives, frequencies, normality) to compute on which columns.",
        "tests": "Recommend appropriate hypothesis tests (t-test, chi-square, correlation) with specific columns.",
        "model": "Recommend which model types are appropriate given the target types available, and which features to use.",
    }
    hint = module_hints.get(module, module_hints["data"])

    system_prompt = (
        "You are SimuCast's built-in analyst. Given a dataset profile and "
        f"the user's current module ({module}), return 2-4 concrete, "
        "actionable suggestions. " + hint + " "
        "Respond ONLY with a JSON object of this exact shape:\n"
        '{"suggestions": [{"title": "...", "description": "...", '
        '"module": "' + module + '", "action": "...", "params": {...}}]}\n'
        "'action' and 'params' are optional hints — leave them out when "
        "the advice is purely conceptual. Keep descriptions to one short "
        "sentence each. No markdown, no code fences."
    )

    user_message = (
        f"Dataset: {dataset.original_filename}\n"
        f"Rows: {profile.get('row_count', '?')}, Cols: {profile.get('column_count', '?')}\n\n"
        f"Column profile:\n{digest}\n"
    )

    response = _client.messages.create(
        model=Config.CLAUDE_MODEL,
        max_tokens=800,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )

    raw = response.content[0].text.strip()
    try:
        parsed = json.loads(raw)
        return {"suggestions": parsed.get("suggestions", [])}
    except json.JSONDecodeError:
        return {"suggestions": [{"title": "AI output", "description": raw, "module": module}]}


def explain_step(step):
    """
    One-paragraph plain-English 'why this happened' for a Timeline step.
    Uses the step's title + details (so no dataset load needed).
    """
    _ensure_client()

    details_str = json.dumps(json.loads(step.details) if step.details else {}, indent=2)

    system_prompt = (
        "You explain data-pipeline steps in plain English for students. "
        "Given the title and details of ONE step, write 1-3 short sentences "
        "covering: what happened, why a user might want this, and anything "
        "they should double-check next. Avoid jargon. No markdown."
    )

    user_message = (
        f"Step type: {step.step_type}\n"
        f"Title: {step.title}\n"
        f"Details (JSON): {details_str}\n\n"
        "Explain this step."
    )

    response = _client.messages.create(
        model=Config.CLAUDE_MODEL,
        max_tokens=250,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )
    return response.content[0].text.strip()


def suggest_column_name(source_columns, operation, description=None):
    """
    Given source columns and an operation, propose a snake_case name for
    the new column. Used by the ✦ Suggest name buttons in ExpandView.
    """
    _ensure_client()

    system_prompt = (
        "You pick concise snake_case column names for derived data "
        "columns. Respond ONLY with the name — no quotes, no explanation, "
        "no code fences. Max 40 characters. Lowercase, underscores only."
    )

    parts = [f"Source columns: {', '.join(source_columns)}"]
    parts.append(f"Operation: {operation}")
    if description:
        parts.append(f"Context: {description}")
    user_message = "\n".join(parts) + "\n\nSuggest a column name."

    response = _client.messages.create(
        model=Config.CLAUDE_MODEL,
        max_tokens=40,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )
    # Defensive cleanup: strip punctuation the model might add anyway.
    name = response.content[0].text.strip()
    name = name.split("\n")[0].strip().strip('"\'` ')
    return name[:60]


def suggest_model_features(dataset, profile, target):
    """
    Given the target column, return the list of feature columns Claude
    recommends plus a one-sentence reason. Used by the 'Select
    recommended' button in ModelView.
    """
    _ensure_client()

    digest_lines = []
    for col, stats in profile.get("columns", {}).items():
        if col == target:
            continue
        parts = [f"type={stats['dtype']}"]
        if stats["null_count"] > 0:
            parts.append(f"nulls={stats['null_count']}")
        if stats.get("categorical") and stats["categorical"].get("unique_count") is not None:
            parts.append(f"unique={stats['categorical']['unique_count']}")
        digest_lines.append(f"- {col}: {', '.join(parts)}")
    digest = "\n".join(digest_lines) or "(no columns)"

    system_prompt = (
        "You pick predictive features for a machine-learning model. "
        "Given a target column and a list of candidate columns, return "
        "JSON with the columns that are most likely to be useful features. "
        "Exclude identifiers (ids, emails, free-text), near-empty columns, "
        "and anything that would leak the target. "
        "Respond ONLY with:\n"
        '{"features": ["...", "..."], "reasoning": "..."}'
    )

    user_message = (
        f"Target: {target}\n\n"
        f"Candidate columns:\n{digest}\n\n"
        "Which columns should be used as features?"
    )

    response = _client.messages.create(
        model=Config.CLAUDE_MODEL,
        max_tokens=400,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )

    raw = response.content[0].text.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"features": [], "reasoning": raw}


def recommend_test(dataset, question):
    """
    Given a dataset and a plain-English question, recommend the right test.

    Returns:
        {
            "recommended_test": "independent t-test",
            "reasoning": "...",
            "required_columns": ["survived", "fare"]
        }
    """
    _ensure_client()

    context = _build_dataset_context(dataset)

    system_prompt = (
        "You recommend statistical tests based on a user's question and their data. "
        "Respond ONLY with a JSON object in this exact shape:\n"
        '{"recommended_test": "...", "reasoning": "...", "required_columns": [...]}\n'
        "No markdown, no code fences, no other text."
    )

    user_message = f"{context}\n\nQuestion: {question}\n\nWhich test should they run?"

    response = _client.messages.create(
        model=Config.CLAUDE_MODEL,
        max_tokens=500,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )

    # Try to parse the JSON. If Claude adds extra text, fall back to raw response.
    raw = response.content[0].text.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"recommended_test": "unknown", "reasoning": raw, "required_columns": []}
