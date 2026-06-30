import os
import sys
import json
import base64
import tkinter as tk
from tkinter import messagebox, ttk
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
from cryptography.hazmat.backends import default_backend

# ── رمزنگاری ──────────────────────────────────────────────────────────────────
ENC_FILE = "config/settings.enc"
APP_PASSWORD = "kara.1464o"  # پسورد ثابت برنامه برای settings.enc

EDITOR_PASSWORD = "admin1464"  # پسورد ورود به ویرایشگر - این رو عوض کن


def _derive_key(password: str, salt: bytes) -> bytes:
    kdf = Scrypt(salt=salt, length=32, n=2**14, r=8, p=1, backend=default_backend())
    return base64.urlsafe_b64encode(kdf.derive(password.encode()))


def load_config() -> dict:
    if not os.path.exists(ENC_FILE):
        return {
            "FLASK_CONFIG":    {"DEBUG": True, "HOST": "0.0.0.0", "PORT": 5080},
            "DATABASE_CONFIG": {"Server": "", "Port": "1433", "dbName": "", "dbUser": "", "dbPassword": ""},
            "COMPANY_CONFIG":  {"name": "", "lat": 35.0, "lng": 51.0},
        }
    with open(ENC_FILE, "rb") as f:
        data = f.read()
    salt = data[:16]
    key  = _derive_key(APP_PASSWORD, salt)
    return json.loads(Fernet(key).decrypt(data[16:]).decode())


def save_config(config: dict):
    salt = os.urandom(16)
    key  = _derive_key(APP_PASSWORD, salt)
    encrypted = Fernet(key).encrypt(json.dumps(config, ensure_ascii=False).encode())
    os.makedirs("config", exist_ok=True)
    with open(ENC_FILE, "wb") as f:
        f.write(salt + encrypted)


# ── پنجره لاگین ───────────────────────────────────────────────────────────────
class LoginWindow:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("ورود به ویرایشگر تنظیمات")
        self.root.geometry("360x220")
        self.root.resizable(False, False)
        self.root.configure(bg="#1e40af")
        self._center()
        self._build()
        self.root.mainloop()

    def _center(self):
        self.root.update_idletasks()
        x = (self.root.winfo_screenwidth()  - 360) // 2
        y = (self.root.winfo_screenheight() - 220) // 2
        self.root.geometry(f"360x220+{x}+{y}")

    def _build(self):
        tk.Label(self.root, text="🔒 ویرایشگر تنظیمات",
                 bg="#1e40af", fg="white",
                 font=("Tahoma", 14, "bold")).pack(pady=(25, 5))

        tk.Label(self.root, text="پسورد را وارد کنید:",
                 bg="#1e40af", fg="#bfdbfe",
                 font=("Tahoma", 10)).pack(pady=(10, 4))

        self.pass_var = tk.StringVar()
        entry = tk.Entry(self.root, textvariable=self.pass_var,
                         show="●", font=("Tahoma", 12),
                         width=22, justify="center",
                         bd=0, relief="flat",
                         bg="#dbeafe", fg="#1e3a8a")
        entry.pack(ipady=8)
        entry.focus()
        entry.bind("<Return>", lambda e: self._check())

        tk.Button(self.root, text="ورود",
                  command=self._check,
                  bg="#2563eb", fg="white",
                  font=("Tahoma", 11, "bold"),
                  relief="flat", cursor="hand2",
                  width=18, pady=6).pack(pady=18)

    def _check(self):
        if self.pass_var.get() == EDITOR_PASSWORD:
            self.root.destroy()
            EditorWindow()
        else:
            messagebox.showerror("خطا", "پسورد اشتباه است!")
            self.pass_var.set("")


# ── پنجره ویرایش ──────────────────────────────────────────────────────────────
class EditorWindow:
    def __init__(self):
        self.config = load_config()
        self.root   = tk.Tk()
        self.root.title("ویرایش تنظیمات")
        self.root.geometry("520x620")
        self.root.resizable(False, False)
        self.root.configure(bg="#f1f5f9")
        self._center()
        self._build()
        self.root.mainloop()

    def _center(self):
        self.root.update_idletasks()
        x = (self.root.winfo_screenwidth()  - 520) // 2
        y = (self.root.winfo_screenheight() - 620) // 2
        self.root.geometry(f"520x620+{x}+{y}")

    def _section(self, parent, title):
        frame = tk.LabelFrame(parent, text=f"  {title}  ",
                              bg="#f1f5f9", fg="#1e40af",
                              font=("Tahoma", 10, "bold"),
                              bd=2, relief="groove", padx=12, pady=8)
        frame.pack(fill="x", padx=16, pady=(8, 0))
        return frame

    def _field(self, parent, label, var, show=None):
        row = tk.Frame(parent, bg="#f1f5f9")
        row.pack(fill="x", pady=3)
        tk.Label(row, text=label, bg="#f1f5f9", fg="#374151",
                 font=("Tahoma", 9), width=14, anchor="w").pack(side="left")
        kw = {"textvariable": var, "font": ("Tahoma", 10),
              "bd": 1, "relief": "solid", "bg": "white"}
        if show:
            kw["show"] = show
        tk.Entry(row, **kw).pack(side="left", fill="x", expand=True, ipady=4)

    def _build(self):
        # ── Header ──────────────────────────────────────────────────────────
        header = tk.Frame(self.root, bg="#1e40af", height=55)
        header.pack(fill="x")
        tk.Label(header, text="⚙️  ویرایش تنظیمات سیستم",
                 bg="#1e40af", fg="white",
                 font=("Tahoma", 13, "bold")).pack(pady=14)

        # ── ScrollFrame ─────────────────────────────────────────────────────
        canvas = tk.Canvas(self.root, bg="#f1f5f9", highlightthickness=0)
        scroll = ttk.Scrollbar(self.root, orient="vertical", command=canvas.yview)
        self.frame = tk.Frame(canvas, bg="#f1f5f9")
        self.frame.bind("<Configure>",
                        lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=self.frame, anchor="nw")
        canvas.configure(yscrollcommand=scroll.set)
        canvas.pack(side="left", fill="both", expand=True)
        scroll.pack(side="right", fill="y")

        # ── Flask Config ─────────────────────────────────────────────────────
        fc = self.config["FLASK_CONFIG"]
        self.v_port  = tk.StringVar(value=str(fc.get("PORT", 5080)))
        self.v_debug = tk.StringVar(value=str(fc.get("DEBUG", True)))
        s = self._section(self.frame, "🌐 تنظیمات Flask")
        self._field(s, "PORT:", self.v_port)
        self._field(s, "DEBUG:", self.v_debug)

        # ── Database Config ──────────────────────────────────────────────────
        db = self.config["DATABASE_CONFIG"]
        self.v_server   = tk.StringVar(value=db.get("Server", ""))
        self.v_dbport   = tk.StringVar(value=db.get("Port", "1433"))
        self.v_dbname   = tk.StringVar(value=db.get("dbName", ""))
        self.v_dbuser   = tk.StringVar(value=db.get("dbUser", ""))
        self.v_dbpass   = tk.StringVar(value=db.get("dbPassword", ""))
        s = self._section(self.frame, "🗄️  اطلاعات دیتابیس")
        self._field(s, "Server:",   self.v_server)
        self._field(s, "Port:",     self.v_dbport)
        self._field(s, "DB Name:",  self.v_dbname)
        self._field(s, "Username:", self.v_dbuser)
        self._field(s, "Password:", self.v_dbpass, show="●")

        # ── Company Config ───────────────────────────────────────────────────
        cc = self.config["COMPANY_CONFIG"]
        self.v_cname = tk.StringVar(value=cc.get("name", ""))
        self.v_lat   = tk.StringVar(value=str(cc.get("lat", 35.0)))
        self.v_lng   = tk.StringVar(value=str(cc.get("lng", 51.0)))
        s = self._section(self.frame, "🏢 اطلاعات شرکت")
        self._field(s, "نام شرکت:", self.v_cname)
        self._field(s, "Latitude:", self.v_lat)
        self._field(s, "Longitude:", self.v_lng)

        # ── Buttons ──────────────────────────────────────────────────────────
        btn_frame = tk.Frame(self.root, bg="#f1f5f9")
        btn_frame.pack(fill="x", pady=14, padx=16)

        tk.Button(btn_frame, text="💾  ذخیره",
                  command=self._save,
                  bg="#2563eb", fg="white",
                  font=("Tahoma", 11, "bold"),
                  relief="flat", cursor="hand2",
                  width=14, pady=8).pack(side="left", padx=(0, 8))

        tk.Button(btn_frame, text="❌  انصراف",
                  command=self.root.destroy,
                  bg="#dc2626", fg="white",
                  font=("Tahoma", 11, "bold"),
                  relief="flat", cursor="hand2",
                  width=14, pady=8).pack(side="left")

    def _save(self):
        try:
            new_config = {
                "FLASK_CONFIG": {
                    "DEBUG": self.v_debug.get().lower() == "true",
                    "HOST":  "0.0.0.0",
                    "PORT":  int(self.v_port.get()),
                },
                "DATABASE_CONFIG": {
                    "Server":     self.v_server.get().strip(),
                    "Port":       self.v_dbport.get().strip(),
                    "dbName":     self.v_dbname.get().strip(),
                    "dbUser":     self.v_dbuser.get().strip(),
                    "dbPassword": self.v_dbpass.get().strip(),
                },
                "COMPANY_CONFIG": {
                    "name": self.v_cname.get().strip(),
                    "lat":  float(self.v_lat.get()),
                    "lng":  float(self.v_lng.get()),
                },
            }
            save_config(new_config)
            messagebox.showinfo("✅ موفق", "تنظیمات ذخیره شد!\nبرنامه را ری‌استارت کنید.")
            self.root.destroy()

        except ValueError as e:
            messagebox.showerror("خطا", f"مقدار نامعتبر:\n{e}")
        except Exception as e:
            messagebox.showerror("خطا", f"خطا در ذخیره:\n{e}")


# ── main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    # مسیر درست - از هر جا که اجرا بشه
    os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    LoginWindow()