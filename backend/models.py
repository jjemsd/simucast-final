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


class Dataset(db.Model):
    """
    A dataset file attached to a project.

    We store the file on disk and keep a reference (filename, path, metadata) here.
    We also cache column types and row count so we don't re-parse the file every time.
    """

    __tablename__ = "datasets"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False)

    # Original filename the user uploaded (e.g. "titanic.csv")
    original_filename = db.Column(db.String(200), nullable=False)

    # Where we stored it on disk (a safe, unique filename)
    storage_path = db.Column(db.String(500), nullable=False)

    # Cached metadata so we don't re-read the file every time
    row_count = db.Column(db.Integer)
    column_count = db.Column(db.Integer)

    # JSON string of column names and types, e.g. '{"age": "float", "name": "string"}'
    # We store as string because SQLite doesn't have a JSON column type.
    columns_info = db.Column(db.Text)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        import json
        return {
            "id": self.id,
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
            "created_at": self.created_at.isoformat(),
        }
