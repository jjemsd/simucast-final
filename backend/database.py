# ============================================================================
# database.py
# ============================================================================
# Creates the SQLAlchemy `db` object that the rest of the app imports.
#
# Why is this in its own file?
# If we put `db = SQLAlchemy()` in app.py and then models.py imports it,
# AND app.py imports models.py, we get a circular import. Putting `db`
# in its own small file breaks the cycle.
#
# Flow:
#   database.py defines db → models.py uses db → app.py connects db to Flask
# ============================================================================

from flask_sqlalchemy import SQLAlchemy

# The `db` object is our connection to the database.
# We'll use it everywhere: db.Column(), db.session.add(), db.session.commit(), etc.
db = SQLAlchemy()


def init_db(app):
    """
    Connect the db object to our Flask app and create tables if missing.

    Called once from app.py at startup.
    `app.app_context()` is Flask's way of saying "we're working with THIS app
    right now" — SQLAlchemy needs it to know which database config to use.
    """
    db.init_app(app)
    with app.app_context():
        db.create_all()  # Creates any tables that don't exist yet
