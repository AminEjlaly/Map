# routes/api_routes.py
import os
from flask import Blueprint, jsonify, send_from_directory, abort, request
import database.queries as db
from utils.photo_config import (
    get_photo_base_dir, 
    photo_route_url, 
    get_payment_photo_base_dir,
    payment_photo_route_url
)

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
    """سرویس تصاویر مشتری‌ها"""
    base_dir = get_photo_base_dir()
    if not base_dir or not os.path.isdir(base_dir):
        abort(404)
    return send_from_directory(base_dir, filename)


@api_bp.route("/api/payments")
def api_payments():
    """دریافت لیست پرداخت‌ها"""
    result = db.get_payments_with_status()
    
    # تبدیل مسیر تصاویر پرداخت‌ها
    if result.get('success'):
        for payment in result.get('pending', []):
            if payment.get('ImagePath'):
                payment['ImagePath'] = payment_photo_route_url(payment['ImagePath'])
        for payment in result.get('confirmed', []):
            if payment.get('ImagePath'):
                payment['ImagePath'] = payment_photo_route_url(payment['ImagePath'])
    
    return jsonify(result)


@api_bp.route("/api/confirm-payment", methods=['POST'])
def api_confirm_payment():
    """تایید یک پرداخت"""
    data = request.get_json()
    payment_id = data.get('payment_id')
    confirmed_by = data.get('confirmed_by', 'مدیر سیستم')
    
    if not payment_id:
        return jsonify({"success": False, "message": "شناسه پرداخت الزامی است"}), 400
    
    result = db.confirm_payment(payment_id, confirmed_by)
    return jsonify(result)


@api_bp.route("/payment-photos/<path:filename>")
def payment_photo(filename):
    """سرویس تصاویر پرداخت‌ها"""
    base_dir = get_payment_photo_base_dir()
    if not base_dir or not os.path.isdir(base_dir):
        abort(404)
    return send_from_directory(base_dir, filename)


@api_bp.route("/api/debug-visitor-locations")
def debug_visitor_locations():
    data = db.get_online_visitors_last_location()
    return jsonify({"count": len(data), "data": data})