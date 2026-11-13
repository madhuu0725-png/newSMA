import json
import math
import os
import sqlite3
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
ENV_FILE = ROOT.parent / ".env"
if ENV_FILE.exists():
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        key, separator, value = line.partition("=")
        if separator and key.strip() and not key.lstrip().startswith("#"):
            os.environ.setdefault(key.strip(), value.strip())

database_path = Path(os.environ.get("REPORTS_DB", ROOT / "data" / "reports.sqlite"))
DATABASE = database_path if database_path.is_absolute() else ROOT.parent / database_path
TOKEN = os.environ.get("PYTHON_REPORTS_TOKEN", "local-reports-token")
HOST = "127.0.0.1"
PORT = int(os.environ.get("PYTHON_REPORTS_PORT", "8001"))
EVENT_TYPES = {
    "medicine_created", "medicine_updated", "medicine_deleted",
    "customer_created", "supplier_created", "order_created",
    "order_processing", "order_shipped", "order_preparing",
    "order_dispatched", "order_delivered", "order_cancelled",
    "payment_received",
}


@contextmanager
def connect():
    DATABASE.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE, timeout=5)
    try:
        connection.row_factory = sqlite3.Row
        connection.execute(
            """CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                amount REAL NOT NULL DEFAULT 0,
                entity_id TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )"""
        )
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


class ReportsHandler(BaseHTTPRequestHandler):
    def respond(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def authorized(self):
        return self.headers.get("X-Reports-Token") == TOKEN

    def do_GET(self):
        if not self.authorized():
            return self.respond(401, {"error": "Unauthorized"})
        if urlparse(self.path).path == "/health":
            return self.respond(200, {"status": "ok", "database": "sqlite"})
        if urlparse(self.path).path != "/summary":
            return self.respond(404, {"error": "Not found"})
        try:
            with connect() as connection:
                row = connection.execute(
                    """SELECT
                        COUNT(*) AS events,
                        SUM(CASE WHEN event_type = 'order_created' THEN 1 ELSE 0 END) AS orders,
                        SUM(CASE WHEN event_type = 'order_created' THEN amount ELSE 0 END) AS sales,
                        SUM(CASE WHEN event_type = 'customer_created' THEN 1 ELSE 0 END) AS new_customers,
                        SUM(CASE WHEN event_type = 'medicine_created' THEN 1 ELSE 0 END) AS medicines_added,
                        SUM(CASE WHEN event_type = 'payment_received' THEN 1 ELSE 0 END) AS payments_received
                    FROM events"""
                ).fetchone()
                recent = connection.execute(
                    "SELECT event_type AS type, amount, entity_id AS entityId, created_at AS createdAt "
                    "FROM events ORDER BY id DESC LIMIT 8"
                ).fetchall()
            return self.respond(200, {
                "events": row["events"] or 0,
                "orders": row["orders"] or 0,
                "sales": row["sales"] or 0,
                "newCustomers": row["new_customers"] or 0,
                "medicinesAdded": row["medicines_added"] or 0,
                "paymentsReceived": row["payments_received"] or 0,
                "recent": [dict(item) for item in recent],
            })
        except sqlite3.Error as error:
            print(f"SQLite reporting query failed: {error}", flush=True)
            return self.respond(500, {"error": "The SQL report could not be read."})

    def do_POST(self):
        if not self.authorized():
            return self.respond(401, {"error": "Unauthorized"})
        if urlparse(self.path).path != "/events":
            return self.respond(404, {"error": "Not found"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 1 or length > 4096:
                return self.respond(400, {"error": "Invalid request size"})
            payload = json.loads(self.rfile.read(length))
            if not isinstance(payload, dict):
                return self.respond(400, {"error": "Invalid event"})
            event_type = payload.get("type")
            amount = payload.get("amount", 0)
            entity_id = payload.get("entityId", "")
            if (not isinstance(event_type, str) or event_type not in EVENT_TYPES
                    or isinstance(amount, bool) or not isinstance(amount, (int, float))
                    or not math.isfinite(amount) or not isinstance(entity_id, str)):
                return self.respond(400, {"error": "Invalid event"})
            if amount < 0 or len(entity_id) > 80:
                return self.respond(400, {"error": "Invalid event values"})
            with connect() as connection:
                connection.execute(
                    "INSERT INTO events(event_type, amount, entity_id) VALUES (?, ?, ?)",
                    (event_type, float(amount), entity_id),
                )
            return self.respond(201, {"recorded": True})
        except (json.JSONDecodeError, UnicodeDecodeError, ValueError):
            return self.respond(400, {"error": "Invalid JSON request"})
        except sqlite3.Error as error:
            print(f"SQLite reporting write failed: {error}", flush=True)
            return self.respond(500, {"error": "The SQL event could not be recorded."})

    def log_message(self, format_string, *args):
        print(f"reports {self.address_string()} - {format_string % args}", flush=True)


if __name__ == "__main__":
    print(f"Python SQL reports listening at http://{HOST}:{PORT}", flush=True)
    HTTPServer((HOST, PORT), ReportsHandler).serve_forever()
