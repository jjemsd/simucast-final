# ============================================================================
# services/expand_service.py
# ============================================================================
# Feature engineering — create new columns from existing ones.
#
# Four categories of expansion:
#   1. Math transforms      — log, sqrt, square, z-score, min-max, reciprocal
#   2. Interactions         — a+b, a-b, a*b, a/b between two columns
#   3. Binning              — categorize a continuous column (equal-width or quantile)
#   4. AI-suggested         — Claude analyzes the data and recommends features
#
# Uses the same snapshot-per-operation pattern as clean_service — every
# expansion creates a new Dataset row so we can roll back.
# ============================================================================

import os
import json
import uuid
import numpy as np
import pandas as pd
from flask import current_app

from database import db
from models import Dataset, Step
from services import data_service, ai_service


# ============================================================================
# Core helper (same pattern as clean_service)
# ============================================================================

def _save_expanded_dataset(project, original_dataset, transformed_df,
                           step_type, step_title, step_details):
    """Save transformed DF as a new Dataset + log a Step. Returns (dataset, step)."""
    safe_name = f"{uuid.uuid4().hex}.csv"
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    storage_path = os.path.join(upload_folder, safe_name)
    transformed_df.to_csv(storage_path, index=False)

    columns_info = {col: str(transformed_df[col].dtype) for col in transformed_df.columns}

    new_dataset = Dataset(
        project_id=project.id,
        original_filename=original_dataset.original_filename,
        storage_path=storage_path,
        row_count=len(transformed_df),
        column_count=len(transformed_df.columns),
        columns_info=json.dumps(columns_info),
    )
    db.session.add(new_dataset)
    db.session.flush()

    next_order = len(project.steps)
    step_details["new_dataset_id"] = new_dataset.id
    step = Step(
        project_id=project.id,
        step_type=step_type,
        title=step_title,
        details=json.dumps(step_details),
        order_index=next_order,
    )
    db.session.add(step)
    db.session.commit()

    return new_dataset, step


def _safe_name(base):
    """Turn 'My Column' into 'my_column' (safe column name)."""
    return base.lower().replace(" ", "_").replace("-", "_")


# ============================================================================
# 1. Math transforms
# ============================================================================

# Map each transform name to (function, name_prefix, description)
# Why a dict? Makes it easy to add new transforms later, and we can
# validate the input against the keys.
MATH_TRANSFORMS = {
    "log":        {"fn": lambda s: np.log(s),                     "prefix": "log",        "desc": "natural log"},
    "log10":      {"fn": lambda s: np.log10(s),                   "prefix": "log10",      "desc": "log base 10"},
    "sqrt":       {"fn": lambda s: np.sqrt(s),                    "prefix": "sqrt",       "desc": "square root"},
    "square":     {"fn": lambda s: s ** 2,                        "prefix": "sq",         "desc": "squared"},
    "reciprocal": {"fn": lambda s: 1 / s,                         "prefix": "inv",        "desc": "1 / x"},
    "zscore":     {"fn": lambda s: (s - s.mean()) / s.std(),      "prefix": "z",          "desc": "z-score standardized"},
    "minmax":     {"fn": lambda s: (s - s.min()) / (s.max() - s.min()), "prefix": "mm",    "desc": "min-max normalized to [0, 1]"},
    "abs":        {"fn": lambda s: s.abs(),                       "prefix": "abs",        "desc": "absolute value"},
}


def apply_math_transform(project, dataset, column, transform, new_column_name=None):
    """
    Apply a math transform to a column, creating a new column.

    Returns the new Dataset and Step.
    """
    df = data_service.load_dataframe(dataset)

    if column not in df.columns:
        raise ValueError(f"Column '{column}' not found")
    if not pd.api.types.is_numeric_dtype(df[column]):
        raise ValueError(f"Math transforms require a numeric column, got '{column}'")

    if transform not in MATH_TRANSFORMS:
        raise ValueError(
            f"Unknown transform '{transform}'. "
            f"Available: {', '.join(MATH_TRANSFORMS.keys())}"
        )

    config = MATH_TRANSFORMS[transform]

    # Default name: log_age, sqrt_fare, z_income, etc.
    if not new_column_name:
        new_column_name = f"{config['prefix']}_{column}"

    # Prevent silent overwrite
    if new_column_name in df.columns:
        raise ValueError(f"Column '{new_column_name}' already exists")

    # Apply the transform
    # Some transforms blow up on zero/negative (log, sqrt, reciprocal).
    # np.log(-1) returns NaN + a RuntimeWarning — we catch that.
    try:
        with np.errstate(divide="ignore", invalid="ignore"):
            df[new_column_name] = config["fn"](df[column])
    except Exception as e:
        raise ValueError(f"Transform failed: {e}")

    # Replace inf/-inf with NaN so downstream code doesn't break
    df[new_column_name] = df[new_column_name].replace([np.inf, -np.inf], np.nan)

    nan_count = int(df[new_column_name].isna().sum())
    action_desc = f"Created {new_column_name} = {config['desc']} of {column}"
    if nan_count > 0:
        action_desc += f" ({nan_count} invalid → null)"

    return _save_expanded_dataset(
        project, dataset, df,
        step_type="expand_math",
        step_title=action_desc,
        step_details={
            "source_column": column,
            "transform": transform,
            "new_column": new_column_name,
            "nan_introduced": nan_count,
        },
    )


# ============================================================================
# 2. Interactions — combine two columns
# ============================================================================

INTERACTIONS = {
    "add":      {"fn": lambda a, b: a + b, "symbol": "+",  "desc": "sum"},
    "subtract": {"fn": lambda a, b: a - b, "symbol": "-",  "desc": "difference"},
    "multiply": {"fn": lambda a, b: a * b, "symbol": "*",  "desc": "product"},
    "divide":   {"fn": lambda a, b: a / b, "symbol": "/",  "desc": "ratio"},
}


def create_interaction(project, dataset, col_a, col_b, operation, new_column_name=None):
    """Create a new column by combining two columns with +, -, *, or /."""
    df = data_service.load_dataframe(dataset)

    for col in (col_a, col_b):
        if col not in df.columns:
            raise ValueError(f"Column '{col}' not found")
        if not pd.api.types.is_numeric_dtype(df[col]):
            raise ValueError(f"Interactions require numeric columns, '{col}' is not")

    if operation not in INTERACTIONS:
        raise ValueError(f"Unknown operation '{operation}'")

    config = INTERACTIONS[operation]

    if not new_column_name:
        new_column_name = _safe_name(f"{col_a}_{operation}_{col_b}")

    if new_column_name in df.columns:
        raise ValueError(f"Column '{new_column_name}' already exists")

    with np.errstate(divide="ignore", invalid="ignore"):
        df[new_column_name] = config["fn"](df[col_a], df[col_b])

    df[new_column_name] = df[new_column_name].replace([np.inf, -np.inf], np.nan)

    action_desc = f"Created {new_column_name} = {col_a} {config['symbol']} {col_b}"

    return _save_expanded_dataset(
        project, dataset, df,
        step_type="expand_interaction",
        step_title=action_desc,
        step_details={
            "col_a": col_a,
            "col_b": col_b,
            "operation": operation,
            "new_column": new_column_name,
        },
    )


# ============================================================================
# 3. Binning — continuous → categorical
# ============================================================================

def create_bins(project, dataset, column, num_bins, method="equal_width",
                new_column_name=None, labels=None):
    """
    Bucket a continuous column into categories.

    Methods:
      - "equal_width" — each bin is the same WIDTH (pandas cut)
                        e.g. ages 0-20, 20-40, 40-60, 60-80
      - "quantile"    — each bin has the same COUNT of values (pandas qcut)
                        e.g. age quartiles: Q1, Q2, Q3, Q4

    labels: optional list of strings (must have num_bins items). If omitted,
            bins are named like 'bin_1', 'bin_2', ...
    """
    df = data_service.load_dataframe(dataset)

    if column not in df.columns:
        raise ValueError(f"Column '{column}' not found")
    if not pd.api.types.is_numeric_dtype(df[column]):
        raise ValueError(f"Binning requires a numeric column, got '{column}'")

    num_bins = int(num_bins)
    if num_bins < 2 or num_bins > 20:
        raise ValueError("num_bins must be between 2 and 20")

    if not new_column_name:
        new_column_name = f"{column}_bin"
    if new_column_name in df.columns:
        raise ValueError(f"Column '{new_column_name}' already exists")

    if labels and len(labels) != num_bins:
        raise ValueError(f"Labels list must have exactly {num_bins} items")

    # Default labels = bin_1, bin_2, ...
    bin_labels = labels or [f"bin_{i + 1}" for i in range(num_bins)]

    try:
        if method == "equal_width":
            df[new_column_name] = pd.cut(df[column], bins=num_bins, labels=bin_labels)
        elif method == "quantile":
            # duplicates='drop' prevents crashes if too few unique values
            df[new_column_name] = pd.qcut(df[column], q=num_bins, labels=bin_labels, duplicates="drop")
        else:
            raise ValueError(f"Unknown method '{method}'")
    except ValueError as e:
        raise ValueError(f"Binning failed: {e}")

    # qcut returns a Categorical; convert to string for CSV round-tripping
    df[new_column_name] = df[new_column_name].astype(str)
    # pd.cut / pd.qcut put NaN → 'nan' string; convert back to real NaN
    df[new_column_name] = df[new_column_name].replace("nan", np.nan)

    action_desc = f"Created {new_column_name}: {num_bins} {method.replace('_', ' ')} bins of {column}"

    return _save_expanded_dataset(
        project, dataset, df,
        step_type="expand_bins",
        step_title=action_desc,
        step_details={
            "source_column": column,
            "num_bins": num_bins,
            "method": method,
            "new_column": new_column_name,
        },
    )


# ============================================================================
# 4. AI-suggested features
# ============================================================================

def suggest_features(dataset):
    """
    Ask Claude to analyze the dataset's columns and recommend derived features.

    Returns a list like:
        [
          {"name": "BMI",
           "description": "Standard body mass index from height and weight",
           "formula": "weight_kg / (height_cm / 100) ** 2",
           "source_columns": ["height_cm", "weight_kg"]},
          ...
        ]

    The UI lets the user apply any suggestion by calling apply_ai_suggestion.
    """
    import json as json_lib

    columns = json_lib.loads(dataset.columns_info) if dataset.columns_info else {}

    prompt = (
        f"Dataset '{dataset.original_filename}' has these columns and types:\n"
        + "\n".join(f"  - {col} ({dtype})" for col, dtype in columns.items())
        + "\n\nSuggest 4 to 6 useful derived features that could be created from "
        "these columns. Focus on features that would help predictive modeling or "
        "reveal interesting relationships (e.g. BMI from height+weight, days-since "
        "from date columns, ratios like spend-per-visit).\n\n"
        "Respond ONLY with a JSON array in this exact shape:\n"
        '[{"name": "bmi", "description": "Body mass index", '
        '"formula": "weight_kg / (height_cm / 100) ** 2", '
        '"source_columns": ["height_cm", "weight_kg"]}]\n'
        "No markdown, no code fences, just the JSON array."
    )

    # Reuse the general chat helper since it already handles Claude setup
    raw = ai_service.chat(prompt)

    try:
        # Claude sometimes wraps responses in ```json blocks despite being told not to
        cleaned = raw.strip().replace("```json", "").replace("```", "").strip()
        suggestions = json_lib.loads(cleaned)
        if not isinstance(suggestions, list):
            raise ValueError("Response is not a list")
    except Exception:
        # If parsing fails, return the raw text as a single pseudo-suggestion
        return [{
            "name": "parse_error",
            "description": raw[:500],
            "formula": "",
            "source_columns": [],
        }]

    return suggestions


def apply_ai_suggestion(project, dataset, name, formula, source_columns):
    """
    Apply an AI-suggested feature by evaluating the formula with pandas.

    SECURITY NOTE:
      pandas' eval() is restricted — it only understands arithmetic on column
      names, not arbitrary Python. It cannot read files, make network calls,
      or access `os`/`subprocess`. Safe for trusted LLM output.
    """
    df = data_service.load_dataframe(dataset)

    new_col = _safe_name(name)
    if new_col in df.columns:
        raise ValueError(f"Column '{new_col}' already exists")

    # Verify source columns exist
    missing = [c for c in source_columns if c not in df.columns]
    if missing:
        raise ValueError(f"Source columns not found: {', '.join(missing)}")

    try:
        # pd.eval runs arithmetic expressions against the DataFrame
        df[new_col] = df.eval(formula)
    except Exception as e:
        raise ValueError(f"Could not evaluate formula '{formula}': {e}")

    df[new_col] = df[new_col].replace([np.inf, -np.inf], np.nan)

    action_desc = f"Created {new_col} via AI: {formula}"

    return _save_expandeded_dataset_safe(
        project, dataset, df, action_desc, new_col, formula, source_columns
    )


def _save_expandeded_dataset_safe(project, dataset, df, action_desc, new_col, formula, source_columns):
    """Thin wrapper so we can pass the extra step details cleanly."""
    return _save_expanded_dataset(
        project, dataset, df,
        step_type="expand_ai",
        step_title=action_desc,
        step_details={
            "new_column": new_col,
            "formula": formula,
            "source_columns": source_columns,
        },
    )
