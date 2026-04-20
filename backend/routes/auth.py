# ============================================================================
# routes/auth.py
# ============================================================================
# Handles login, register, logout, and "who am I?"
#
# Flow of a login request:
#   1. Frontend sends POST /api/auth/login with email + password
#   2. We look up the user by email
#   3. We check the password with bcrypt
#   4. If valid, Flask-Login stores the user's ID in a session cookie
#   5. Browser sends that cookie back on every future request automatically
# ============================================================================

from flask import Blueprint, request, jsonify
from flask_login import login_user, logout_user, login_required, current_user

from database import db
from models import User

# Create a blueprint. The name "auth" is used internally by Flask for routing.
bp = Blueprint("auth", __name__)


@bp.route("/register", methods=["POST"])
def register():
    """
    POST /api/auth/register
    Body: { "email": "...", "password": "...", "name": "..." }
    """
    # request.json gives us the parsed JSON body as a Python dict
    data = request.json or {}

    # Pull out the fields we need, with defaults so .get() never crashes
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    name = data.get("name", "").strip()

    # --- Basic validation ---
    if not email or not password or not name:
        return jsonify({"error": "Email, password, and name are required"}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    # Check if email already exists
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 400

    # --- Create the user ---
    user = User(email=email, name=name)
    user.set_password(password)  # This hashes the password before storing

    db.session.add(user)
    db.session.commit()

    # Log them in immediately after registering
    login_user(user)

    return jsonify({"user": user.to_dict()}), 201


@bp.route("/login", methods=["POST"])
def login():
    """
    POST /api/auth/login
    Body: { "email": "...", "password": "..." }
    """
    data = request.json or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    # Find the user
    user = User.query.filter_by(email=email).first()

    # If no user OR wrong password, return the same error message
    # (so attackers can't tell which emails are registered).
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid email or password"}), 401

    # Log them in — this sets the session cookie
    login_user(user)

    return jsonify({"user": user.to_dict()})


@bp.route("/logout", methods=["POST"])
@login_required  # Must be logged in to log out
def logout():
    """POST /api/auth/logout — clears the session."""
    logout_user()
    return jsonify({"ok": True})


@bp.route("/me", methods=["GET"])
@login_required
def me():
    """
    GET /api/auth/me
    Returns the currently logged-in user. The frontend calls this on load
    to check if there's already an active session.
    """
    return jsonify({"user": current_user.to_dict()})
