from flask import Blueprint, render_template, Response, request
import database.queries as db
from services.map_service import customers_map

customer_bp = Blueprint("customer", __name__)


@customer_bp.route("/")
def index():
    return render_template("index.html")


@customer_bp.route("/map-frame")
def map_frame():
    city_code    = request.args.get("city") or None
    buyers       = db.get_all_buyers_with_location(city_code=city_code)
    visitor_locs = db.get_online_visitors_last_location()
    html         = customers_map(
        buyers,
        visitors_location=visitor_locs,
        zoom=12,
        fit_bounds=bool(city_code),
    )
    return Response(html, mimetype="text/html")