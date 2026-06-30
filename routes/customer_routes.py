from flask import Blueprint, render_template
import database.queries as db
from services.map_service import customers_map

customer_bp = Blueprint("customer", __name__)


@customer_bp.route("/")
def index():
    buyers   = db.get_all_buyers_with_location()
    map_html = customers_map(buyers, zoom=12)
    return render_template("index.html", map_html=map_html)