from database.connection import DatabaseConnection

_db = DatabaseConnection()


def get_visitors_with_status() -> list:
    """لیست فروشنده‌های فعال با وضعیت آنلاین/آفلاین و آخرین بازدید"""
    q = """
        SELECT v.NOF, v.NameF, s.isOnline, s.lastSeen
        FROM Vizitor v
        LEFT JOIN settingApp s ON s.codeV = v.NOF
        WHERE v.VaZ = 1
        ORDER BY s.isOnline DESC, v.NameF
    """
    try:
        with _db.get_connection() as conn:
            cur = conn.cursor()
            cur.execute(q)
            result = []
            for r in cur.fetchall():
                last_seen = r[3]
                if hasattr(last_seen, "strftime"):
                    last_seen_str = last_seen.strftime("%H:%M - %Y/%m/%d")
                else:
                    last_seen_str = "نامشخص"
                result.append({
                    "code":     r[0],
                    "name":     r[1],
                    "isOnline": bool(r[2]) if r[2] is not None else False,
                    "lastSeen": last_seen_str,
                })
            return result
    except Exception as e:
        print(f"❌ get_visitors_with_status: {e}")
        return []
def get_all_buyers_with_location() -> list:
    """همه مشتری‌هایی که Lat/Lng دارن - برای نمایش روی نقشه"""
    query = """
        SELECT b.BuyerCode, b.Name, b.Lat, b.Lng, b.Tel,
               ISNULL(SUM(s.Bedahkar),0) - ISNULL(SUM(s.bestankar),0) AS Mandeh
        FROM   Buyer b
        LEFT JOIN GrSanad s ON b.BuyerCode = s.Tafzily
        WHERE  b.Lat IS NOT NULL AND b.Lng IS NOT NULL
          AND  b.Lat <> '' AND b.Lng <> ''
          AND  ISNUMERIC(b.Lat) = 1 AND ISNUMERIC(b.Lng) = 1
        GROUP BY b.BuyerCode, b.Name, b.Lat, b.Lng, b.Tel
        ORDER BY b.Name
    """
    try:
        with _db.get_connection() as conn:
            cur = conn.cursor()
            cur.execute(query)
            result = []
            for r in cur.fetchall():
                try:
                    lat, lng = float(r[2]), float(r[3])
                except (TypeError, ValueError):
                    continue
                if lat == 0 or lng == 0:
                    continue
                result.append({
                    "BuyerCode": r[0], "Name": r[1], "Lat": lat,
                    "Lng": lng, "Tel": r[4], "Mandeh": int(r[5] or 0),
                })
            return result
    except Exception as e:
        print(f"❌ get_all_buyers_with_location: {e}")
        return []
def get_online_visitors_last_location() -> list:
    """آخرین موقعیت ویزیتورهایی که isOnline = 1 هستن"""
    q = """
        SELECT VisitorCode, VisitorName, Lat, Lng, Time, date
        FROM (
            SELECT t.VisitorCode, t.VisitorName, t.Lat, t.Lng, t.Time, t.date,
                   ROW_NUMBER() OVER (
                       PARTITION BY t.VisitorCode
                       ORDER BY t.date DESC, t.Time DESC
                   ) AS rn
            FROM TblVisitorLocation t
            INNER JOIN settingApp s ON s.codeV = t.VisitorCode
            WHERE s.isOnline = 1
              AND t.Lat IS NOT NULL AND t.Lng IS NOT NULL
              AND ISNUMERIC(t.Lat) = 1 AND ISNUMERIC(t.Lng) = 1
        ) ranked
        WHERE rn = 1
    """
    try:
        with _db.get_connection() as conn:
            cur = conn.cursor()
            cur.execute(q)
            result = []
            for r in cur.fetchall():
                try:
                    lat, lng = float(r[2]), float(r[3])
                except (TypeError, ValueError):
                    continue
                if lat == 0 or lng == 0:
                    continue
                result.append({
                    "code":  r[0],
                    "name":  r[1],
                    "lat":   lat,
                    "lng":   lng,
                    "time":  str(r[4]) if r[4] else "",
                    "date":  str(r[5]) if r[5] else "",
                })
            return result
    except Exception as e:
        print(f"❌ get_online_visitors_last_location: {e}")
        return []