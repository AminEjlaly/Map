"""
services/map_service.py  –  نقشه نشان + مارکرهای pin/teardrop
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
      border-radius: 14px !important;
      font-family: Tahoma, sans-serif;
      direction: rtl;
      box-shadow: 0 8px 32px rgba(0,0,0,.18) !important;
      padding: 0 !important;
      overflow: hidden;
      border: none !important;
    }
    .leaflet-popup-content { margin: 0 !important; }
    .leaflet-popup-tip-container { display:none; }
  </style>
"""


def _company_coords():
    return COMPANY_CONFIG["lat"], COMPANY_CONFIG["lng"]


def _pin_html(circle_color, border_color, circle_size, tip_w, tip_h, inner_html, badge_html=""):
    """
    شکل pin: دایره بالا + مثلث نوک‌دار پایین
    circle_size: قطر دایره px
    tip_w: نصف عرض مثلث px
    tip_h: ارتفاع مثلث px
    """
    return (
        f'<div style="display:flex;flex-direction:column;align-items:center;'
        f'filter:drop-shadow(0 4px 8px rgba(0,0,0,.35));position:relative">'
        f'  <div style="width:{circle_size}px;height:{circle_size}px;background:{circle_color};'
        f'border:2.5px solid {border_color};border-radius:50%;'
        f'display:flex;align-items:center;justify-content:center;position:relative">'
        f'    {inner_html}'
        f'    {badge_html}'
        f'  </div>'
        f'  <div style="width:0;height:0;'
        f'border-left:{tip_w}px solid transparent;'
        f'border-right:{tip_w}px solid transparent;'
        f'border-top:{tip_h}px solid {circle_color};'
        f'margin-top:-1px"></div>'
        f'</div>'
    )

_flag_svg = (
    '<svg viewBox="0 0 24 24" fill="white" width="15" height="15">'
    '<path d="M5 3v18h2v-7h10l-2-4 2-4H7V3H5z"/></svg>'
)

_PICK_MARKER_ICON = _pin_html(
    circle_color="#f59e0b",
    border_color="white",
    circle_size=34,
    tip_w=8,
    tip_h=12,
    inner_html=_flag_svg,
)
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
    window.customerMarkers = [];

    var map = new L.Map('map', {{
      key:     "{NESHAN_KEY}",
      maptype: "dreamy",
      center:  [{lat}, {lng}],
      zoom:    {zoom},
      zoomControl: false
    }});
    L.control.zoom({{ position: 'bottomright' }}).addTo(map);
    window.neshanMap = map;

    // ── حالت انتخاب موقعیت (برای تنظیمات عمومی) ──
    window._pickMarker = null;

    function _sendPickedLocation(lat, lng) {{
      window.parent.postMessage({{ type: 'locationPicked', lat: lat, lng: lng }}, '*');
    }}

    function _placePickMarker(latlng) {{
      var pinHtml = `{_PICK_MARKER_ICON}`;
      if (window._pickMarker) {{
        window._pickMarker.setLatLng(latlng);
      }} else {{
        window._pickMarker = L.marker(latlng, {{
          draggable: true,
          zIndexOffset: 3000,
          icon: L.divIcon({{
            className: '',
            html: pinHtml,
            iconSize:   [36, 49],
            iconAnchor: [18, 49]
          }})
        }}).addTo(map).bindPopup('موقعیت انتخابی شرکت');
        window._pickMarker.on('dragend', function(e) {{
          var ll = e.target.getLatLng();
          _sendPickedLocation(ll.lat, ll.lng);
        }});
      }}
    }}

    map.on('click', function(e) {{
      if (!map._pickModeOn) return;
      _placePickMarker(e.latlng);
      _sendPickedLocation(e.latlng.lat, e.latlng.lng);
    }});

    window.addEventListener('message', function(ev) {{
      if (!ev.data) return;
      if (ev.data.type === 'enablePickMode') {{
        map._pickModeOn = true;
        map.getContainer().style.cursor = 'crosshair';
      }}
      if (ev.data.type === 'disablePickMode') {{
        map._pickModeOn = false;
        map.getContainer().style.cursor = '';
      }}
    }});

    {body_script}
  }})();
  </script>
</body>
</html>"""


# ── مارکر شرکت ──────────────────────────────────────────────────────────────
def _company_marker_js():
    lat, lng = _company_coords()
    name = COMPANY_CONFIG.get("name", "شرکت")

    building_svg = (
        '<svg fill="#c9a84c" viewBox="0 0 24 24" width="20" height="20">'
        '<path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2z'
        'm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2z'
        'm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>'
        '</svg>'
    )

    icon_html = _pin_html(
        circle_color="#1a3a6b",
        border_color="#c9a84c",
        circle_size=42,
        tip_w=10,
        tip_h=13,
        inner_html=building_svg,
    )

    popup = (
        f'<div style="padding:12px 18px;font-family:Tahoma;text-align:center;min-width:150px">'
        f'  <div style="font-size:13px;font-weight:700;color:#1a3a6b">🏢 {name}</div>'
        f'</div>'
    )

    return f"""
    L.marker([{lat}, {lng}], {{
      zIndexOffset: 2000,
      icon: L.divIcon({{
        className: '',
        html: `{icon_html}`,
        iconSize:   [42, 57],
        iconAnchor: [21, 57]
      }})
    }}).addTo(map).bindPopup(`{popup}`, {{maxWidth: 200}});
    """


# ── مارکر مشتری ─────────────────────────────────────────────────────────────
def _customer_marker_js(lat, lng, name, code, tel, mandeh):
    is_debt  = mandeh > 0
    color    = "#EF4444" if is_debt else "#22c55e"
    color_dk = "#B91C1C" if is_debt else "#15803d"
    bg_light = "#FEF2F2" if is_debt else "#f0fdf4"
    status   = "بدهکار" if is_debt else "تسویه"

    safe_name  = str(name).replace("`", "'").replace("'", "\\'").replace('"', '&quot;')
    safe_tel   = str(tel or "ثبت نشده").replace("`", "'")
    mandeh_fmt = f"{abs(mandeh):,}"
    initial    = safe_name[:1] if safe_name else "؟"

    user_svg = (
        '<svg viewBox="0 0 24 24" fill="white" width="13" height="13">'
        '<path d="M12 12c2.7 0 8 1.34 8 4v2H4v-2c0-2.66 5.3-4 8-4z'
        'm0-2a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg>'
    )

    icon_html = _pin_html(
        circle_color=color,
        border_color="white",
        circle_size=26,
        tip_w=6,
        tip_h=9,
        inner_html=user_svg,
    )

    popup = (
        f'<div style="min-width:210px;font-family:Tahoma,sans-serif;overflow:hidden">'
        f'  <div style="background:{color};padding:12px 14px">'
        f'    <div style="display:flex;align-items:center;gap:10px">'
        f'      <div style="width:36px;height:36px;border-radius:9px;background:rgba(255,255,255,.25);'
        f'color:white;display:flex;align-items:center;justify-content:center;'
        f'font-weight:700;font-size:16px;flex-shrink:0">{initial}</div>'
        f'      <div>'
        f'        <div style="color:white;font-weight:700;font-size:13px">{safe_name}</div>'
        f'        <div style="color:rgba(255,255,255,.8);font-size:11px">کد: {code}</div>'
        f'      </div>'
        f'    </div>'
        f'  </div>'
        f'  <div style="padding:10px 14px;background:white">'
        f'    <div style="display:flex;justify-content:space-between;font-size:11px;'
        f'color:#64748b;margin-bottom:8px">'
        f'      <span>📞 تلفن</span>'
        f'      <span style="color:#334155;font-weight:600">{safe_tel}</span>'
        f'    </div>'
        f'    <div style="background:{bg_light};border-radius:8px;padding:8px 12px;'
        f'display:flex;justify-content:space-between;align-items:center">'
        f'      <span style="font-size:11px;color:{color_dk};font-weight:700">{status}</span>'
        f'      <span style="font-size:14px;color:{color_dk};font-weight:800">{mandeh_fmt} </span>'
        f'    </div>'
        f'  </div>'
        f'</div>'
    )

    safe_name_js = safe_name.replace("'", "\\'")

    return f"""
    (function() {{
      var m = L.marker([{lat}, {lng}], {{
        icon: L.divIcon({{
          className: '',
          html: `{icon_html}`,
          iconSize:   [26, 37],
          iconAnchor: [13, 37]
        }})
      }}).addTo(map).bindPopup(`{popup}`, {{maxWidth: 230}});
      window.customerMarkers.push({{ marker: m, name: '{safe_name_js}', code: '{code}' }});
    }})();
    """


# ── مارکر ویزیتور آنلاین ────────────────────────────────────────────────────
def _visitor_marker_js(lat, lng, name, code, time_str, date_str):
    safe_name = str(name).replace("`", "'").replace("'", "\\'")

    # آیکون شخص
    person_svg = (
        '<svg viewBox="0 0 24 24" fill="white" width="15" height="15">'
        '<path d="M12 12c2.7 0 8 1.34 8 4v2H4v-2c0-2.66 5.3-4 8-4z'
        'm0-2a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg>'
    )

    # نقطه سبز آنلاین در گوشه بالا-چپ دایره
    badge = (
        '<div style="position:absolute;top:-2px;right:-2px;'
        'width:10px;height:10px;background:#22C55E;'
        'border:2px solid white;border-radius:50%"></div>'
    )

    icon_html = _pin_html(
        circle_color="#6366F1",
        border_color="white",
        circle_size=32,
        tip_w=8,
        tip_h=11,
        inner_html=person_svg,
        badge_html=badge,
    )

    popup = (
        f'<div style="min-width:190px;font-family:Tahoma;overflow:hidden">'
        f'  <div style="background:#6366F1;padding:10px 14px;display:flex;align-items:center;gap:8px">'
        f'    <div style="width:10px;height:10px;background:#22C55E;border-radius:50%;flex-shrink:0"></div>'
        f'    <b style="color:white;font-size:13px">{safe_name}</b>'
        f'  </div>'
        f'  <div style="padding:10px 14px;background:white;display:flex;flex-direction:column;gap:5px">'
        f'    <div style="font-size:11px;color:#64748b">📅 تاریخ: '
        f'<b style="color:#334155">{date_str}</b></div>'
        f'    <div style="font-size:11px;color:#64748b">🕐 ساعت: '
        f'<b style="color:#334155">{time_str}</b></div>'
        f'    <div style="margin-top:4px;background:#EEF2FF;border-radius:6px;'
        f'padding:5px 10px;color:#4338CA;font-weight:700;font-size:11px;text-align:center">'
        f'● ویزیتور آنلاین</div>'
        f'  </div>'
        f'</div>'
    )

    return f"""
    L.marker([{lat}, {lng}], {{
      zIndexOffset: 1500,
      icon: L.divIcon({{
        className: '',
        html: `{icon_html}`,
        iconSize:   [32, 45],
        iconAnchor: [16, 45]
      }})
    }}).addTo(map).bindPopup(`{popup}`, {{maxWidth: 220}});
    """


# ── توابع عمومی ─────────────────────────────────────────────────────────────
def customers_map(buyers: list, visitors_location: list = None, zoom: int = 12,
                   fit_bounds: bool = False) -> str:
    """
    fit_bounds=True یعنی بعد از اضافه شدن مارکرهای مشتری، نقشه خودکار روی
    محدوده‌ی همون مشتری‌ها زوم کنه (برای حالت فیلتر بر اساس شهر).
    """
    markers_js = [_company_marker_js()]

    for b in buyers:
        try:
            lat = float(b["Lat"])
            lng = float(b["Lng"])
        except (TypeError, ValueError, KeyError):
            continue
        markers_js.append(_customer_marker_js(
            lat, lng,
            b.get("Name", ""), b.get("BuyerCode", ""),
            b.get("Tel", ""), int(b.get("Mandeh") or 0),
        ))

    if visitors_location:
        for v in visitors_location:
            markers_js.append(_visitor_marker_js(
                v["lat"], v["lng"],
                v.get("name", ""), v.get("code", ""),
                v.get("time", ""), v.get("date", ""),
            ))

    if fit_bounds:
        markers_js.append("""
        setTimeout(function() {
          if (window.customerMarkers.length > 0) {
            var bounds = window.customerMarkers.map(function(m) { return m.marker.getLatLng(); });
            map.fitBounds(bounds, { padding: [70, 70], maxZoom: 16 });
          }
          try {
            window.parent.postMessage(
              { type: 'cityFilterResult', count: window.customerMarkers.length },
              '*'
            );
          } catch (e) {}
        }, 60);
        """)

    return _wrap_html("\n".join(markers_js), zoom=zoom)


def base_map(zoom: int = 14) -> str:
    return _wrap_html(_company_marker_js(), zoom=zoom)

def visitor_route_map(locs: list, visitor_name: str = "", zoom: int = 13) -> str:
    """رسم مسیر حرکت یک ویزیتور روی نقشه (خط مسیر + همه‌ی نقاط + مارکر شروع/پایان)"""
    if not locs:
        empty_js = """
        var el = document.createElement('div');
        el.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);' +
          'background:rgba(15,23,48,.92);color:#fff;padding:14px 24px;border-radius:12px;' +
          'font-family:Tahoma;font-size:13px;z-index:9999;text-align:center;white-space:nowrap';
        el.textContent = 'موقعیتی برای این تاریخ ثبت نشده';
        document.body.appendChild(el);
        """
        return _wrap_html(_company_marker_js() + empty_js, zoom=11)

    coords_js = "[" + ",".join(f"[{l['lat']},{l['lng']}]" for l in locs) + "]"
    start, end = locs[0], locs[-1]
    safe_name  = str(visitor_name).replace("`", "'").replace("'", "\\'")

    start_popup = f"شروع مسیر<br>{safe_name}<br>ساعت: {start['time']}"
    end_popup   = f"پایان مسیر<br>{safe_name}<br>ساعت: {end['time']}"

    person_svg = (
        '<svg viewBox="0 0 24 24" fill="white" width="13" height="13">'
        '<path d="M12 12c2.7 0 8 1.34 8 4v2H4v-2c0-2.66 5.3-4 8-4z'
        'm0-2a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg>'
    )
    start_icon = _pin_html("#22c55e", "white", 26, 6, 9, person_svg)
    end_icon   = _pin_html("#EF4444", "white", 26, 6, 9, person_svg)

    # ── نقاط میانی مسیر: مارکر متفاوت (دایره‌ی کوچیک بنفش) ──
    waypoints_js = ""
    middle_points = locs[1:-1]
    if middle_points:
        parts = []
        for i, loc in enumerate(middle_points, start=1):
            wp_popup = (
                f"نقطه {i} از مسیر<br>{safe_name}"
                f"<br>تاریخ: {loc.get('date','')}"
                f"<br>ساعت: {loc.get('time','')}"
            )
            parts.append(f"""
            L.circleMarker([{loc['lat']}, {loc['lng']}], {{
              radius: 5,
              weight: 2,
              color: '#ffffff',
              fillColor: '#6366F1',
              fillOpacity: 0.95,
              opacity: 0.9
            }}).addTo(map).bindPopup(`{wp_popup}`, {{maxWidth: 190}});
            """)
        waypoints_js = "\n".join(parts)

    js = f"""
    var routeCoords = {coords_js};

    var line = L.polyline(routeCoords, {{
      color: '#6366F1', weight: 4, opacity: 0.85,
      dashArray: '2 8', lineCap: 'round'
    }}).addTo(map);

    {waypoints_js}

    L.marker(routeCoords[0], {{
      zIndexOffset: 1800,
      icon: L.divIcon({{ className:'', html:`{start_icon}`, iconSize:[26,37], iconAnchor:[13,37] }})
    }}).addTo(map).bindPopup(`{start_popup}`);

    L.marker(routeCoords[routeCoords.length - 1], {{
      zIndexOffset: 1800,
      icon: L.divIcon({{ className:'', html:`{end_icon}`, iconSize:[26,37], iconAnchor:[13,37] }})
    }}).addTo(map).bindPopup(`{end_popup}`);

    setTimeout(function() {{
      map.fitBounds(line.getBounds(), {{ padding: [60, 60], maxZoom: 16 }});
    }}, 60);
    """
    return _wrap_html(js, zoom=zoom)