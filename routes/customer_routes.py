from flask import Blueprint, render_template, Response
import database.queries as db
from services.map_service import customers_map

customer_bp = Blueprint("customer", __name__)


@customer_bp.route("/")
def index():
    return render_template("index.html")


@customer_bp.route("/map-frame")
def map_frame():
    buyers       = db.get_all_buyers_with_location()
    visitor_locs = db.get_online_visitors_last_location()
    html         = customers_map(buyers, visitors_location=visitor_locs, zoom=12)
    return Response(html, mimetype="text/html")