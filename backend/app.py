# ============================================================================
# app.py
# ============================================================================
# The Flask application entry point. Running `python app.py` starts the server.
#
# This file is small on purpose — it just wires things together:
#   1. Create the Flask app
#   2. Load config
#   3. Connect the database
#   4. Enable CORS (so frontend can call us)
#   5. Set up Flask-Login
#   6. Register each blueprint (routes)
#   7. Start the server
# ============================================================================

from flask import Flask
from flask_cors import CORS
from flask_login import LoginManager
from werkzeug.middleware.proxy_fix import ProxyFix

from config import Config
from database import db, init_db
from models import User

# --- Import all route blueprints ---
# Each route file exports a `bp` variable (short for "blueprint").
# Blueprints are Flask's way of grouping related routes together.
from routes.auth import bp as auth_bp
from routes.projects import bp as projects_bp
from routes.data import bp as data_bp
from routes.clean import bp as clean_bp
from routes.expand import bp as expand_bp
from routes.synthetic import bp as synthetic_bp
from routes.stats import bp as stats_bp
from routes.tests import bp as tests_bp
from routes.models import bp as models_bp
from routes.whatif import bp as whatif_bp
from routes.history import bp as history_bp
from routes.ai import bp as ai_bp
from routes.reports import bp as reports_bp


def create_app():
    """
    Build and configure the Flask app.

    This is called the "application factory" pattern. It lets us create
    multiple app instances (e.g. for tests) with different configs.
    """

    # --- Step 1: Create the app ---
    app = Flask(__name__)

    # --- Step 2: Load config ---
    # from_object() copies all uppercase attributes from Config into app.config
    app.config.from_object(Config)

    # On Render the app sits behind a TLS-terminating proxy. ProxyFix reads
    # X-Forwarded-* headers so request.is_secure / url scheme are correct
    # and Secure cookies are set reliably.
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

    # --- Step 3: Make sure uploads folder exists ---
    import os
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # --- Step 4: Connect the database ---
    init_db(app)

    # --- Step 5: Enable CORS ---
    # Our frontend runs on localhost:5173 (Vite's default port).
    # Without this, the browser blocks API calls from there to localhost:5000.
    # supports_credentials=True lets us send session cookies.
    # Render's blueprint exposes hostnames without a scheme; prepend https://
    # so the CORS allowlist matches what browsers actually send.
    def _normalize_origin(o: str) -> str:
        o = o.strip()
        if o and not o.startswith("http://") and not o.startswith("https://"):
            o = "https://" + o
        return o

    raw_origins = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173").split(",")
    origins = [_normalize_origin(o) for o in raw_origins if o.strip()]
    CORS(app, supports_credentials=True, origins=origins)

    # --- Step 6: Set up Flask-Login ---
    login_manager = LoginManager()
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(user_id):
        """
        Flask-Login calls this on every request to look up the current user
        from the session cookie.
        """
        return User.query.get(int(user_id))

    @login_manager.unauthorized_handler
    def unauthorized():
        """
        What to send when someone hits a protected route without being logged in.
        Default is an HTML redirect — we want JSON since we're an API.
        """
        from flask import jsonify
        return jsonify({"error": "Login required"}), 401

    # --- Step 7: Register all route blueprints ---
    # The url_prefix means every route inside auth.py is mounted at /api/auth/...
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(projects_bp, url_prefix="/api/projects")
    app.register_blueprint(data_bp, url_prefix="/api/data")
    app.register_blueprint(clean_bp, url_prefix="/api/clean")
    app.register_blueprint(expand_bp, url_prefix="/api/expand")
    app.register_blueprint(synthetic_bp, url_prefix="/api/synthetic")
    app.register_blueprint(stats_bp, url_prefix="/api/stats")
    app.register_blueprint(tests_bp, url_prefix="/api/tests")
    app.register_blueprint(models_bp, url_prefix="/api/models")
    app.register_blueprint(whatif_bp, url_prefix="/api/whatif")
    app.register_blueprint(history_bp, url_prefix="/api/history")
    app.register_blueprint(ai_bp, url_prefix="/api/ai")
    app.register_blueprint(reports_bp, url_prefix="/api/reports")

    # --- Simple health check route ---
    # Useful for testing the server is alive: curl localhost:5000/
    @app.route("/")
    def health():
        return {"status": "ok", "app": "SimuCast API"}

    return app


# This block only runs when we execute `python app.py` directly
# (not when the file is imported by something else).
if __name__ == "__main__":
    app = create_app()
    # host=0.0.0.0 makes the server reachable from other devices on your network.
    # Use host="127.0.0.1" if you want it only on this machine.
    app.run(host="0.0.0.0", port=5000, debug=app.config["DEBUG"])
