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
