"""
services/map_service.py  –  نقشه نشان + مارکر مشتری‌ها
"""

from config.settings_loader import COMPANY_CONFIG

NESHAN_KEY = "web.ae337d64d1d049c58c496982bcf84a58"

_NESHAN_HEAD = """
  <link rel="stylesheet" href="https://static.neshan.org/sdk/leaflet/v1.9.4/neshan-sdk/v1.0.8/index.css"/>
  <script src="https://static.neshan.org/sdk/leaflet/v1.9.4/neshan-sdk/v1.0.8/index.js"></script>
"""

_BASE_STYLE = """
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:100%; height:100%; overflow:hidden; }
    #map { width:100%; height:100%; }
    .leaflet-popup-content-wrapper {
      border-radius: 10px !important;
      font-family: Tahoma, sans-serif;
      direction: rtl;
      box-shadow: 0 4px 16px rgba(0,0,0,.2) !important;
    }
    .leaflet-popup-content { margin: 10px 14px !important; }
    .leaflet-popup-tip { background: white; }
  </style>
"""


def _company_coords():
    return COMPANY_CONFIG["lat"], COMPANY_CONFIG["lng"]


def _wrap_html(body_script: str, zoom: int = 14, center=None) -> str:
    lat, lng = center or _company_coords()
    return f"""<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0">
  {_NESHAN_HEAD}
  {_BASE_STYLE}
</head>
<body>
  <div id="map"></div>
  <script>
  (function() {{
    var map = new L.Map('map', {{
      key:     "{NESHAN_KEY}",
      maptype: "dreamy",
      center:  [{lat}, {lng}],
      zoom:    {zoom},
      zoomControl: false
    }});
    L.control.zoom({{ position: 'bottomright' }}).addTo(map);

    {body_script}
  }})();
  </script>
</body>
</html>"""


def _company_marker_js():
    lat, lng = _company_coords()
    name = COMPANY_CONFIG.get("name", "شرکت")
    return f"""
    L.marker([{lat}, {lng}], {{
      icon: L.divIcon({{
        html: '<div style="width:32px;height:32px;background:#10B981;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(16,185,129,.6);display:flex;align-items:center;justify-content:center;"><svg fill="white" viewBox="0 0 24 24" width="16" height="16"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg></div>',
        iconSize: [32, 32], iconAnchor: [16, 16]
      }})
    }}).addTo(map).bindPopup('<b>{name}</b>');
    """



def _customer_marker_js(lat, lng, name, code, tel, mandeh):
    is_debt   = mandeh > 0
    color     = "#EF4444" if is_debt else "#10B981"
    color_dk  = "#B91C1C" if is_debt else "#047857"
    bg_light  = "#FEF2F2" if is_debt else "#F0FDF4"
    status    = "بدهکار" if is_debt else "تسویه"

    safe_name = str(name).replace("\\", "\\\\").replace("`", "'").replace("'", "\\'")
    safe_tel  = str(tel or "ثبت نشده").replace("\\", "\\\\").replace("`", "'").replace("'", "\\'")
    mandeh_fmt = f"{abs(mandeh):,}"
    initial = safe_name[:1] if safe_name else "؟"

    return f"""
    L.marker([{lat}, {lng}], {{
      icon: L.divIcon({{
        className: '',
        html: `<div style="position:relative;width:22px;height:22px">
                 <div style="position:relative;width:22px;height:22px;background:{color};border:2px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center">
                   <svg viewBox="0 0 24 24" fill="white" width="10" height="10"><path d="M12 12c2.7 0 8 1.34 8 4v2H4v-2c0-2.66 5.3-4 8-4zm0-2a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg>
                 </div>
               </div>`,
        iconSize:   [22, 22],
        iconAnchor: [11, 11]
      }})
    }}).addTo(map).bindPopup(`
      <div style="min-width:190px;font-family:Tahoma,sans-serif">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #f1f5f9">
          <div style="width:34px;height:34px;border-radius:9px;background:{bg_light};color:{color_dk};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0">
            {initial}
          </div>
          <div style="min-width:0">
            <div style="font-weight:700;font-size:13px;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{safe_name}</div>
            <div style="font-size:11px;color:#94a3b8">کد: {code}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;color:#64748b;margin-bottom:6px">
          <span>📞 تلفن</span>
          <span style="color:#334155;font-weight:600">{safe_tel}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;background:{bg_light};border-radius:8px;padding:7px 10px;margin-top:4px">
          <span style="font-size:11px;color:{color_dk};font-weight:700">{status}</span>
          <span style="font-size:13px;color:{color_dk};font-weight:800">{mandeh_fmt} تومان</span>
        </div>
      </div>
    `);
    """


def customers_map(buyers: list, zoom: int = 12) -> str:
    """نقشه + مارکر شرکت + مارکر همه مشتری‌ها (کلیک = نام/کد/تلفن/مانده)"""
    markers_js = [_company_marker_js()]

    for b in buyers:
        try:
            lat = float(b["Lat"]); lng = float(b["Lng"])
        except (TypeError, ValueError, KeyError):
            continue
        markers_js.append(_customer_marker_js(
            lat, lng,
            b.get("Name", ""), b.get("BuyerCode", ""),
            b.get("Tel", ""), int(b.get("Mandeh") or 0),
        ))

    return _wrap_html("\n".join(markers_js), zoom=zoom)

def base_map(zoom: int = 14) -> str:
    """نقشه پایه - فقط مارکر شرکت (فعلاً استفاده نمیشه، برای آینده نگه داشته شد)"""
    return _wrap_html(_company_marker_js(), zoom=zoom)