# ============================================================================
# services/synthetic_service.py
# ============================================================================
# Two ways to generate synthetic data:
#
#   1. Schema-based: user defines each column (name + type + params).
#      We use numpy + Faker to generate rows deterministically.
#      Fast, no AI needed, supports any row count.
#
#   2. AI-generated: user describes the data in plain English.
#      Claude returns realistic rows. Capped at 100 rows because
#      the full dataset has to fit in one API response.
#
# In both cases the result is saved as a NEW Dataset row on the project
# (just like a CSV upload would be). A Step is logged for the Timeline.
# ============================================================================

import os
import json
import uuid
import random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from flask import current_app

try:
    # Faker is optional — gives us realistic names, emails, addresses.
    # If it's not installed, schema-based generation still works for
    # numeric/category/date/uuid types.
    from faker import Faker
    _faker = Faker()
    HAS_FAKER = True
except ImportError:
    _faker = None
    HAS_FAKER = False

from database import db
from models import Dataset, Step
from services import ai_service


# ============================================================================
# Core helper — same pattern as data_service upload
# ============================================================================

def _save_synthetic_dataset(project, df, filename, source_description):
    """
    Persist a synthetic DataFrame as a new Dataset + log a Step.
    Mirrors data_service.save_and_parse_upload.
    """
    safe_name = f"synth_{uuid.uuid4().hex}.csv"
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    storage_path = os.path.join(upload_folder, safe_name)
    df.to_csv(storage_path, index=False)

    columns_info = {col: str(df[col].dtype) for col in df.columns}

    dataset = Dataset(
        project_id=project.id,
        original_filename=filename,
        storage_path=storage_path,
        row_count=len(df),
        column_count=len(df.columns),
        columns_info=json.dumps(columns_info),
    )
    db.session.add(dataset)
    db.session.flush()

    next_order = len(project.steps)
    step = Step(
        project_id=project.id,
        step_type="synthetic_generated",
        title=f"Generated {len(df)} synthetic rows: {filename}",
        order_index=next_order,
        details=json.dumps({
            "new_dataset_id": dataset.id,
            "source": source_description,
            "rows": len(df),
            "cols": len(df.columns),
        }),
    )
    db.session.add(step)
    db.session.commit()

    return dataset, step


# ============================================================================
# Schema-based generation
# ============================================================================

def generate_from_schema(project, schema):
    """
    Generate a synthetic dataset from a column schema.

    schema shape:
        {
          "num_rows": 500,
          "filename": "mydata.csv",    (optional)
          "columns": [
            {"name": "age", "type": "numeric",
             "mean": 35, "std": 10, "min": 18, "max": 80},
            {"name": "gender", "type": "category",
             "values": ["Male", "Female"]},
            {"name": "signup_date", "type": "date",
             "start": "2020-01-01", "end": "2024-12-31"},
            {"name": "customer_id", "type": "uuid"},
            {"name": "full_name", "type": "name"},
            {"name": "email", "type": "email"},
            {"name": "is_active", "type": "boolean"},
          ]
        }
    """
    num_rows = int(schema.get("num_rows", 100))
    if num_rows < 1 or num_rows > 10000:
        raise ValueError("num_rows must be between 1 and 10000")

    columns = schema.get("columns", [])
    if not columns:
        raise ValueError("At least one column is required")

    # Seed so results are reproducible within a session
    np.random.seed(42)
    random.seed(42)

    data = {}
    for col_config in columns:
        name = col_config.get("name", "").strip()
        col_type = col_config.get("type", "")

        if not name:
            raise ValueError("All columns must have a name")

        data[name] = _generate_column(col_type, col_config, num_rows)

    df = pd.DataFrame(data)

    filename = schema.get("filename") or f"synthetic_{num_rows}_rows.csv"
    return _save_synthetic_dataset(project, df, filename, f"schema with {len(columns)} columns")


def _generate_column(col_type, config, n):
    """Generate `n` values for a single column based on its type + config."""

    if col_type == "numeric":
        # Normal distribution, optionally clipped to [min, max]
        mean = float(config.get("mean", 0))
        std = float(config.get("std", 1))
        values = np.random.normal(mean, std, n)

        if "min" in config:
            values = np.maximum(values, float(config["min"]))
        if "max" in config:
            values = np.minimum(values, float(config["max"]))

        # If the user explicitly wants integers (e.g. age, count)
        if config.get("integer"):
            values = np.round(values).astype(int)
        else:
            values = np.round(values, 2)

        return values

    if col_type == "category":
        choices = config.get("values", [])
        if not choices:
            raise ValueError(f"Category column '{config.get('name')}' needs a 'values' list")
        weights = config.get("weights")  # optional — falls back to uniform
        if weights:
            if len(weights) != len(choices):
                raise ValueError(
                    f"weights length ({len(weights)}) must match values length ({len(choices)})"
                )
            # Normalize in case they don't sum to 1
            weights = np.array(weights) / np.sum(weights)
            return np.random.choice(choices, n, p=weights)
        return np.random.choice(choices, n)

    if col_type == "date":
        # Random dates between start and end (inclusive), as ISO strings
        start = datetime.fromisoformat(config.get("start", "2020-01-01"))
        end = datetime.fromisoformat(config.get("end", "2024-12-31"))
        total_days = (end - start).days
        if total_days < 1:
            raise ValueError("date column: 'end' must be after 'start'")
        offsets = np.random.randint(0, total_days, n)
        return [(start + timedelta(days=int(off))).date().isoformat() for off in offsets]

    if col_type == "boolean":
        return np.random.choice([True, False], n)

    if col_type == "uuid":
        # Short IDs — for real UUIDs use uuid.uuid4()
        return [f"{config.get('prefix', 'ID')}-{uuid.uuid4().hex[:8].upper()}" for _ in range(n)]

    # --- Faker-dependent types ---
    if col_type == "name":
        if not HAS_FAKER:
            raise ValueError("Name generation requires the 'faker' package")
        return [_faker.name() for _ in range(n)]

    if col_type == "email":
        if not HAS_FAKER:
            raise ValueError("Email generation requires the 'faker' package")
        return [_faker.email() for _ in range(n)]

    if col_type == "phone":
        if not HAS_FAKER:
            raise ValueError("Phone generation requires the 'faker' package")
        return [_faker.phone_number() for _ in range(n)]

    if col_type == "city":
        if not HAS_FAKER:
            raise ValueError("City generation requires the 'faker' package")
        return [_faker.city() for _ in range(n)]

    if col_type == "company":
        if not HAS_FAKER:
            raise ValueError("Company generation requires the 'faker' package")
        return [_faker.company() for _ in range(n)]

    raise ValueError(f"Unknown column type: '{col_type}'")


# ============================================================================
# AI-generated (Claude writes the rows)
# ============================================================================

# Cap AI output — one Claude response has to hold the entire dataset as JSON.
# 100 rows × ~8 columns × ~30 chars = ~24,000 tokens. Stays within Claude's
# output limit (which also has to include the JSON overhead).
MAX_AI_ROWS = 100


def generate_with_ai(project, description, num_rows=50, filename=None):
    """
    Ask Claude to generate realistic-looking synthetic data from a description.

    Example description:
        "50 rows of customer purchase data for a coffee shop in Manila,
        with columns for customer_id, date, item, quantity, price_php, tip_php"

    Claude returns JSON with {columns, rows}, which we convert to a DataFrame.
    """
    num_rows = int(num_rows)
    if num_rows < 1 or num_rows > MAX_AI_ROWS:
        raise ValueError(f"num_rows must be between 1 and {MAX_AI_ROWS} for AI generation")

    prompt = (
        f"Generate exactly {num_rows} rows of realistic synthetic data based on this "
        f"description:\n\n{description}\n\n"
        f"Respond ONLY with a JSON object in this exact shape:\n"
        f'{{"columns": ["col1", "col2", ...], '
        f'"rows": [{{"col1": "value", "col2": 123, ...}}, ...]}}\n'
        f"- The 'rows' array must have exactly {num_rows} rows.\n"
        f"- Choose column names and types that make sense for the domain.\n"
        f"- Keep values realistic and varied.\n"
        f"- No markdown, no code fences, just the JSON object."
    )

    raw = ai_service.chat(prompt)

    # Strip markdown fences in case Claude ignored instructions
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```", 2)[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.rsplit("```", 1)[0]
    cleaned = cleaned.strip()

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ValueError(f"AI returned invalid JSON: {e}. Raw: {raw[:200]}...")

    rows = parsed.get("rows", [])
    if not rows:
        raise ValueError("AI returned no rows")

    df = pd.DataFrame(rows)

    # Order columns as Claude specified them (pandas might reorder)
    if "columns" in parsed:
        cols_present = [c for c in parsed["columns"] if c in df.columns]
        if cols_present:
            df = df[cols_present]

    filename = filename or f"ai_synthetic_{num_rows}_rows.csv"
    return _save_synthetic_dataset(project, df, filename, f"AI prompt: {description[:80]}")
