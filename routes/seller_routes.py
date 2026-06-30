# routes/seller_routes.py
from flask import Blueprint, request, render_template, jsonify
import database.queries as db
from services.map_service import base_map, visitor_path_map, visitor_animated_map
from utils.helpers import fa_to_en
from khayyam import JalaliDate

seller_bp = Blueprint("seller", __name__)


def _today_jalali() -> str:
    j = JalaliDate.today()
    return f"{j.year}/{j.month:02d}/{j.day:02d}"


def _shared_data():
    sellers = db.get_active_visitors()
    return dict(
        cities             = db.get_cities(),
        buyers             = [],
        selected_cities    = [],
        selected_customers = [],
        sellers            = sellers,
        sales_by_seller    = db.get_sales_by_seller([nof for nof, _ in sellers]),
        no_location        = False,
    )


@seller_bp.route("/seller-report")
def seller_report():
    code     = request.args.get("seller")
    date_str = fa_to_en(request.args.get("report_date", ""))

    visitor_code = None
    if code:
        try:
            visitor_code = int(code)
        except ValueError:
            pass

    locs = db.get_visitor_locations(
        visitor_code=visitor_code,
        report_date=date_str or None,
    )
    map_html = visitor_path_map(locs)
    return render_template("index.html", map_html=map_html, **_shared_data())


@seller_bp.route("/seller-last-location")
def seller_last_location():
    code     = request.args.get("seller")
    date_str = fa_to_en(request.args.get("report_date", ""))

    visitor_code = None
    if code:
        try:
            visitor_code = int(code)
        except ValueError:
            pass

    loc = db.get_visitor_last_location(
        visitor_code=visitor_code,
        report_date=date_str or None,
    )

    no_location = loc is None
    shared = _shared_data()
    shared["no_location"] = no_location

    if loc:
        try:
            lat = float(loc[1])
            lng = float(loc[2])
            # فعلاً از نقشه Neshan استفاده می‌کنیم
            from config.settings_loader import COMPANY_CONFIG
            center = [float(COMPANY_CONFIG["lat"]), float(COMPANY_CONFIG["lng"])]
            
            # نقشه ساده با دو نقطه
            script = f"""
            // مارکر شرکت
            L.marker([{center[0]}, {center[1]}], {{
              icon: L.divIcon({{ html: '<div style="width:32px;height:32px;background:#10B981;border:3px solid white;border-radius:50%;">🏢</div>' }})
            }}).addTo(map).bindPopup('<b>{COMPANY_CONFIG.get("name", "شرکت")}</b>');

            // مارکر فروشنده
            L.marker([{lat}, {lng}], {{
              icon: L.divIcon({{ html: '<div style="width:32px;height:32px;background:#EF4444;border:3px solid white;border-radius:50%;">👤</div>' }})
            }}).addTo(map).bindPopup('<b>{loc[0]}</b><br>تاریخ: {loc[4]}<br>ساعت: {loc[3]}');
            """
            map_html = base_map(zoom=15)  # بعداً بهتر می‌کنیم
            # فعلاً از base_map استفاده می‌کنیم تا بعداً تابع اختصاصی بسازیم
            map_html = map_html.replace(
                "center:  [", 
                f"center:  [{lat}, {lng}],"
            )  # تقریبی — بعداً دقیق‌تر می‌کنیم
        except:
            map_html = base_map()
    else:
        map_html = base_map()

    return render_template("index.html", map_html=map_html, **shared)

@seller_bp.route("/visitor_path_animated/<seller_code>")
def visitor_path_animated(seller_code):
    # بررسی اولیه در route هم انجام بده
    if seller_code == 'unknown' or str(seller_code).lower() == 'unknown':
        return render_template("index.html", map_html=base_map(), **_shared_data())
    
    date_str = fa_to_en(request.args.get("report_date", ""))
    
    try:
        visitor_code = int(seller_code)
    except (ValueError, TypeError):
        return render_template("index.html", map_html=base_map(), **_shared_data())
    
    locs = db.get_visitor_locations(
        visitor_code=visitor_code,  # حتماً int
        report_date=date_str or None,
    )
    
    map_html = visitor_animated_map(locs)
    return render_template("index.html", map_html=map_html, **_shared_data())

@seller_bp.route("/api/visitors-no-location")
def visitors_no_location():
    today = _today_jalali()
    missing = db.get_visitors_without_location_today(today)
    
    return jsonify({
        "date":     today,
        "count":    len(missing),
        "visitors": [{"code": r[0], "name": r[1]} for r in missing],
    })
    
    
def _shared_data():
    sellers = db.get_active_visitors()
    return dict(
        cities             = db.get_cities(),
        buyers             = [],
        selected_cities    = [],
        selected_customers = [],
        sellers            = sellers,
        sales_by_seller    = db.get_sales_by_seller([nof for nof, _ in sellers]),
        no_location        = False,
        all_buyers_json    = [],   # ← اضافه کن
    )