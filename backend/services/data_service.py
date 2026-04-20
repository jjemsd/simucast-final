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
from models import Dataset


# --- File formats we can read ---
# The key is the file extension, the value is the pandas function to call.
SUPPORTED_FORMATS = {
    ".csv": lambda path: pd.read_csv(path),
    ".tsv": lambda path: pd.read_csv(path, sep="\t"),
    ".xlsx": lambda path: pd.read_excel(path),
    ".xls": lambda path: pd.read_excel(path),
    ".json": lambda path: pd.read_json(path),
}


def save_and_parse_upload(project, file):
    """
    Save an uploaded file to disk and create a Dataset row in the database.

    Arguments:
        project: the Project this dataset belongs to (a Project model instance)
        file: the uploaded file (a Werkzeug FileStorage object from Flask)

    Returns:
        Dataset: the newly created Dataset model instance

    Raises:
        ValueError: if the file format isn't supported or the file is unreadable
    """
    from flask import current_app

    # --- Figure out the file extension ---
    original_name = file.filename
    # os.path.splitext("data.csv") returns ("data", ".csv")
    _, ext = os.path.splitext(original_name.lower())

    if ext not in SUPPORTED_FORMATS:
        raise ValueError(
            f"Unsupported format '{ext}'. "
            f"Supported: {', '.join(SUPPORTED_FORMATS.keys())}"
        )

    # --- Generate a unique storage filename ---
    # We don't save with the original filename because two users might both
    # upload "data.csv" and overwrite each other. UUIDs guarantee uniqueness.
    safe_name = f"{uuid.uuid4().hex}{ext}"
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    storage_path = os.path.join(upload_folder, safe_name)

    # --- Save the file to disk ---
    file.save(storage_path)

    # --- Parse it with pandas to get metadata ---
    try:
        reader = SUPPORTED_FORMATS[ext]
        df = reader(storage_path)
    except Exception as e:
        # If parsing fails, clean up the saved file
        os.remove(storage_path)
        raise ValueError(f"Could not read file: {e}")

    # --- Build column info: {"age": "float64", "name": "object", ...} ---
    # df.dtypes is a pandas Series mapping column names to their data types
    columns_info = {col: str(df[col].dtype) for col in df.columns}

    # --- Create the Dataset row ---
    dataset = Dataset(
        project_id=project.id,
        original_filename=original_name,
        storage_path=storage_path,
        row_count=len(df),
        column_count=len(df.columns),
        columns_info=json.dumps(columns_info),  # Convert dict to string for storage
    )
    db.session.add(dataset)
    db.session.commit()

    return dataset


def load_dataframe(dataset):
    """
    Read a Dataset row's file back into a pandas DataFrame.

    This is the function every other service calls when they need to
    actually work with the data. We could cache this later if it becomes slow.
    """
    _, ext = os.path.splitext(dataset.storage_path.lower())
    reader = SUPPORTED_FORMATS[ext]
    return reader(dataset.storage_path)


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
