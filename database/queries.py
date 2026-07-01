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


def get_all_buyers_with_location(city_code=None) -> list:
    """مشتری‌هایی که Lat/Lng دارن - برای نمایش روی نقشه.
    اگه city_code داده بشه فقط مشتری‌های همون شهر برمی‌گردن."""
    query = """
        SELECT b.BuyerCode, b.Name, b.Lat, b.Lng, b.Tel,
               ISNULL(SUM(s.Bedahkar),0) - ISNULL(SUM(s.bestankar),0) AS Mandeh
        FROM   Buyer b
        LEFT JOIN GrSanad s ON b.BuyerCode = s.Tafzily
        WHERE  b.Lat IS NOT NULL AND b.Lng IS NOT NULL
          AND  b.Lat <> '' AND b.Lng <> ''
          AND  ISNUMERIC(b.Lat) = 1 AND ISNUMERIC(b.Lng) = 1
          {city_condition}
        GROUP BY b.BuyerCode, b.Name, b.Lat, b.Lng, b.Tel
        ORDER BY b.Name
    """

    city_condition = ""
    params = ()
    if city_code:
        city_condition = "AND b.CityCode = ?"
        params = (city_code,)

    query = query.format(city_condition=city_condition)

    try:
        with _db.get_connection() as conn:
            cur = conn.cursor()
            if params:
                cur.execute(query, params)
            else:
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


def get_cities_with_customers() -> list:
    """لیست شهرهایی که حداقل یک مشتری با موقعیت مکانی (Lat/Lng) دارن -
    برای پر کردن باکس انتخاب شهر روی نقشه."""
    q = """
        SELECT DISTINCT c.CityCode, c.CityName
        FROM City c
        INNER JOIN Buyer b ON b.CityCode = c.CityCode
        WHERE b.Lat IS NOT NULL AND b.Lng IS NOT NULL
          AND b.Lat <> '' AND b.Lng <> ''
        ORDER BY c.CityName
    """
    try:
        with _db.get_connection() as conn:
            cur = conn.cursor()
            cur.execute(q)
            return [{"code": r[0], "name": r[1]} for r in cur.fetchall()]
    except Exception as e:
        print(f"❌ get_cities_with_customers: {e}")
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
                # ── ایندکس‌های درست ────────────────────────
                # 0 PaymentID   1 CustomerCode   2 CustomerName
                # 3 DeliveryUserID  4 DeliveryName  5 PaymentType
                # 6 Amount  7 SerialNumber  8 CheckDueDate
                # 9 SayyadiNumber  10 ImagePath  11 RegisterDateSh
                # 12 RegisterDatetime  13 Description
                # 14 IsConfirmed  15 ConfirmedBy  16 ConfirmedAt

                is_confirmed = False
                if r[14] is not None:
                    if isinstance(r[14], bool):
                        is_confirmed = r[14]
                    elif isinstance(r[14], (int, float)):
                        is_confirmed = bool(r[14])
                    elif isinstance(r[14], str):
                        is_confirmed = r[14].lower() in ('1', 'true', 'yes')

                register_date  = str(r[11]) if r[11] else ""
                confirmed_at   = str(r[16]) if r[16] else ""
                check_due_date = str(r[8])  if r[8]  else ""

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
                    "RegisterDatetime": str(r[12]) if r[12] else "",
                    "Description": str(r[13]) if r[13] else "",
                    "IsConfirmed": is_confirmed,
                    "ConfirmedBy": str(r[15]) if r[15] else "",
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


def confirm_payment(payment_id: int, confirmed_by: str) -> dict:
    """تایید یک پرداخت"""
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

# database/queries.py - اصلاح تابع get_users_settings

def get_users_settings() -> dict:
    """دریافت لیست کاربران با تنظیمات دسترسی"""
    query = """
        SELECT 
            ID,
            codeV,
            codeM,
            codeB,
            nameV,
            nameM,
            nameB,
            status,
            statussell,
            manfi,
            proximity_check_enabled,
            maxDistance,
            createdAt,
            updatedAt,
            lastLogin,
            location_tracking_enabled,
            isOnline,
            lastSeen
        FROM settingApp
        ORDER BY 
            CASE 
                WHEN codeV IS NOT NULL THEN 1 
                WHEN codeM IS NOT NULL THEN 2 
                WHEN codeB IS NOT NULL THEN 3 
                ELSE 4 
            END,
            nameV, nameM, nameB
    """
    
    try:
        with _db.get_connection() as conn:
            cur = conn.cursor()
            cur.execute(query)
            rows = cur.fetchall()
            
            users = []
            for r in rows:
                # تعیین نوع کاربر و نام مربوطه
                user_type = ''
                user_code = ''
                user_name = ''
                
                # بررسی کد ویزیتور
                if r[1] and r[1] != '' and r[1] is not None:
                    user_type = 'visitor'
                    user_code = str(r[1])
                    user_name = str(r[4]) if r[4] else 'ویزیتور بدون نام'
                # بررسی کد پرسنل/تحویل‌دار
                elif r[2] and r[2] != '' and r[2] is not None:
                    user_type = 'staff'
                    user_code = str(r[2])
                    user_name = str(r[5]) if r[5] else 'پرسنل بدون نام'
                # بررسی کد مشتری
                elif r[3] and r[3] != '' and r[3] is not None:
                    user_type = 'buyer'
                    user_code = str(r[3])
                    user_name = str(r[6]) if r[6] else 'مشتری بدون نام'
                else:
                    # اگر هیچ کدی نداشت، رد میشه
                    continue
                
                user = {
                    'id': int(r[0]) if r[0] else 0,
                    'codeV': str(r[1]) if r[1] else '',
                    'codeM': str(r[2]) if r[2] else '',
                    'codeB': str(r[3]) if r[3] else '',
                    'user_code': user_code,
                    'user_type': user_type,
                    'name': user_name,
                    'status': bool(r[7]) if r[7] is not None else False,
                    'statussell': bool(r[8]) if r[8] is not None else False,
                    'manfi': bool(r[9]) if r[9] is not None else False,
                    'proximity_check_enabled': bool(r[10]) if r[10] is not None else False,
                    'maxDistance': int(r[11]) if r[11] is not None else 0,
                    'createdAt': str(r[12]) if r[12] else '',
                    'updatedAt': str(r[13]) if r[13] else '',
                    'lastLogin': str(r[14]) if r[14] else '',
                    'location_tracking_enabled': bool(r[15]) if r[15] is not None else False,
                    'isOnline': bool(r[16]) if r[16] is not None else False,
                    'lastSeen': str(r[17]) if r[17] else ''
                }
                users.append(user)
            
            return {
                'success': True,
                'users': users,
                'total': len(users)
            }
            
    except Exception as e:
        print(f"❌ get_users_settings: {e}")
        import traceback
        traceback.print_exc()
        return {
            'success': False,
            'users': [],
            'total': 0,
            'error': str(e)
        }


def update_user_settings(user_data: dict) -> dict:
    """به‌روزرسانی تنظیمات یک کاربر"""
    # پیدا کردن کد کاربر
    user_code = user_data.get('user_code', '')
    user_type = user_data.get('user_type', '')
    
    if not user_code:
        return {'success': False, 'message': 'کد کاربر نامعتبر است'}
    
    # تعیین ستون مربوطه
    code_column = ''
    if user_type == 'visitor':
        code_column = 'codeV'
    elif user_type == 'staff':
        code_column = 'codeM'
    elif user_type == 'buyer':
        code_column = 'codeB'
    else:
        return {'success': False, 'message': 'نوع کاربر نامعتبر است'}
    
    # ساخت کوئری به‌روزرسانی - استفاده از ? برای pyodbc
    query = f"""
        UPDATE settingApp
        SET 
            status = ?,
            statussell = ?,
            manfi = ?,
            proximity_check_enabled = ?,
            maxDistance = ?,
            location_tracking_enabled = ?,
            updatedAt = GETDATE()
        WHERE {code_column} = ?
    """
    
    try:
        with _db.get_connection() as conn:
            cur = conn.cursor()
            cur.execute(query, (
                int(user_data.get('status', False)),
                int(user_data.get('statussell', False)),
                int(user_data.get('manfi', False)),
                int(user_data.get('proximity_check_enabled', False)),
                user_data.get('maxDistance', 0),
                int(user_data.get('location_tracking_enabled', False)),
                user_code
            ))
            conn.commit()
            
            if cur.rowcount > 0:
                return {'success': True, 'message': 'تنظیمات با موفقیت به‌روزرسانی شد'}
            else:
                return {'success': False, 'message': 'کاربر یافت نشد یا تغییری ایجاد نشد'}
                
    except Exception as e:
        print(f"❌ update_user_settings: {e}")
        import traceback
        traceback.print_exc()
        return {'success': False, 'message': f'خطا در به‌روزرسانی: {str(e)}'}