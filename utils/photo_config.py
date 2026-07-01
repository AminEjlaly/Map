import os

_PHOTO_BASE_PATH = os.path.join("config", "photo_base.txt")


def get_photo_base_dir() -> str:
    try:
        with open(_PHOTO_BASE_PATH, "r", encoding="utf-8") as f:
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