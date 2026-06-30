import os
import sys
import json
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
from cryptography.hazmat.backends import default_backend


def resource_path(relative_path):
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.abspath("."), relative_path)


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


# ── بارگذاری ──────────────────────────────────────────────────────────────────
_PASSWORD    = os.environ.get("CONFIG_PASSWORD", "kara.1464o")
_CONFIG_PATH = resource_path("config/settings.enc")

_SETTINGS = load_encrypted_config(_CONFIG_PATH, _PASSWORD)

FLASK_CONFIG    = _SETTINGS["FLASK_CONFIG"]
DATABASE_CONFIG = _SETTINGS["DATABASE_CONFIG"]
COMPANY_CONFIG  = _SETTINGS["COMPANY_CONFIG"]