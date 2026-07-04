# config/ui_settings.py
import os
import json

_UI_SETTINGS_PATH = os.path.join("config", "ui_settings.json")

DEFAULT_UI_SETTINGS = {
    "accentColor":  "#c9a84c",   # طلایی - رنگ اصلی
    "panelBgColor": "#080e20",   # پس‌زمینه پنل
    "successColor": "#22c55e",   # سبز - وضعیت آنلاین/تسویه
}


def get_ui_settings() -> dict:
    try:
        with open(_UI_SETTINGS_PATH, "r", encoding="utf-8") as f:
            saved = json.load(f)
        settings = DEFAULT_UI_SETTINGS.copy()
        settings.update(saved)
        return settings
    except (FileNotFoundError, json.JSONDecodeError):
        return DEFAULT_UI_SETTINGS.copy()


def save_ui_settings(data: dict) -> dict:
    try:
        current = get_ui_settings()
        for key in ("accentColor", "panelBgColor", "successColor"):
            if data.get(key):
                current[key] = data[key]

        os.makedirs("config", exist_ok=True)
        with open(_UI_SETTINGS_PATH, "w", encoding="utf-8") as f:
            json.dump(current, f, ensure_ascii=False, indent=4)

        return {"success": True, "settings": current}
    except Exception as e:
        return {"success": False, "message": str(e)}


def reset_ui_settings() -> dict:
    try:
        if os.path.exists(_UI_SETTINGS_PATH):
            os.remove(_UI_SETTINGS_PATH)
        return {"success": True, "settings": DEFAULT_UI_SETTINGS.copy()}
    except Exception as e:
        return {"success": False, "message": str(e)}