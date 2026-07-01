import os
from flask import Blueprint, jsonify, send_from_directory, abort
import database.queries as db
from utils.photo_config import get_photo_base_dir, photo_route_url

api_bp = Blueprint("api", __name__)


@api_bp.route("/api/visitors-status")
def visitors_status():
    visitors = db.get_visitors_with_status()
    return jsonify({"success": True, "visitors": visitors})


@api_bp.route("/api/new-customers")
def new_customers():
    customers = db.get_new_customers()
    for c in customers:
        for p in c["photos"]:
            p["url"] = photo_route_url(p["url"])
    return jsonify({"success": True, "customers": customers})


@api_bp.route("/customer-photos/<path:filename>")
def customer_photo(filename):
    base_dir = get_photo_base_dir()
    if not base_dir or not os.path.isdir(base_dir):
        abort(404)
    return send_from_directory(base_dir, filename)


@api_bp.route("/api/debug-visitor-locations")
def debug_visitor_locations():
    data = db.get_online_visitors_last_location()
    return jsonify({"count": len(data), "data": data})