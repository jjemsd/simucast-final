# ============================================================================
# services/tests_service.py
# ============================================================================
# Statistical tests. Every test returns a dict with:
#   - the statistic (t, F, chi2, r, etc.)
#   - p-value
#   - degrees of freedom
#   - effect size (Cohen's d, eta-squared, etc.)
#   - a "significant" boolean (p < 0.05)
#   - any extra context the UI needs (group means, contingency table, etc.)
#
# What is a statistical test?
# -------------------------------------------------------
# Tests answer questions of the form "is the pattern I see real, or could it
# easily happen by chance?" The p-value is the probability of seeing your
# result (or more extreme) if the null hypothesis (no effect) were true.
# p < 0.05 = "the null hypothesis is probably wrong."
# ============================================================================

import numpy as np
import pandas as pd
from scipy import stats

from services import data_service


# Conventional alpha threshold. 0.05 is standard; some fields use 0.01 or 0.001.
ALPHA = 0.05


# ============================================================================
# Helpers
# ============================================================================

def _clean_series(df, col):
    """Drop NaN + verify numeric. Raises ValueError on problems."""
    if col not in df.columns:
        raise ValueError(f"Column '{col}' not found")
    if not pd.api.types.is_numeric_dtype(df[col]):
        raise ValueError(f"'{col}' is not numeric — tests require numeric data")
    return df[col].dropna()


def _round(v, n=4):
    """Safely round a value to n decimals. Handles numpy types and NaN."""
    try:
        if pd.isna(v):
            return None
        return round(float(v), n)
    except (TypeError, ValueError):
        return None


# ============================================================================
# T-tests
# ============================================================================

def t_test_one_sample(dataset, column, test_value):
    """
    One-sample t-test.

    Asks: is the mean of this column different from `test_value`?
    Example: "Is the average age different from 30?"
    """
    df = data_service.load_dataframe(dataset)
    series = _clean_series(df, column)

    if len(series) < 2:
        raise ValueError("Need at least 2 non-null values")

    test_value = float(test_value)
    t_stat, p_value = stats.ttest_1samp(series, popmean=test_value)

    # Cohen's d for a one-sample test = (mean - target) / SD
    cohens_d = (series.mean() - test_value) / series.std() if series.std() > 0 else 0

    return {
        "test": "one_sample_t",
        "column": column,
        "test_value": test_value,
        "n": int(len(series)),
        "sample_mean": _round(series.mean()),
        "sample_std": _round(series.std()),
        "t_statistic": _round(t_stat),
        "degrees_of_freedom": int(len(series) - 1),
        "p_value": _round(p_value, 6),
        "cohens_d": _round(cohens_d),
        "significant": bool(p_value < ALPHA),
    }


def t_test_independent(dataset, numeric_col, group_col):
    """
    Independent-samples t-test (also called Welch's t-test).

    Asks: do these two groups have different means?
    The group_col must contain exactly 2 unique values.

    Example: "Does income differ between males and females?"
    """
    df = data_service.load_dataframe(dataset)

    if numeric_col not in df.columns:
        raise ValueError(f"Column '{numeric_col}' not found")
    if group_col not in df.columns:
        raise ValueError(f"Column '{group_col}' not found")
    if not pd.api.types.is_numeric_dtype(df[numeric_col]):
        raise ValueError(f"'{numeric_col}' is not numeric")

    # Drop rows where either value is null
    clean = df[[numeric_col, group_col]].dropna()
    groups = clean[group_col].unique()

    if len(groups) != 2:
        raise ValueError(
            f"Independent t-test requires exactly 2 groups; '{group_col}' has {len(groups)}"
        )

    g1_name, g2_name = str(groups[0]), str(groups[1])
    g1 = clean[clean[group_col] == groups[0]][numeric_col]
    g2 = clean[clean[group_col] == groups[1]][numeric_col]

    # equal_var=False → Welch's t-test, which handles unequal variances better
    # than Student's t-test. Always a safe default.
    t_stat, p_value = stats.ttest_ind(g1, g2, equal_var=False)

    # Cohen's d using pooled standard deviation
    pooled_std = np.sqrt((g1.var() + g2.var()) / 2)
    cohens_d = (g1.mean() - g2.mean()) / pooled_std if pooled_std > 0 else 0

    return {
        "test": "independent_t",
        "numeric_column": numeric_col,
        "group_column": group_col,
        "group_1": {"name": g1_name, "n": int(len(g1)), "mean": _round(g1.mean()), "std": _round(g1.std())},
        "group_2": {"name": g2_name, "n": int(len(g2)), "mean": _round(g2.mean()), "std": _round(g2.std())},
        "t_statistic": _round(t_stat),
        "p_value": _round(p_value, 6),
        "cohens_d": _round(cohens_d),
        "mean_difference": _round(g1.mean() - g2.mean()),
        "significant": bool(p_value < ALPHA),
    }


def t_test_paired(dataset, col_a, col_b):
    """
    Paired-samples t-test.

    Asks: when comparing two measurements FROM THE SAME ROW, is the difference
    significantly different from zero?
    Example: "Is blood pressure different before vs after treatment?"
    """
    df = data_service.load_dataframe(dataset)
    a = _clean_series(df, col_a)
    b = _clean_series(df, col_b)

    # Drop rows where either is missing — must have paired observations
    paired = df[[col_a, col_b]].dropna()
    if len(paired) < 2:
        raise ValueError("Need at least 2 paired observations")

    t_stat, p_value = stats.ttest_rel(paired[col_a], paired[col_b])

    differences = paired[col_a] - paired[col_b]
    cohens_d = differences.mean() / differences.std() if differences.std() > 0 else 0

    return {
        "test": "paired_t",
        "column_a": col_a,
        "column_b": col_b,
        "n_pairs": int(len(paired)),
        "mean_a": _round(paired[col_a].mean()),
        "mean_b": _round(paired[col_b].mean()),
        "mean_difference": _round(differences.mean()),
        "std_difference": _round(differences.std()),
        "t_statistic": _round(t_stat),
        "degrees_of_freedom": int(len(paired) - 1),
        "p_value": _round(p_value, 6),
        "cohens_d": _round(cohens_d),
        "significant": bool(p_value < ALPHA),
    }


# ============================================================================
# ANOVA
# ============================================================================

def anova_one_way(dataset, numeric_col, group_col):
    """
    One-way ANOVA.

    Asks: do any of these groups have different means from the others?
    Works when group_col has 3 or more unique values.

    Example: "Does satisfaction score differ between subscription tiers
    (Bronze / Silver / Gold / Platinum)?"

    If ANOVA is significant, you know SOME groups differ — but not WHICH.
    Use post-hoc tests (Tukey) to find specific differences. We return
    simple pairwise group statistics for the UI to display.
    """
    df = data_service.load_dataframe(dataset)

    if numeric_col not in df.columns or group_col not in df.columns:
        raise ValueError("Required column not found")
    if not pd.api.types.is_numeric_dtype(df[numeric_col]):
        raise ValueError(f"'{numeric_col}' is not numeric")

    clean = df[[numeric_col, group_col]].dropna()
    groups = clean[group_col].unique()

    if len(groups) < 2:
        raise ValueError(f"ANOVA needs 2+ groups; found {len(groups)}")

    # Build list of arrays (one per group) for scipy
    group_arrays = [clean[clean[group_col] == g][numeric_col].values for g in groups]

    f_stat, p_value = stats.f_oneway(*group_arrays)

    # Eta-squared (effect size): SS_between / SS_total
    # Tells you what fraction of the variance is explained by the grouping.
    grand_mean = clean[numeric_col].mean()
    ss_total = ((clean[numeric_col] - grand_mean) ** 2).sum()
    ss_between = sum(
        len(arr) * (arr.mean() - grand_mean) ** 2 for arr in group_arrays
    )
    eta_squared = ss_between / ss_total if ss_total > 0 else 0

    # Summarize each group
    group_stats = [
        {
            "name": str(g),
            "n": int(len(arr)),
            "mean": _round(arr.mean()),
            "std": _round(arr.std()),
        }
        for g, arr in zip(groups, group_arrays)
    ]

    k = len(groups)  # number of groups
    n = len(clean)   # total sample size

    return {
        "test": "one_way_anova",
        "numeric_column": numeric_col,
        "group_column": group_col,
        "n": int(n),
        "num_groups": int(k),
        "groups": group_stats,
        "f_statistic": _round(f_stat),
        "df_between": int(k - 1),
        "df_within": int(n - k),
        "p_value": _round(p_value, 6),
        "eta_squared": _round(eta_squared),
        "significant": bool(p_value < ALPHA),
    }


# ============================================================================
# Correlation
# ============================================================================

def correlation(dataset, col_a, col_b, method="pearson"):
    """
    Correlation between two numeric columns.

    Methods:
      - "pearson"  — linear correlation; assumes both variables are normal-ish
      - "spearman" — rank-based; robust to outliers + non-linear monotonic relationships
      - "kendall"  — also rank-based, smaller samples, less common

    r ranges from -1 to +1.
      Near +1 = strong positive (both go up together)
      Near -1 = strong negative (one up, one down)
      Near  0 = no linear relationship

    --- Strength rules of thumb (Cohen 1988) ---
      |r| < 0.1       negligible
      0.1–0.3         small
      0.3–0.5         medium
      > 0.5           large
    """
    df = data_service.load_dataframe(dataset)

    a = _clean_series(df, col_a)
    b = _clean_series(df, col_b)

    paired = df[[col_a, col_b]].dropna()
    if len(paired) < 3:
        raise ValueError("Need at least 3 paired observations")

    if method == "pearson":
        r, p = stats.pearsonr(paired[col_a], paired[col_b])
    elif method == "spearman":
        r, p = stats.spearmanr(paired[col_a], paired[col_b])
    elif method == "kendall":
        r, p = stats.kendalltau(paired[col_a], paired[col_b])
    else:
        raise ValueError(f"Unknown correlation method '{method}'")

    # Strength label
    abs_r = abs(r)
    if abs_r < 0.1:   strength = "negligible"
    elif abs_r < 0.3: strength = "small"
    elif abs_r < 0.5: strength = "medium"
    else:             strength = "large"

    direction = "positive" if r > 0 else "negative"

    return {
        "test": "correlation",
        "method": method,
        "column_a": col_a,
        "column_b": col_b,
        "n": int(len(paired)),
        "r": _round(r),
        "r_squared": _round(r ** 2),
        "p_value": _round(p, 6),
        "strength": strength,
        "direction": direction,
        "significant": bool(p < ALPHA),
    }


# ============================================================================
# Chi-square
# ============================================================================

def chi_square_independence(dataset, col_a, col_b):
    """
    Chi-square test of independence.

    Asks: are these two categorical columns related, or independent?
    Example: "Is survival independent of passenger class?"

    Returns the statistic, contingency table, and Cramér's V (effect size).
    """
    df = data_service.load_dataframe(dataset)

    for col in (col_a, col_b):
        if col not in df.columns:
            raise ValueError(f"Column '{col}' not found")

    clean = df[[col_a, col_b]].dropna()
    if len(clean) == 0:
        raise ValueError("No rows with both columns non-null")

    # Build the contingency table (rows = col_a values, cols = col_b values)
    contingency = pd.crosstab(clean[col_a], clean[col_b])

    if contingency.shape[0] < 2 or contingency.shape[1] < 2:
        raise ValueError("Chi-square needs 2+ categories in each column")

    chi2, p_value, dof, expected = stats.chi2_contingency(contingency)

    # Cramér's V (effect size for chi-square)
    n = contingency.values.sum()
    min_dim = min(contingency.shape) - 1
    cramers_v = np.sqrt(chi2 / (n * min_dim)) if min_dim > 0 else 0

    # Convert contingency table to a JSON-friendly dict
    table_dict = {
        "rows": list(contingency.index.astype(str)),
        "columns": list(contingency.columns.astype(str)),
        "values": contingency.values.tolist(),
    }

    return {
        "test": "chi_square_independence",
        "column_a": col_a,
        "column_b": col_b,
        "n": int(n),
        "chi2": _round(chi2),
        "degrees_of_freedom": int(dof),
        "p_value": _round(p_value, 6),
        "cramers_v": _round(cramers_v),
        "contingency_table": table_dict,
        "significant": bool(p_value < ALPHA),
    }
