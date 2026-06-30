from flask import Blueprint, jsonify
import database.queries as db

api_bp = Blueprint("api", __name__)


@api_bp.route("/api/visitors-status")
def visitors_status():
    visitors = db.get_visitors_with_status()
    return jsonify({"success": True, "visitors": visitors})