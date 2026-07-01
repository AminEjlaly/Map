#database/queries.py
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
    
def get_new_customers(limit: int = 50) -> list:
    """آخرین مشتری‌های ثبت‌شده - هر مشتری با همه‌ی عکس‌هاش و اسم ثبت‌کننده"""
    q = """
        SELECT cp.buyerCode, cp.photoUrl, cp.uploadedAt, cp.uploadedBy, b.name, b.AddB
        FROM CustomerPhotos cp
        LEFT JOIN Buyer b ON cp.buyerCode = b.BuyerCode
        ORDER BY cp.uploadedAt DESC
    """
    try:
        with _db.get_connection() as conn:
            cur = conn.cursor()
            cur.execute(q)
            rows = cur.fetchall()

            grouped = {}
            order = []
            for r in rows:
                code = r[0]
                if code not in grouped:
                    grouped[code] = {
                        "code": code,
                        "name": r[4] or "",
                        "address": r[5] or "",
                        "photos": [],
                    }
                    order.append(code)

                uploaded_at = r[2]
                uploaded_str = (
                    uploaded_at.strftime("%H:%M - %Y/%m/%d")
                    if hasattr(uploaded_at, "strftime") else ""
                )
                grouped[code]["photos"].append({
                    "url":        r[1],
                    "uploadedAt": uploaded_str,
                    "uploadedBy": r[3] or "",
                })

            return [grouped[c] for c in order][:limit]
    except Exception as e:
        print(f"❌ get_new_customers: {e}")
        return []
# database/queries.py - اضافه کردن به انتهای فایل
def get_payments_with_status() -> dict:
    """دریافت لیست پرداخت‌ها با دسته‌بندی تایید شده/در انتظار"""
    query = """
        SELECT 
            PaymentID,
            CustomerCode,
            CustomerName,
            DeliveryUserID,
            DeliveryName,
            PaymentType,
            Amount,
            SerialNumber,
            CheckDueDate,
            SayyadiNumber,
            ImagePath,
            RegisterDateSh,
            RegisterDatetime,
            Description,
            IsConfirmed,
            ConfirmedBy,
            ConfirmedAt
        FROM CustomerPayments
        ORDER BY 
            CASE WHEN IsConfirmed = 0 THEN 0 ELSE 1 END,
            RegisterDatetime DESC
    """
    
    try:
        with _db.get_connection() as conn:
            cur = conn.cursor()
            cur.execute(query)
            rows = cur.fetchall()
            
            pending = []
            confirmed = []
            
            for r in rows:
                # تبدیل صحیح Boolean
                is_confirmed = False
                if r[13] is not None:
                    if isinstance(r[13], bool):
                        is_confirmed = r[13]
                    elif isinstance(r[13], (int, float)):
                        is_confirmed = bool(r[13])
                    elif isinstance(r[13], str):
                        is_confirmed = r[13].lower() in ('1', 'true', 'yes')
                
                # تبدیل تاریخ‌ها به رشته
                register_date = str(r[11]) if r[11] else ""
                confirmed_at = str(r[16]) if r[16] else ""
                check_due_date = str(r[8]) if r[8] else ""
                
                payment = {
                    "PaymentID": int(r[0]) if r[0] else 0,
                    "CustomerCode": str(r[1]) if r[1] else "",
                    "CustomerName": str(r[2]) if r[2] else "بدون نام",
                    "DeliveryUserID": str(r[3]) if r[3] else "",
                    "DeliveryName": str(r[4]) if r[4] else "نامشخص",
                    "PaymentType": str(r[5]) if r[5] else "cash",
                    "Amount": int(r[6]) if r[6] else 0,
                    "SerialNumber": str(r[7]) if r[7] else "",
                    "CheckDueDate": check_due_date,
                    "SayyadiNumber": str(r[9]) if r[9] else "",
                    "ImagePath": str(r[10]) if r[10] else "",
                    "RegisterDateSh": register_date,
                    "RegisterDatetime": str(r[11]) if r[11] else "",
                    "Description": str(r[12]) if r[12] else "",
                    "IsConfirmed": is_confirmed,
                    "ConfirmedBy": str(r[14]) if r[14] else "",
                    "ConfirmedAt": confirmed_at
                }
                
                if payment["IsConfirmed"]:
                    confirmed.append(payment)
                else:
                    pending.append(payment)
            
            return {
                "success": True,
                "pending": pending,
                "confirmed": confirmed,
                "total_pending": len(pending),
                "total_confirmed": len(confirmed)
            }
            
    except Exception as e:
        print(f"❌ get_payments_with_status: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "pending": [],
            "confirmed": [],
            "total_pending": 0,
            "total_confirmed": 0,
            "error": str(e)
        }


# database/queries.py - اصلاح تابع confirm_payment

def confirm_payment(payment_id: int, confirmed_by: str) -> dict:
    """تایید یک پرداخت"""
    # استفاده از ? به جای %s برای pyodbc
    query = """
        UPDATE CustomerPayments
        SET 
            IsConfirmed = 1,
            ConfirmedBy = ?,
            ConfirmedAt = GETDATE()
        WHERE PaymentID = ? AND IsConfirmed = 0
    """
    
    try:
        with _db.get_connection() as conn:
            cur = conn.cursor()
            cur.execute(query, (confirmed_by, payment_id))
            conn.commit()
            
            if cur.rowcount > 0:
                return {"success": True, "message": "پرداخت با موفقیت تایید شد"}
            else:
                return {"success": False, "message": "پرداخت قبلاً تایید شده یا وجود ندارد"}
                
    except Exception as e:
        print(f"❌ confirm_payment: {e}")
        return {"success": False, "message": f"خطا در تایید پرداخت: {str(e)}"}