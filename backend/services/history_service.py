# ============================================================================
# services/history_service.py
# ============================================================================
# Rollback logic for the Session Timeline.
#
# How rollback works (Mode 1: "Roll back to before this step"):
#   Given a target step N:
#     1. Find all steps with order_index >= N (the target + everything after)
#     2. For each of those steps, if it created a Dataset, delete the Dataset
#        (which also deletes the CSV file on disk via SQLAlchemy cascade)
#     3. Mark each of those steps as reverted = True
#   Result: the "current dataset" is now the one that existed BEFORE step N.
#
# We keep the reverted steps in the timeline (not deleted) so the user can see
# the history of what they did. The UI shows them greyed out with strike-through.
# ============================================================================

import os
import json

from database import db
from models import Step, Dataset, Project


def rollback_to_step(project, step_id):
    """
    Revert the given step AND everything after it in the project's timeline.

    Returns:
        A dict summarizing what was reverted:
        { "reverted_count": 3, "current_dataset_id": 12 }

    Raises:
        ValueError if the step doesn't belong to this project or is already reverted.
    """
    # --- Find the target step ---
    target = Step.query.get(step_id)
    if not target or target.project_id != project.id:
        raise ValueError("Step not found")

    if target.reverted:
        raise ValueError("This step has already been reverted")

    # --- Find all steps from the target onward (ordered by timeline position) ---
    steps_to_revert = Step.query.filter(
        Step.project_id == project.id,
        Step.order_index >= target.order_index,
        Step.reverted == False,  # noqa: E712 — SQLAlchemy needs ==, not `is`
    ).all()

    reverted_count = 0
    for step in steps_to_revert:
        # --- Parse step details (stored as JSON string) ---
        details = json.loads(step.details) if step.details else {}
        new_dataset_id = details.get("new_dataset_id")

        # --- If this step created a dataset, delete that dataset + its file ---
        if new_dataset_id:
            ds = Dataset.query.get(new_dataset_id)
            if ds:
                # Best-effort file cleanup — don't crash if already missing
                try:
                    if os.path.exists(ds.storage_path):
                        os.remove(ds.storage_path)
                except OSError:
                    pass
                db.session.delete(ds)

        # --- Mark the step reverted (keep the row for history) ---
        step.reverted = True
        reverted_count += 1

    db.session.commit()

    # --- Figure out the new "current" dataset ---
    # It's the latest Dataset still attached to the project
    remaining_datasets = Dataset.query.filter_by(project_id=project.id) \
        .order_by(Dataset.created_at.desc()).all()
    current_id = remaining_datasets[0].id if remaining_datasets else None

    return {
        "reverted_count": reverted_count,
        "current_dataset_id": current_id,
    }
