# ============================================================================
# routes/reports.py
# ============================================================================
# Endpoints for saving report items and exporting PDF/DOCX.
# ============================================================================

from flask import Blueprint, request, jsonify, Response
from flask_login import login_required, current_user

from models import Project
from services import report_service

bp = Blueprint("reports", __name__)


def _get_project_owned(project_id):
    return Project.query.filter_by(id=project_id, user_id=current_user.id).first()


def _safe_filename(name):
    """Strip characters that break Content-Disposition headers."""
    import re
    return re.sub(r"[^\w\-. ]", "_", name)[:80] or "report"


# ============================================================================
# Saved report items
# ============================================================================

@bp.route("/<int:project_id>/items", methods=["POST"])
@login_required
def save_item(project_id):
    """
    POST /api/reports/<project_id>/items
    Body: { "kind": "t_test", "title": "...", "data": {...} }
    """
    project = _get_project_owned(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404

    data = request.json or {}
    kind = data.get("kind")
    title = data.get("title", "Untitled")
    payload = data.get("data", {})

    if not kind:
        return jsonify({"error": "Missing 'kind'"}), 400

    step = report_service.save_report_item(project, kind, title, payload)
    return jsonify({"step": step.to_dict()}), 201


@bp.route("/<int:project_id>/items", methods=["GET"])
@login_required
def list_items(project_id):
    """GET /api/reports/<project_id>/items — list everything currently in the report."""
    project = _get_project_owned(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404

    items = report_service.list_report_items(project)
    return jsonify({"items": items})


@bp.route("/items/<int:step_id>", methods=["DELETE"])
@login_required
def delete_item(step_id):
    """DELETE /api/reports/items/<step_id> — remove a saved item from the report."""
    try:
        report_service.delete_report_item(step_id, current_user.id)
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    return jsonify({"ok": True})


# ============================================================================
# Export — PDF / DOCX download
# ============================================================================

@bp.route("/<int:project_id>/export/pdf", methods=["GET"])
@login_required
def export_pdf(project_id):
    """GET /api/reports/<project_id>/export/pdf — streams the generated PDF."""
    project = _get_project_owned(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404

    try:
        pdf_bytes = report_service.generate_pdf(project)
    except Exception as e:
        return jsonify({"error": f"PDF generation failed: {str(e)}"}), 500

    filename = f"{_safe_filename(project.name)}_simucast_report.pdf"
    return Response(
        pdf_bytes,
        mimetype="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@bp.route("/<int:project_id>/export/docx", methods=["GET"])
@login_required
def export_docx(project_id):
    """GET /api/reports/<project_id>/export/docx — streams the generated Word doc."""
    project = _get_project_owned(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404

    try:
        docx_bytes = report_service.generate_docx(project)
    except Exception as e:
        return jsonify({"error": f"DOCX generation failed: {str(e)}"}), 500

    filename = f"{_safe_filename(project.name)}_simucast_report.docx"
    return Response(
        docx_bytes,
        mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
