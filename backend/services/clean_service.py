# ============================================================================
# services/clean_service.py
# ============================================================================
# All the real cleaning operations live here.
#
# Design decision — snapshot-per-operation:
#   Each cleaning action creates a NEW Dataset row (and new CSV file).
#   The project's "current dataset" = the most recent Dataset row.
#   This makes rollback trivial: delete later Dataset rows, and the previous
#   one becomes current again.
# ============================================================================

import os
import json
import uuid
import numpy as np
import pandas as pd
from flask import current_app

from database import db
from models import Dataset, Step
from services import data_service


# ============================================================================
# Core helper — every cleaning function ends by calling this
# ============================================================================

def _save_cleaned_dataset(project, original_dataset, transformed_df, step_type, step_title, step_details):
    """
    Save a transformed DataFrame as a new Dataset row and log a Step.

    Returns:
        (new_dataset, step)

    Why this pattern?
      1. We never overwrite the original file — so rollback just deletes the new one
      2. Each cleaning operation gets its own versioned snapshot
      3. The Step row links back to the new Dataset so we can rollback
    """
    # --- Save transformed DF to a new uniquely-named CSV ---
    safe_name = f"{uuid.uuid4().hex}.csv"
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    storage_path = os.path.join(upload_folder, safe_name)
    transformed_df.to_csv(storage_path, index=False)

    # --- Build column type info ---
    columns_info = {col: str(transformed_df[col].dtype) for col in transformed_df.columns}

    # --- Create the new Dataset row ---
    # Keep the SAME original_filename so the UI shows a clean name, not a UUID.
    new_dataset = Dataset(
        project_id=project.id,
        original_filename=original_dataset.original_filename,
        storage_path=storage_path,
        row_count=len(transformed_df),
        column_count=len(transformed_df.columns),
        columns_info=json.dumps(columns_info),
    )
    db.session.add(new_dataset)
    db.session.flush()  # assigns new_dataset.id without committing yet

    # --- Log the step ---
    next_order = len(project.steps)
    # Store the new dataset's ID in details so rollback can find it
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


# ============================================================================
# Cleaning operations
# ============================================================================

def fill_missing(project, dataset, column, strategy, fill_value=None):
    """
    Fill (or drop) missing values in a single column.

    strategy options:
      - "drop"    → drop rows where this column is null
      - "mean"    → fill with column mean (numeric only)
      - "median"  → fill with column median (numeric only)
      - "mode"    → fill with most common value
      - "value"   → fill with a user-provided fill_value
      - "ffill"   → forward-fill from previous row
      - "bfill"   → backward-fill from next row
    """
    df = data_service.load_dataframe(dataset)

    if column not in df.columns:
        raise ValueError(f"Column '{column}' not found")

    null_count_before = int(df[column].isna().sum())
    rows_before = len(df)

    if strategy == "drop":
        df = df.dropna(subset=[column])
        action_desc = f"Dropped {rows_before - len(df)} rows with null {column}"

    elif strategy == "mean":
        if not pd.api.types.is_numeric_dtype(df[column]):
            raise ValueError(f"Cannot compute mean on non-numeric column '{column}'")
        fill = round(float(df[column].mean()), 4)
        df[column] = df[column].fillna(fill)
        action_desc = f"Filled {null_count_before} nulls in {column} with mean ({fill})"

    elif strategy == "median":
        if not pd.api.types.is_numeric_dtype(df[column]):
            raise ValueError(f"Cannot compute median on non-numeric column '{column}'")
        fill = round(float(df[column].median()), 4)
        df[column] = df[column].fillna(fill)
        action_desc = f"Filled {null_count_before} nulls in {column} with median ({fill})"

    elif strategy == "mode":
        # mode() can return multiple values if there's a tie — take the first
        mode_series = df[column].mode()
        if mode_series.empty:
            raise ValueError(f"Column '{column}' has no mode (all values are unique or null)")
        fill = mode_series.iloc[0]
        df[column] = df[column].fillna(fill)
        action_desc = f"Filled {null_count_before} nulls in {column} with mode ({fill})"

    elif strategy == "value":
        if fill_value is None:
            raise ValueError("fill_value is required when strategy='value'")
        df[column] = df[column].fillna(fill_value)
        action_desc = f"Filled {null_count_before} nulls in {column} with '{fill_value}'"

    elif strategy == "ffill":
        df[column] = df[column].ffill()
        action_desc = f"Forward-filled {null_count_before} nulls in {column}"

    elif strategy == "bfill":
        df[column] = df[column].bfill()
        action_desc = f"Backward-filled {null_count_before} nulls in {column}"

    else:
        raise ValueError(f"Unknown strategy '{strategy}'")

    return _save_cleaned_dataset(
        project, dataset, df,
        step_type="clean_missing",
        step_title=action_desc,
        step_details={
            "column": column,
            "strategy": strategy,
            "fill_value": fill_value,
            "nulls_filled": null_count_before,
        },
    )


def remove_outliers(project, dataset, column, method="iqr", threshold=1.5):
    """
    Remove rows where the column value is an outlier.

    Methods:
      - "iqr"    → rows outside [Q1 - threshold*IQR, Q3 + threshold*IQR]
                   Default threshold 1.5 is the standard Tukey fence.
      - "zscore" → rows where |z-score| > threshold (default 1.5 treated as 3 for z-score)
    """
    df = data_service.load_dataframe(dataset)

    if column not in df.columns:
        raise ValueError(f"Column '{column}' not found")

    if not pd.api.types.is_numeric_dtype(df[column]):
        raise ValueError(f"Outlier detection requires a numeric column, got '{column}'")

    rows_before = len(df)
    series = df[column].dropna()

    if method == "iqr":
        q1 = series.quantile(0.25)
        q3 = series.quantile(0.75)
        iqr = q3 - q1
        lower = q1 - threshold * iqr
        upper = q3 + threshold * iqr
        # Keep rows where value is null OR inside the fence
        mask = df[column].isna() | df[column].between(lower, upper)
        df = df[mask]
        bounds = {"lower": round(float(lower), 4), "upper": round(float(upper), 4)}

    elif method == "zscore":
        # Treat threshold 1.5 → z=3 (that's what most people mean)
        z_threshold = threshold if threshold >= 2 else 3
        mean = series.mean()
        std = series.std()
        if std == 0:
            raise ValueError(f"Column '{column}' has zero variance — no outliers possible")
        z_scores = (df[column] - mean) / std
        mask = df[column].isna() | (z_scores.abs() <= z_threshold)
        df = df[mask]
        bounds = {"z_threshold": z_threshold, "mean": round(float(mean), 4), "std": round(float(std), 4)}

    else:
        raise ValueError(f"Unknown outlier method '{method}'")

    removed = rows_before - len(df)
    action_desc = f"Removed {removed} outlier rows from {column} ({method.upper()})"

    return _save_cleaned_dataset(
        project, dataset, df,
        step_type="remove_outliers",
        step_title=action_desc,
        step_details={
            "column": column,
            "method": method,
            "threshold": threshold,
            "rows_removed": removed,
            "bounds": bounds,
        },
    )


def delete_columns(project, dataset, columns):
    """Drop one or more columns from the dataset."""
    df = data_service.load_dataframe(dataset)

    # Check all exist — fail cleanly if not
    missing = [c for c in columns if c not in df.columns]
    if missing:
        raise ValueError(f"Columns not found: {', '.join(missing)}")

    df = df.drop(columns=columns)

    # Build a nice title — show up to 3 column names, then "..."
    display = ", ".join(columns[:3]) + ("..." if len(columns) > 3 else "")
    action_desc = f"Deleted {len(columns)} column(s): {display}"

    return _save_cleaned_dataset(
        project, dataset, df,
        step_type="delete_columns",
        step_title=action_desc,
        step_details={
            "columns_deleted": columns,
            "count": len(columns),
        },
    )


def rename_column(project, dataset, old_name, new_name):
    """Rename a single column. Fails if the name already exists."""
    df = data_service.load_dataframe(dataset)

    if old_name not in df.columns:
        raise ValueError(f"Column '{old_name}' not found")
    if not new_name or not new_name.strip():
        raise ValueError("New column name cannot be empty")

    new_name = new_name.strip()
    if new_name == old_name:
        # No-op — but treat as success so the UI can close the modal.
        return _save_cleaned_dataset(
            project, dataset, df,
            step_type="rename_column",
            step_title=f"Renamed '{old_name}' (no change)",
            step_details={"old_name": old_name, "new_name": new_name},
        )

    if new_name in df.columns:
        raise ValueError(f"Column '{new_name}' already exists")

    df = df.rename(columns={old_name: new_name})

    return _save_cleaned_dataset(
        project, dataset, df,
        step_type="rename_column",
        step_title=f"Renamed '{old_name}' → '{new_name}'",
        step_details={"old_name": old_name, "new_name": new_name},
    )


# Maps the simple type names the UI offers to a pandas coercion strategy.
# Each entry returns (converted_series, error_count) — where error_count
# is the number of non-null values that failed to coerce.
def _coerce_column(series, target_type, date_format=None):
    """
    Convert a pandas Series to the requested logical type, counting any
    values that couldn't be coerced.

    target_type: one of 'str', 'int', 'float', 'date', 'bool'.
    date_format: optional strftime pattern for 'date' (None = auto-parse).
    """
    original_non_null = series.notna().sum()

    if target_type == "str":
        # Convert everything to string; NaN stays NaN (so the column is
        # still nullable in pandas).
        converted = series.astype("object").where(series.notna(), other=pd.NA)
        converted = converted.apply(lambda v: str(v) if pd.notna(v) else v)
        return converted, 0

    if target_type == "int":
        # to_numeric with errors='coerce' turns unparseable values into NaN.
        numeric = pd.to_numeric(series, errors="coerce")
        new_nulls = numeric.isna().sum() - series.isna().sum()
        # pandas' nullable Int64 keeps NaN support for int columns.
        try:
            converted = numeric.round().astype("Int64")
        except Exception:
            converted = numeric
        return converted, int(max(0, new_nulls))

    if target_type == "float":
        numeric = pd.to_numeric(series, errors="coerce")
        new_nulls = numeric.isna().sum() - series.isna().sum()
        return numeric.astype("float64"), int(max(0, new_nulls))

    if target_type == "date":
        dt = pd.to_datetime(series, errors="coerce", format=date_format) \
            if date_format else pd.to_datetime(series, errors="coerce")
        new_nulls = dt.isna().sum() - series.isna().sum()
        return dt, int(max(0, new_nulls))

    if target_type == "bool":
        # Accept common truthy/falsy spellings; anything else → NaN.
        truthy = {"true", "t", "yes", "y", "1", "1.0"}
        falsy = {"false", "f", "no", "n", "0", "0.0"}

        def _to_bool(v):
            if pd.isna(v):
                return pd.NA
            s = str(v).strip().lower()
            if s in truthy:
                return True
            if s in falsy:
                return False
            return pd.NA

        converted = series.apply(_to_bool).astype("boolean")
        new_nulls = converted.isna().sum() - series.isna().sum()
        return converted, int(max(0, new_nulls))

    raise ValueError(f"Unknown target type '{target_type}'")


def convert_column_type(project, dataset, column, target_type, date_format=None):
    """
    Convert one column to a different logical type. Values that can't be
    coerced become null and are counted as 'errors' in the step details.
    """
    df = data_service.load_dataframe(dataset)

    if column not in df.columns:
        raise ValueError(f"Column '{column}' not found")

    converted, error_count = _coerce_column(df[column], target_type, date_format)
    df[column] = converted

    title = f"Converted '{column}' → {target_type}"
    if error_count:
        title += f" ({error_count} failed)"

    return _save_cleaned_dataset(
        project, dataset, df,
        step_type="convert_type",
        step_title=title,
        step_details={
            "column": column,
            "target_type": target_type,
            "date_format": date_format,
            "error_count": error_count,
        },
    )


def deduplicate(project, dataset, subset=None):
    """
    Remove exact duplicate rows.

    subset: optional list of column names to consider for duplicate detection.
            If None, all columns must match for a row to count as duplicate.
    """
    df = data_service.load_dataframe(dataset)
    rows_before = len(df)

    df = df.drop_duplicates(subset=subset if subset else None)
    removed = rows_before - len(df)

    scope = f"by columns ({', '.join(subset)})" if subset else "across all columns"
    action_desc = f"Removed {removed} duplicate rows {scope}"

    return _save_cleaned_dataset(
        project, dataset, df,
        step_type="deduplicate",
        step_title=action_desc,
        step_details={
            "subset": subset,
            "rows_removed": removed,
        },
    )
