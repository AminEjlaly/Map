import pyodbc
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

    def get_connection(self):
        try:
            return pyodbc.connect(self._conn_str)
        except Exception as e:
            print(f"❌ DB connection error: {e}")
            raise