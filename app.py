#app.py
import os
import sys
import threading
import webbrowser

from flask import Flask


if getattr(sys, "frozen", False):
    os.chdir(os.path.dirname(sys.executable))


def _ensure_config():
    enc_path  = "config/settings.enc"
    json_path = "tools/config.json"

    if os.path.exists(enc_path):
        return

    print("⚠️  فایل settings.enc پیدا نشد - در حال ساخت...")

    if not os.path.exists(json_path):
        os.makedirs("tools", exist_ok=True)
        sample = {
            "FLASK_CONFIG": {"DEBUG": True, "HOST": "0.0.0.0", "PORT": 5080},
            "DATABASE_CONFIG": {
                "Server": "YOUR_SERVER", "Port": "1433", "dbName": "YOUR_DB",
                "dbUser": "YOUR_USER", "dbPassword": "YOUR_PASSWORD",
            },
            "COMPANY_CONFIG": {"name": "نام شرکت", "lat": 35.0, "lng": 51.0},
        }
        import json
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(sample, f, ensure_ascii=False, indent=4)
        print(f"❌ فایل {json_path} ساخته شد. اطلاعات دیتابیس رو پر کن و دوباره اجرا کن.")
        sys.exit(1)

    import json, base64
    from cryptography.fernet import Fernet
    from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
    from cryptography.hazmat.backends import default_backend

    PASSWORD = os.environ.get("CONFIG_PASSWORD", "kara.1464o")

    with open(json_path, "r", encoding="utf-8") as f:
        config = json.load(f)

    salt = os.urandom(16)
    kdf  = Scrypt(salt=salt, length=32, n=2**14, r=8, p=1, backend=default_backend())
    key  = base64.urlsafe_b64encode(kdf.derive(PASSWORD.encode()))
    encrypted = Fernet(key).encrypt(json.dumps(config, ensure_ascii=False).encode())

    os.makedirs("config", exist_ok=True)
    with open(enc_path, "wb") as f:
        f.write(salt + encrypted)

    print(f"✅ settings.enc از روی {json_path} ساخته شد")


_ensure_config()

from config.settings_loader import FLASK_CONFIG
from routes.customer_routes import customer_bp
from routes.api_routes import api_bp


def create_app() -> Flask:
    app = Flask(__name__)
    app.register_blueprint(customer_bp)
    app.register_blueprint(api_bp)

    @app.after_request
    def no_cache(resp):
        resp.headers.update({
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        })
        return resp

    return app


if __name__ == "__main__":
    app = create_app()
    threading.Timer(1.0, lambda: webbrowser.open(
        f"http://127.0.0.1:{FLASK_CONFIG.get('PORT', 5080)}"
    )).start()
    app.run(
        debug=FLASK_CONFIG.get("DEBUG", True),
        host=FLASK_CONFIG.get("HOST", "0.0.0.0"),
        port=FLASK_CONFIG.get("PORT", 5080),
        use_reloader=False,
    )