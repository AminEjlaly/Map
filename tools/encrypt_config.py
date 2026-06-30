import os
import json
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
from cryptography.hazmat.backends import default_backend

PASSWORD   = "kara.1464o"
INPUT_FILE = "tools/config.json"
OUTPUT_FILE = "config/settings.enc"


def encrypt(config: dict, password: str) -> bytes:
    salt = os.urandom(16)
    kdf  = Scrypt(salt=salt, length=32, n=2**14, r=8, p=1, backend=default_backend())
    key  = base64.urlsafe_b64encode(kdf.derive(password.encode()))
    return salt + Fernet(key).encrypt(json.dumps(config, ensure_ascii=False).encode())


def main():
    # خواندن فایل json
    if not os.path.exists(INPUT_FILE):
        print(f"❌ فایل {INPUT_FILE} پیدا نشد")
        return

    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        config = json.load(f)

    print("📋 تنظیمات خوانده شد:")
    print(f"   Server  : {config['DATABASE_CONFIG']['Server']}")
    print(f"   DB      : {config['DATABASE_CONFIG']['dbName']}")
    print(f"   Port    : {config['DATABASE_CONFIG']['Port']}")
    print(f"   Company : {config['COMPANY_CONFIG']['name']}")
    print(f"   Lat/Lng : {config['COMPANY_CONFIG']['lat']} / {config['COMPANY_CONFIG']['lng']}")

    # رمزگذاری
    os.makedirs("config", exist_ok=True)
    with open(OUTPUT_FILE, "wb") as f:
        f.write(encrypt(config, PASSWORD))

    print(f"\n✅ {OUTPUT_FILE} ساخته شد")
    print("⚠️  فایل config.json رو توی .gitignore بذار!")


if __name__ == "__main__":
    main()
