# ============================================================================
# models.py
# ============================================================================
# All our database tables in one file.
#
# Each class = one table. Each class attribute = one column.
# SQLAlchemy reads these classes and builds the CREATE TABLE SQL for us.
#
# Why one file instead of models/user.py, models/project.py, etc.?
# Because it's easier to see the whole schema at a glance. We can split
# later if it grows past ~500 lines.
# ============================================================================

from datetime import datetime
from database import db
from flask_login import UserMixin
import bcrypt


class User(db.Model, UserMixin):
    """
    A user account.

    UserMixin gives us helper methods Flask-Login needs, like is_authenticated.
    """

    __tablename__ = "users"

    # Primary key — auto-incrementing integer, unique per user
    id = db.Column(db.Integer, primary_key=True)

    # Login credentials
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(200), nullable=False)

    # Display name
    name = db.Column(db.String(80), nullable=False)

    # When the account was created (default = now)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship: one user has many projects.
    # backref="user" means a Project instance can do project.user to get its owner.
    # cascade="all, delete" means deleting a user also deletes their projects.
    projects = db.relationship(
        "Project", backref="user", lazy=True, cascade="all, delete"
    )

    # One user has many uploaded files (independent of projects).
    files = db.relationship(
        "File", backref="user", lazy=True, cascade="all, delete"
    )

    # --- Helper methods ---
    # These aren't columns — they're just Python methods on this class.

    def set_password(self, plain_password):
        """Hash a plain password and store the hash. Never store plain passwords."""
        # bcrypt expects bytes, so we encode the string
        hashed = bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt())
        self.password_hash = hashed.decode("utf-8")

    def check_password(self, plain_password):
        """Check if a plain password matches the stored hash."""
        return bcrypt.checkpw(
            plain_password.encode("utf-8"), self.password_hash.encode("utf-8")
        )

    def to_dict(self):
        """Convert to a dict for JSON responses. Never include password_hash!"""
        return {"id": self.id, "email": self.email, "name": self.name}


class Project(db.Model):
    """
    A SimuCast project — one dataset plus all analyses done on it.
    """

    __tablename__ = "projects"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.String(500))

    # Foreign key — links this project to a user
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # One project has one current dataset (the working copy, with all cleaning applied)
    datasets = db.relationship("Dataset", backref="project", lazy=True, cascade="all, delete")

    # One project has many timeline steps (import, clean, test, etc.)
    steps = db.relationship("Step", backref="project", lazy=True, cascade="all, delete")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class File(db.Model):
    """
    A file uploaded by a user. Phase B: Files are user-owned and independent
    from projects. The same File can back multiple Datasets (one per project
    that uses it).

    We store the actual bytes on disk at `storage_path` and cache metadata
    (rows, columns, dtypes) so we don't re-parse the file every time.
    """

    __tablename__ = "files"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    # Original filename the user uploaded (e.g. "titanic.csv")
    original_filename = db.Column(db.String(200), nullable=False)

    # Where we stored it on disk (a safe, unique filename)
    storage_path = db.Column(db.String(500), nullable=False)

    # Cached metadata
    row_count = db.Column(db.Integer)
    column_count = db.Column(db.Integer)

    # JSON string of column names and types, e.g. '{"age": "float", "name": "string"}'
    columns_info = db.Column(db.Text)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # One file can be attached to many datasets (one per project using it).
    # We DO NOT cascade-delete: deleting a File should be blocked or
    # explicitly cleaning up its datasets, and deleting a Dataset should
    # NOT remove the underlying File.
    datasets = db.relationship("Dataset", backref="file", lazy=True)

    def to_dict(self, project_count=None):
        import json
        d = {
            "id": self.id,
            "original_filename": self.original_filename,
            "row_count": self.row_count,
            "column_count": self.column_count,
            "columns_info": json.loads(self.columns_info) if self.columns_info else {},
            "created_at": self.created_at.isoformat(),
        }
        if project_count is not None:
            d["project_count"] = project_count
        return d


class Dataset(db.Model):
    """
    A dataset inside a project. Tied to a File (Phase B) which holds the
    actual bytes and metadata. For backward compatibility we still keep
    the file columns here; they mirror File during the migration.
    """

    __tablename__ = "datasets"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False)

    # Phase B: link to the File that holds the actual bytes.
    # Nullable so the migration can add the column to existing rows before
    # backfill runs. run_migrations() fills it in at startup.
    file_id = db.Column(db.Integer, db.ForeignKey("files.id"), nullable=True, index=True)

    # --- Legacy (mirror of File) ---
    # These still exist for older code paths. New code should read from
    # self.file.* instead when possible.
    original_filename = db.Column(db.String(200), nullable=False)
    storage_path = db.Column(db.String(500), nullable=False)
    row_count = db.Column(db.Integer)
    column_count = db.Column(db.Integer)
    columns_info = db.Column(db.Text)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        import json
        return {
            "id": self.id,
            "file_id": self.file_id,
            "original_filename": self.original_filename,
            "row_count": self.row_count,
            "column_count": self.column_count,
            "columns_info": json.loads(self.columns_info) if self.columns_info else {},
            "created_at": self.created_at.isoformat(),
        }


class Step(db.Model):
    """
    A single action in the project's timeline.

    Every meaningful operation (import, clean, compute variable, run test, etc.)
    gets a row here. The Timeline UI reads these to show history and do rollback.
    """

    __tablename__ = "steps"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False)

    # What kind of step (e.g. "import", "clean_missing", "recode", "t_test")
    step_type = db.Column(db.String(50), nullable=False)

    # Human-readable title (e.g. "Filled 12 missing values in age with mean")
    title = db.Column(db.String(300), nullable=False)

    # JSON string with step details (parameters used, rows affected, etc.)
    details = db.Column(db.Text)

    # Order in the timeline (0 = first step, 1 = second, etc.)
    # Makes rollback easy: "revert everything with order > N"
    order_index = db.Column(db.Integer, nullable=False)

    # If this step has been rolled back, mark it reverted instead of deleting
    # (so users can see the history of what they did).
    reverted = db.Column(db.Boolean, default=False)

    # Optional AI-generated "why" paragraph. Lazily filled in by the
    # /api/ai/explain-step endpoint — either automatically right after the
    # step runs (when the user's auto-explain preference is on) or
    # on-demand when the user clicks "Explain" in the Timeline.
    reasoning = db.Column(db.Text)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        import json
        return {
            "id": self.id,
            "step_type": self.step_type,
            "title": self.title,
            "details": json.loads(self.details) if self.details else {},
            "order_index": self.order_index,
            "reverted": self.reverted,
            "reasoning": self.reasoning,
            "created_at": self.created_at.isoformat(),
        }
