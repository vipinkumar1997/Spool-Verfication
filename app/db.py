"""SQLite persistence layer for scan records.

One table (``scans``) is the single source of truth. Stats and recent-scan
lists are *derived* from it with SQL, so counters can never drift out of sync
with history (a bug class present in the old cookie-session implementation).
"""

from __future__ import annotations

import sqlite3
from typing import List, Optional

from flask import current_app, g


# History retained per query (bounded payload for the UI).
MAX_HISTORY = 50
MAX_RECENT = 5


def get_db() -> sqlite3.Connection:
    """Return a per-request SQLite connection (created lazily, closed on teardown)."""
    if "db" not in g:
        g.db = sqlite3.connect(
            current_app.config["DATABASE_PATH"],
            detect_types=sqlite3.PARSE_DECLTYPES,
        )
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA journal_mode=WAL;")
        g.db.execute("PRAGMA foreign_keys=ON;")
    return g.db


def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


SCHEMA = """
CREATE TABLE IF NOT EXISTS scans (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    vpn         TEXT,
    surbhi      TEXT    NOT NULL,
    manufacturing TEXT  NOT NULL,
    result      TEXT    NOT NULL CHECK (result IN ('PASS', 'FAIL')),
    error       TEXT
);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans (created_at DESC);
"""


def init_db(app) -> None:
    """Create schema. Safe to call repeatedly."""
    conn = sqlite3.connect(app.config["DATABASE_PATH"])
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()


def record_scan(
    *,
    vpn: Optional[str],
    surbhi: str,
    manufacturing: str,
    passed: bool,
    error: Optional[str] = None,
) -> dict:
    """Insert one verification outcome and return the stored row as a dict."""
    db = get_db()
    cur = db.execute(
        "INSERT INTO scans (vpn, surbhi, manufacturing, result, error) VALUES (?, ?, ?, ?, ?)",
        (vpn, surbhi, manufacturing, "PASS" if passed else "FAIL", error),
    )
    db.commit()
    row = db.execute("SELECT * FROM scans WHERE id = ?", (cur.lastrowid,)).fetchone()
    return dict(row)


def get_stats() -> dict:
    """Aggregate counters derived directly from the scans table."""
    db = get_db()
    row = db.execute(
        """
        SELECT COUNT(*) AS total,
               COALESCE(SUM(result = 'PASS'), 0) AS pass_count,
               COALESCE(SUM(result = 'FAIL'), 0) AS fail_count
        FROM scans
        """
    ).fetchone()
    return {
        "total_scans": row["total"],
        "pass_count": row["pass_count"],
        "fail_count": row["fail_count"],
    }


def get_recent_scans(limit: int = MAX_RECENT) -> List[dict]:
    db = get_db()
    rows = db.execute(
        "SELECT vpn, result, substr(created_at, -8) AS timestamp"
        " FROM scans ORDER BY id DESC LIMIT ?",
        (limit,),
    ).fetchall()
    return [dict(r) for r in rows]


def get_history(limit: int = MAX_HISTORY) -> List[dict]:
    db = get_db()
    rows = db.execute(
        "SELECT id, created_at AS timestamp, vpn, surbhi, manufacturing, result, error"
        " FROM scans ORDER BY id DESC LIMIT ?",
        (limit,),
    ).fetchall()
    return [dict(r) for r in rows]


def clear_all() -> int:
    """Delete every scan record; returns number of rows removed."""
    db = get_db()
    cur = db.execute("DELETE FROM scans")
    db.commit()
    return cur.rowcount
