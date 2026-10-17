"""HTTP API for spool verification.

Design notes:
    * All state lives in the live in-memory store (app.store.ScanStore) —
      no database by design. Data represents the current session and resets
      on restart/redeploy.
    * Every failed scan is recorded exactly once through one uniform path;
      the old code duplicated fail-handling in three places.
    * Error responses never echo internal exception strings to the client;
      details go to the app logger instead.
"""

from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request

from .validation import validate_manufacturing, validate_surbhi

api_bp = Blueprint("api", __name__, url_prefix="/api")


def _store():
    """The live in-memory scan store."""
    return current_app.config["STORE"]

MAX_INPUT_LEN = 512


def _bad_request(message: str, code: str):
    return jsonify({"success": False, "message": message, "result": "FAIL", "error": code}), 400


def _get_sticker_string(payload: dict, key: str):
    """Extract a sticker value defensively (type + length checked)."""
    value = payload.get(key, "")
    if not isinstance(value, str):
        return None, f"'{key}' must be a string"
    value = value.strip()[:MAX_INPUT_LEN]
    return value, None


@api_bp.post("/verify")
def verify():
    """Verify Surbhi vs Manufacturing VPNs and persist the outcome."""
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        _store().record_scan(vpn=None, surbhi="", manufacturing="", passed=False, error="empty_request")
        return _bad_request("No valid JSON data received", "empty_request")

    surbhi, err = _get_sticker_string(payload, "surbhi")
    if err:
        return _bad_request(err, "invalid_input")
    manufacturing, err = _get_sticker_string(payload, "manufacturing")
    if err:
        return _bad_request(err, "invalid_input")

    # Validate both stickers up-front so any failure is recorded uniformly.
    s_val = validate_surbhi(surbhi)
    m_val = validate_manufacturing(manufacturing)

    if not s_val.valid or not m_val.valid:
        which = "Surbhi" if not s_val.valid else "Manufacturing"
        reason = s_val.error if not s_val.valid else m_val.error
        _store().record_scan(
            vpn=s_val.vpn if s_val.valid else None,
            surbhi=surbhi,
            manufacturing=manufacturing,
            passed=False,
            error=reason,
        )
        stats = _store().get_stats()
        return jsonify(
            {
                "success": False,
                "message": f"Invalid {which} Sticker: {reason}",
                "result": "FAIL",
                "error": "invalid_format",
                **stats,
            }
        ), 400

    is_match = s_val.vpn == m_val.vpn
    _store().record_scan(
        vpn=s_val.vpn,
        surbhi=surbhi,
        manufacturing=manufacturing,
        passed=is_match,
        error=None if is_match else "vpn_mismatch",
    )
    stats = _store().get_stats()

    if is_match:
        message = "PASS: VPNs match!"
    else:
        message = (
            f"FAIL: VPN mismatch! Surbhi: {s_val.vpn}, Manufacturing: {m_val.vpn}"
        )

    return jsonify(
        {
            "success": is_match,
            "message": message,
            "result": "PASS" if is_match else "FAIL",
            "vpn": s_val.vpn,
            **stats,
        }
    )


@api_bp.get("/recent-scans")
def recent_scans():
    limit = request.args.get("limit", default=_store().MAX_RECENT, type=int)
    limit = max(1, min(limit, _store().MAX_RECENT))
    return jsonify(_store().get_recent_scans(limit))


@api_bp.get("/history")
def history():
    limit = request.args.get("limit", default=_store().MAX_HISTORY, type=int)
    limit = max(1, min(limit, _store().MAX_HISTORY))
    return jsonify(_store().get_history(limit))


@api_bp.get("/stats")
def stats():
    return jsonify(_store().get_stats())


@api_bp.post("/clear")
def clear():
    removed = _store().clear_all()
    current_app.logger.info("All scans cleared (%d rows removed)", removed)
    return jsonify({"success": True, "removed": removed, **_store().get_stats()})


@api_bp.errorhandler(Exception)
def handle_unexpected(exc):
    """Never leak internals: log server-side, return a generic JSON error."""
    current_app.logger.exception("Unhandled error on API route")
    return jsonify({"success": False, "error": "server_error", "message": "Internal server error"}), 500
