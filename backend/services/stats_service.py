# ============================================================================
# services/stats_service.py
# ============================================================================
# Descriptive statistics and normality tests.
#
# Every function takes a Dataset model + column name(s), loads the data
# via data_service, and computes the result using pandas + scipy.
# ============================================================================

import numpy as np
import pandas as pd
from scipy import stats

from services import data_service


def compute_descriptives(dataset, columns):
    """
    Compute basic descriptive statistics for one or more numeric columns.

    --- The statistics ---
    - mean:     the average (sum / count)
    - median:   the middle value when sorted (robust to outliers)
    - std:      standard deviation — how spread out the data is
    - min/max:  smallest and largest values
    - skewness: how lopsided the distribution is
                (0 = symmetric, positive = long right tail, negative = long left tail)
    - kurtosis: how heavy the tails are compared to a normal distribution
                (0 = normal, positive = heavy tails / outliers, negative = light tails)

    Returns:
        {
            "results": {
                "age": { "mean": 29.7, "median": 28.0, ... },
                "fare": { ... },
                ...
            }
        }
    """
    df = data_service.load_dataframe(dataset)
    results = {}

    for col in columns:
        # Skip if the column doesn't exist in the dataset
        if col not in df.columns:
            results[col] = {"error": "Column not found"}
            continue

        # Only compute numeric stats on numeric columns
        # pd.api.types.is_numeric_dtype checks if the column's type is numeric
        if not pd.api.types.is_numeric_dtype(df[col]):
            results[col] = {"error": "Not a numeric column"}
            continue

        # Drop NaN (missing values) before computing, since most stats ignore NaN
        series = df[col].dropna()
        missing_count = int(df[col].isna().sum())

        results[col] = {
            "count": int(len(series)),
            "missing": missing_count,
            "mean": round(float(series.mean()), 4),
            "median": round(float(series.median()), 4),
            "std": round(float(series.std()), 4),
            "min": round(float(series.min()), 4),
            "max": round(float(series.max()), 4),
            "range": round(float(series.max() - series.min()), 4),
            "skewness": round(float(series.skew()), 4),
            "kurtosis": round(float(series.kurtosis()), 4),
        }

    return {"results": results}


def compute_frequencies(dataset, column):
    """
    Count how often each unique value appears in a column.

    Example — for a "sex" column with 577 males and 314 females:
        {
            "column": "sex",
            "total": 891,
            "frequencies": [
                { "value": "male", "count": 577, "percent": 64.76 },
                { "value": "female", "count": 314, "percent": 35.24 }
            ]
        }

    Best used for categorical columns. For numeric columns, consider binning first.
    """
    df = data_service.load_dataframe(dataset)

    if column not in df.columns:
        return {"error": f"Column '{column}' not found"}

    # value_counts() returns a Series: {value: count} sorted by count desc
    counts = df[column].value_counts(dropna=False)
    total = int(len(df))

    frequencies = []
    for value, count in counts.items():
        # Handle NaN explicitly — it can't be JSON-encoded
        display_value = "(missing)" if pd.isna(value) else str(value)
        frequencies.append({
            "value": display_value,
            "count": int(count),
            "percent": round(float(count) / total * 100, 2),
        })

    return {
        "column": column,
        "total": total,
        "unique_count": int(df[column].nunique()),
        "frequencies": frequencies,
    }


def compute_normality(dataset, column):
    """
    Test whether a column follows a normal (bell-curve) distribution.

    --- What we return ---
    - shapiro_p:    Shapiro-Wilk test p-value.
                    If p > 0.05, we CAN'T reject the hypothesis that the data is normal
                    (so normality is plausible).
                    If p < 0.05, the data is probably NOT normal.
    - is_normal:    Simple yes/no based on p > 0.05.
    - histogram:    Data for drawing the histogram in the frontend.

    --- Important caveat ---
    Shapiro-Wilk is powerful — on very large samples (>5000 rows), it often
    rejects normality even for slightly non-normal data. Visual inspection
    (histogram, Q-Q plot) matters more than the p-value in that case.
    """
    df = data_service.load_dataframe(dataset)

    if column not in df.columns:
        return {"error": f"Column '{column}' not found"}

    if not pd.api.types.is_numeric_dtype(df[column]):
        return {"error": "Normality tests require a numeric column"}

    # Drop missing values before the test
    series = df[column].dropna()

    if len(series) < 3:
        return {"error": "Need at least 3 values for normality test"}

    # --- Shapiro-Wilk test ---
    # Returns (statistic, p_value). We usually only care about p_value.
    # Note: scipy warns if n > 5000 because the test becomes over-sensitive.
    shapiro_stat, shapiro_p = stats.shapiro(series)

    # --- Build histogram data (10 bins) ---
    # np.histogram returns (counts, bin_edges).
    # bin_edges has 11 values for 10 bins — we return the left edge of each bin.
    counts, bin_edges = np.histogram(series, bins=10)
    histogram = [
        {
            "bin_start": round(float(bin_edges[i]), 2),
            "bin_end": round(float(bin_edges[i + 1]), 2),
            "count": int(counts[i]),
        }
        for i in range(len(counts))
    ]

    return {
        "column": column,
        "n": int(len(series)),
        "shapiro_statistic": round(float(shapiro_stat), 4),
        "shapiro_p": round(float(shapiro_p), 4),
        "is_normal": bool(shapiro_p > 0.05),
        "skewness": round(float(series.skew()), 4),
        "kurtosis": round(float(series.kurtosis()), 4),
        "histogram": histogram,
    }
