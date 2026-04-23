# ============================================================================
# services/data_service.py
# ============================================================================
# All the actual work for data import, preview, and export.
#
# Why separate from routes/data.py?
# Routes are about HTTP (parsing requests, returning JSON).
# Services are about business logic (reading files, using pandas).
# Keeping them apart means we could reuse these functions from a CLI,
# a background job, or a different route — without duplicating code.
# ============================================================================

import os
import json
import uuid
import pandas as pd

from database import db
from models import Dataset, File


# --- File formats we can read ---
# The key is the file extension, the value is the pandas function to call.
SUPPORTED_FORMATS = {
    ".csv": lambda path: pd.read_csv(path),
    ".tsv": lambda path: pd.read_csv(path, sep="\t"),
    ".xlsx": lambda path: pd.read_excel(path),
    ".xls": lambda path: pd.read_excel(path),
    ".json": lambda path: pd.read_json(path),
}


def save_and_parse_file(user, uploaded):
    """
    Save an uploaded file to disk, parse it to extract metadata, and create
    a File row. Does NOT create a Dataset — that happens when the file is
    used in a project.

    Arguments:
        user: the User this file belongs to
        uploaded: the Werkzeug FileStorage object from request.files

    Returns:
        File: the newly created File model instance

    Raises:
        ValueError: if the format isn't supported or the file is unreadable
    """
    from flask import current_app

    original_name = uploaded.filename
    _, ext = os.path.splitext(original_name.lower())

    if ext not in SUPPORTED_FORMATS:
        raise ValueError(
            f"Unsupported format '{ext}'. "
            f"Supported: {', '.join(SUPPORTED_FORMATS.keys())}"
        )

    # Unique on-disk name so two users uploading "data.csv" don't collide.
    safe_name = f"{uuid.uuid4().hex}{ext}"
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    storage_path = os.path.join(upload_folder, safe_name)

    uploaded.save(storage_path)

    # Parse to get row/col counts and dtypes.
    try:
        reader = SUPPORTED_FORMATS[ext]
        df = reader(storage_path)
    except Exception as e:
        # Clean up the saved bytes if parsing fails.
        if os.path.exists(storage_path):
            os.remove(storage_path)
        raise ValueError(f"Could not read file: {e}")

    columns_info = {col: str(df[col].dtype) for col in df.columns}

    file = File(
        user_id=user.id,
        original_filename=original_name,
        storage_path=storage_path,
        row_count=len(df),
        column_count=len(df.columns),
        columns_info=json.dumps(columns_info),
    )
    db.session.add(file)
    db.session.commit()
    return file


def attach_file_to_project(project, file):
    """
    Create a Dataset row that ties an existing File to a Project.

    Both legacy (mirror) columns and the new file_id FK are populated so
    code that still reads Dataset.* directly keeps working.
    """
    dataset = Dataset(
        project_id=project.id,
        file_id=file.id,
        original_filename=file.original_filename,
        storage_path=file.storage_path,
        row_count=file.row_count,
        column_count=file.column_count,
        columns_info=file.columns_info,
    )
    db.session.add(dataset)
    db.session.commit()
    return dataset


def save_and_parse_upload(project, file):
    """
    Compatibility wrapper: takes an upload coming into a project (the old
    /api/data/<project>/upload flow) and creates BOTH a File row and a
    Dataset row, returning the Dataset.

    New code should call save_and_parse_file() + attach_file_to_project()
    separately — that path lets a single File back multiple projects.
    """
    uploaded_file = save_and_parse_file(project.user, file)
    return attach_file_to_project(project, uploaded_file)


def load_dataframe(dataset):
    """
    Read a Dataset row's file back into a pandas DataFrame.

    This is the function every other service calls when they need to
    actually work with the data. We could cache this later if it becomes slow.
    """
    _, ext = os.path.splitext(dataset.storage_path.lower())
    reader = SUPPORTED_FORMATS[ext]
    return reader(dataset.storage_path)


def profile_column(series):
    """
    Compute a short summary of one column. Shape:
      {
        "dtype": "int64" | "object" | ...,
        "null_count": int,
        "non_null_count": int,
        "error_count": int,   # values that don't match the declared dtype
        "numeric": {           # only present for numeric columns
          "sum", "mean", "min", "max", "std"
        } | None,
        "categorical": {       # only present when low-cardinality text
          "unique_count": int,
          "top_values": [ {"value": ..., "count": int}, ... ]  # up to 8
        } | None,
      }
    """
    import numpy as np

    n = len(series)
    null_count = int(series.isna().sum())
    non_null_count = n - null_count

    out = {
        "dtype": str(series.dtype),
        "null_count": null_count,
        "non_null_count": non_null_count,
        "error_count": 0,
        "numeric": None,
        "categorical": None,
    }

    if non_null_count == 0:
        return out

    if pd.api.types.is_numeric_dtype(series):
        clean = series.dropna()
        def _safe(x):
            # Keep JSON-friendly — round floats and convert numpy scalars.
            if isinstance(x, (np.floating, float)):
                return round(float(x), 4)
            return int(x) if isinstance(x, (np.integer,)) else x
        out["numeric"] = {
            "sum": _safe(clean.sum()),
            "mean": _safe(clean.mean()),
            "min": _safe(clean.min()),
            "max": _safe(clean.max()),
            "std": _safe(clean.std()) if len(clean) > 1 else 0,
        }
        return out

    # Object / string columns — try two things:
    # 1) Detect "mixed type" errors: if most values parse as numbers,
    #    flag the few that don't as errors.
    # 2) If cardinality is low, return a frequency table (categorical).
    non_null = series.dropna().astype(str)
    parsed = pd.to_numeric(non_null, errors="coerce")
    numeric_share = parsed.notna().sum() / max(1, len(non_null))

    if numeric_share >= 0.8 and numeric_share < 1.0:
        # Predominantly numeric with a few offenders.
        out["error_count"] = int((parsed.isna()).sum())

    unique_count = int(non_null.nunique())
    out["categorical"] = {
        "unique_count": unique_count,
        "top_values": [],
    }
    # Only show the frequency table when cardinality is low — otherwise
    # it's just noise (e.g. 500 unique customer IDs).
    if unique_count <= 50:
        top = non_null.value_counts().head(8)
        out["categorical"]["top_values"] = [
            {"value": str(v), "count": int(c)} for v, c in top.items()
        ]
    return out


def build_profile(dataset):
    """
    Run profile_column on every column and return the dataset-level dict
    the UI consumes.
    """
    df = load_dataframe(dataset)
    return {
        "row_count": len(df),
        "column_count": len(df.columns),
        "columns": {col: profile_column(df[col]) for col in df.columns},
    }


def get_preview(dataset, page=1, per_page=50):
    """
    Return a paginated slice of the dataset for the frontend data grid.

    Returns a dict shaped like:
        {
            "columns": ["age", "name", ...],
            "rows": [ {"age": 25, "name": "Alice"}, ... ],
            "page": 1,
            "per_page": 50,
            "total_rows": 891,
            "total_pages": 18
        }
    """
    df = load_dataframe(dataset)

    # --- Calculate pagination ---
    total_rows = len(df)
    total_pages = max(1, (total_rows + per_page - 1) // per_page)  # ceiling division

    start = (page - 1) * per_page
    end = start + per_page

    # df.iloc[start:end] gets rows by position (not index label)
    page_df = df.iloc[start:end]

    # --- Convert to list of dicts for JSON ---
    # fillna("") replaces NaN with empty string (NaN can't be JSON-encoded)
    # to_dict(orient="records") gives us [{col: val, ...}, ...]
    rows = page_df.fillna("").to_dict(orient="records")

    return {
        "columns": list(df.columns),
        "rows": rows,
        "page": page,
        "per_page": per_page,
        "total_rows": total_rows,
        "total_pages": total_pages,
    }
