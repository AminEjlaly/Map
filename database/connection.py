import pyodbc
from contextlib import contextmanager
from config.settings_loader import DATABASE_CONFIG


class DatabaseConnection:

    def __init__(self):
        cfg = DATABASE_CONFIG
        self._conn_str = (
            f"DRIVER={{ODBC Driver 17 for SQL Server}};"
            f"SERVER={cfg['Server']},{cfg['Port']};"
            f"DATABASE={cfg['dbName']};"
            f"UID={cfg['dbUser']};"
            f"PWD={cfg['dbPassword']};"
            "Encrypt=no;"
            "TrustServerCertificate=yes;"
        )

    @contextmanager
    def get_connection(self):
        """کانکشن رو باز می‌کنه، بعد از پایان استفاده (چه موفق چه با خطا)
        حتماً می‌بندتش تا کانکشن روی SQL Server جمع نشه."""
        conn = None
        try:
            conn = pyodbc.connect(self._conn_str, timeout=5)
            yield conn
            conn.commit()
        except Exception as e:
            if conn is not None:
                try:
                    conn.rollback()
                except Exception:
                    pass
            print(f"❌ DB connection error: {e}")
            raise
        finally:
            if conn is not None:
                try:
                    conn.close()
                except Exception:
                    pass