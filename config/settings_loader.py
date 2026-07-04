#config/setting_loader.py
import os
import sys
import json
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
from cryptography.hazmat.backends import default_backend


def resource_path(relative_path):
    """فقط برای فایل‌های read-only که داخل خود exe باندل شدن (مثل templates/static).
    هرگز برای فایل‌های خارجی/قابل‌تغییر مثل settings.enc استفاده نشه."""
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.abspath("."), relative_path)


def external_path(relative_path):
    """مسیر فایل‌های خارجی/قابل‌ویرایش (کنار exe یا کنار app.py در حالت dev).
    app.py موقع frozen بودن، cwd رو به پوشه‌ی exe تنظیم می‌کنه، پس همینجا
    کافیه از مسیر نسبی به cwd استفاده کنیم."""
    return os.path.abspath(relative_path)


def _derive_key(password: str, salt: bytes) -> bytes:
    kdf = Scrypt(salt=salt, length=32, n=2**14, r=8, p=1,
                 backend=default_backend())
    return base64.urlsafe_b64encode(kdf.derive(password.encode()))


def load_encrypted_config(file_path: str, password: str) -> dict:
    with open(file_path, "rb") as f:
        data = f.read()
    salt = data[:16]
    key = _derive_key(password, salt)
    decrypted = Fernet(key).decrypt(data[16:])
    return json.loads(decrypted.decode("utf-8"))


def _save_encrypted_config(config: dict, password: str, path: str):
    salt = os.urandom(16)
    key  = _derive_key(password, salt)
    encrypted = Fernet(key).encrypt(json.dumps(config, ensure_ascii=False).encode())
    with open(path, "wb") as f:
        f.write(salt + encrypted)


def update_company_config(name: str = None, lat: float = None, lng: float = None) -> dict:
    """به‌روزرسانی نام/موقعیت شرکت در حافظه و ذخیره در settings.enc.
    چون COMPANY_CONFIG یک دیکشنری مشترکه بین ماژول‌ها، تغییرش این‌جا
    بلافاصله روی جاهایی که ایمپورتش کردن (مثل map_service) هم اثر می‌ذاره."""
    try:
        if name is not None:
            COMPANY_CONFIG["name"] = name
        if lat is not None:
            COMPANY_CONFIG["lat"] = float(lat)
        if lng is not None:
            COMPANY_CONFIG["lng"] = float(lng)

        _SETTINGS["COMPANY_CONFIG"] = COMPANY_CONFIG
        _save_encrypted_config(_SETTINGS, _PASSWORD, _CONFIG_PATH)
        return {"success": True}
    except Exception as e:
        return {"success": False, "message": str(e)}

# ── بارگذاری ──────────────────────────────────────────────────────────────────
_PASSWORD    = os.environ.get("CONFIG_PASSWORD", "kara.1464o")
_CONFIG_PATH = external_path("config/settings.enc")   # ← اصلاح شد: دیگه از resource_path استفاده نمی‌کنه

_SETTINGS = load_encrypted_config(_CONFIG_PATH, _PASSWORD)

FLASK_CONFIG    = _SETTINGS["FLASK_CONFIG"]
DATABASE_CONFIG = _SETTINGS["DATABASE_CONFIG"]
COMPANY_CONFIG  = _SETTINGS["COMPANY_CONFIG"]