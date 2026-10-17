"""In-memory scan store — the single source of truth for live session data.

Design decision (senior review): this is a *live verification station*.
There is no database by choice. All scan records live in process memory and
reset on restart/redeploy. That is acceptable because operators only need
the current shift's results, not long-term persistence.

Concurrency model: gunicorn runs with a single worker; the GIL plus atomic
list/dict operations make this safe without explicit locking. If you ever
scale to multiple workers or instances, each one would hold its own copy —
that is the known trade-off of the no-database design.
"""

from __future__ import annotations

import threading
from datetime import datetime, timezone
from typing import List, Optional

# Bounded buffers so memory can never grow without limit.
MAX_HISTORY = 50
MAX_RECENT = 5


class ScanStore:
    """Thread-safe, bounded, in-memory store of scan records."""

    MAX_HISTORY = MAX_HISTORY
    MAX_RECENT = MAX_RECENT

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._records: List[dict] = []  # newest last
        self.total_scans = 0
        self.pass_count = 0
        self.fail_count = 0

    # ------------------------------------------------------------------ write

    def record_scan(
        self,
        vpn: Optional[str],
        surbhi: str,
        manufacturing: str,
        passed: bool,
        error: Optional[str] = None,
    ) -> dict:
        """Append one scan outcome and update counters atomically."""
        record = {
            "vpn": vpn,
            "surbhi": surbhi,
            "manufacturing": manufacturing,
            "result": "PASS" if passed else "FAIL",
            "error": error,
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
        }
        with self._lock:
            self.total_scans += 1
            if passed:
                self.pass_count += 1
            else:
                self.fail_count += 1
            self._records.append(record)
            # Trim oldest beyond the bounded window.
            if len(self._records) > MAX_HISTORY:
                del self._records[: len(self._records) - MAX_HISTORY]
        return record

    def clear_all(self) -> int:
        """Wipe all records. Returns the number of scans removed."""
        with self._lock:
            removed = len(self._records)
            self._records.clear()
            self.total_scans = 0
            self.pass_count = 0
            self.fail_count = 0
        return removed

    # ------------------------------------------------------------------- read

    def get_stats(self) -> dict:
        with self._lock:
            return {
                "total_scans": self.total_scans,
                "pass_count": self.pass_count,
                "fail_count": self.fail_count,
            }

    def get_recent_scans(self, limit: int = MAX_RECENT) -> List[dict]:
        """Most recent scans, newest first (UI display order)."""
        limit = max(1, min(limit, MAX_RECENT))
        with self._lock:
            return list(reversed(self._records[-limit:]))

    def get_history(self, limit: int = MAX_HISTORY) -> List[dict]:
        """Full retained history, newest first."""
        limit = max(1, min(limit, MAX_HISTORY))
        with self._lock:
            return list(reversed(self._records[-limit:]))
