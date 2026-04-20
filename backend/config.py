# ============================================================================
# config.py
# ============================================================================
# Single source of truth for all settings. Reads the .env file once
# and exposes values as Python constants we can import anywhere.
#
# Usage elsewhere:
#   from config import Config
#   print(Config.DATABASE_URL)
#
# Why not scatter os.environ.get() calls all over the code?
# Because then you have no single place to see all the settings,
# and typos silently break things.
# ============================================================================

import os
from dotenv import load_dotenv

# load_dotenv() reads the .env file and sets each line as an environment
# variable. We call it ONCE here at import time.
load_dotenv()


class Config:
    """
    All app settings in one class.

    Using a class (instead of top-level variables) is a Flask convention.
    It makes it easy to later add e.g. TestConfig(Config) for running tests
    against a different database.
    """

    # --- Flask ---
    # The secret key signs session cookies. If it changes, everyone gets logged out.
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")

    # Debug flag. Read as a string from .env, so we compare to "True".
    DEBUG = os.environ.get("FLASK_DEBUG", "False") == "True"

    # --- Database ---
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", "sqlite:///simucast.db")

    # Turn off a SQLAlchemy feature we don't need (it spams warnings otherwise).
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # --- Uploads ---
    # Max upload size in BYTES (Flask uses bytes). We read MB from env
    # and multiply by 1024*1024.
    MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", "50"))
    MAX_CONTENT_LENGTH = MAX_UPLOAD_MB * 1024 * 1024

    # Where uploaded files get saved on disk.
    # __file__ is this config.py file's path. We go up one level and into /uploads.
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")

    # --- AI ---
    ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

    # Which Claude model to use. Sonnet is a good speed/quality balance.
    CLAUDE_MODEL = "claude-sonnet-4-20250514"
