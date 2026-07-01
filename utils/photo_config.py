# utils/photo_config.py
import os

_PHOTO_BASE_PATH = os.path.join("config", "photo_base.txt")
_PAYMENT_PHOTO_BASE_PATH = os.path.join("config", "payment_photo_base.txt")


def get_photo_base_dir() -> str:
    """دریافت مسیر پایه تصاویر مشتری‌ها"""
    try:
        with open(_PHOTO_BASE_PATH, "r", encoding="utf-8") as f:
            return f.read().strip()
    except FileNotFoundError:
        return ""


def get_payment_photo_base_dir() -> str:
    """دریافت مسیر پایه تصاویر پرداخت‌ها"""
    try:
        with open(_PAYMENT_PHOTO_BASE_PATH, "r", encoding="utf-8") as f:
            return f.read().strip()
    except FileNotFoundError:
        return ""


def photo_route_url(photo_url: str) -> str:
    """از روی مقدار ذخیره‌شده در DB (مثلا /CustomerPhotos/xxx.jpeg) فقط اسم فایل رو
    برمی‌داره و آدرس روت داخلی فلاسک رو می‌سازه."""
    if not photo_url:
        return ""
    filename = os.path.basename(photo_url.replace("\\", "/"))
    return f"/customer-photos/{filename}"


def payment_photo_route_url(photo_url: str) -> str:
    """از روی مقدار ذخیره‌شده در DB (مثلا /PaymentPhotos/pay_xxx.jpeg) فقط اسم فایل رو
    برمی‌داره و آدرس روت داخلی فلاسک رو می‌سازه."""
    if not photo_url:
        return ""
    filename = os.path.basename(photo_url.replace("\\", "/"))
    return f"/payment-photos/{filename}"