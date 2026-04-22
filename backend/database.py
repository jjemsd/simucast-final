# ============================================================================
# database.py
# ============================================================================
# Creates the SQLAlchemy `db` object that the rest of the app imports.
#
# Flow:
#   database.py defines db → models.py uses db → app.py connects db to Flask
#
# Why is this in its own file?
# If we put `db = SQLAlchemy()` in app.py and then models.py imports it,
# AND app.py imports models.py, we get a circular import. Putting `db`
# in its own small file breaks the cycle.
# ============================================================================

from sqlalchemy import inspect, text
from flask_sqlalchemy import SQLAlchemy

# The `db` object is our connection to the database.
db = SQLAlchemy()


def init_db(app):
    """
    Connect the db object to our Flask app, create missing tables, and
    run any lightweight schema migrations.

    Called once from app.py at startup.
    """
    db.init_app(app)
    with app.app_context():
        db.create_all()          # creates any tables that don't exist yet
        run_migrations()         # adds missing columns + backfills new rows


def run_migrations():
    """
    Tiny, hand-rolled migration runner.

    We deliberately don't use Alembic for this student project — it adds a
    whole other tool to learn. Instead, for each change we make to the
    schema, we:
      1) check if the column/table already looks migrated (via SQLAlchemy's
         inspector), and if so do nothing
      2) otherwise run a single ALTER TABLE or backfill query

    This is safe to call on every startup: each step is a no-op when it's
    already been applied.
    """

    # Import inside the function to avoid circular imports
    # (models.py imports `db` from this file).
    from models import Dataset, File

    inspector = inspect(db.engine)

    # --- Step 1: add datasets.file_id if it doesn't exist yet ---------------
    # Fresh databases created via db.create_all() will already have this
    # column because it's declared on the Dataset model. We only hit the
    # ALTER TABLE branch for databases that predate Phase B.
    dataset_columns = {c["name"] for c in inspector.get_columns("datasets")}
    if "file_id" not in dataset_columns:
        with db.engine.connect() as conn:
            # Add the column with no FK constraint — SQLite can't add FKs
            # after the fact, and Postgres will accept the column either way.
            conn.execute(text("ALTER TABLE datasets ADD COLUMN file_id INTEGER"))
            conn.commit()

    # --- Step 2: for every legacy Dataset (file_id NULL), create a File ------
    # This copies the dataset's cached metadata + storage_path into a new
    # File row and links them. Safe to re-run — we only touch rows with
    # file_id IS NULL.
    orphan_datasets = Dataset.query.filter(Dataset.file_id.is_(None)).all()
    for ds in orphan_datasets:
        # user_id comes from the owning project.
        if ds.project is None:
            continue  # shouldn't happen, but skip defensively

        file = File(
            user_id=ds.project.user_id,
            original_filename=ds.original_filename,
            storage_path=ds.storage_path,
            row_count=ds.row_count,
            column_count=ds.column_count,
            columns_info=ds.columns_info,
            created_at=ds.created_at,
        )
        db.session.add(file)
        db.session.flush()         # populates file.id without committing
        ds.file_id = file.id

    if orphan_datasets:
        db.session.commit()
