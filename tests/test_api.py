"""Integration tests for the HTTP API (real SQLite via tmp_path)."""


def verify(client, surbhi, manufacturing):
    return client.post(
        "/api/verify", json={"surbhi": surbhi, "manufacturing": manufacturing}
    )


class TestVerify:
    def test_pass_updates_stats(self, client):
        r = verify(client, "VPN123$LOT$DATE$10", "VPN123")
        assert r.status_code == 200
        body = r.get_json()
        assert body["success"] is True
        assert body["result"] == "PASS"
        assert body["total_scans"] == 1 and body["pass_count"] == 1

    def test_vpn_mismatch_is_fail_but_http_200(self, client):
        r = verify(client, "VPN123$LOT$DATE$10", "VPN999")
        assert r.status_code == 200  # a completed verification, not a request error
        body = r.get_json()
        assert body["result"] == "FAIL" and "mismatch" in body["message"]
        assert body["fail_count"] == 1

    def test_invalid_surbhi_format_returns_400_and_records(self, client):
        r = verify(client, "not-a-valid-sticker", "VPN123")
        assert r.status_code == 400
        assert r.get_json()["error"] == "invalid_format"
        # failed attempts are still counted (matches original intent)
        stats = client.get("/api/stats").get_json()
        assert stats["total_scans"] == 1 and stats["fail_count"] == 1

    def test_invalid_manufacturing_format_returns_400(self, client):
        r = verify(client, "VPN123$LOT$DATE$10", "VPN$123")
        assert r.status_code == 400

    def test_empty_body(self, client):
        r = client.post("/api/verify", content_type="application/json", data="")
        assert r.status_code == 400
        assert r.get_json()["error"] == "empty_request"

    def test_non_string_input_rejected(self, client):
        r = client.post("/api/verify", json={"surbhi": {"x": 1}, "manufacturing": "A"})
        assert r.status_code == 400
        assert r.get_json()["error"] == "invalid_input"

    def test_no_internal_error_leak(self, client):
        r = client.post("/api/verify", data="{{{{", content_type="application/json")
        body = r.get_json()
        assert body["error"] == "empty_request"
        assert "Traceback" not in str(body)


class TestStatePersistence:
    """The core fix: state lives server-side, independent of cookies."""

    def test_stats_survive_new_client_without_session_cookie(self, client, app):
        verify(client, "VPN1$A$B$C", "VPN1")
        fresh = app.test_client()  # no cookies carried over
        stats = fresh.get("/api/stats").get_json()
        assert stats["total_scans"] == 1  # would have been 0 with cookie storage

    def test_recent_scans_and_history(self, client):
        verify(client, "VPN1$A$B$C", "VPN1")
        verify(client, "VPN2$A$B$C", "VPN9")
        recent = client.get("/api/recent-scans").get_json()
        assert len(recent) == 2
        assert recent[0]["vpn"] == "VPN2" and recent[0]["result"] == "FAIL"
        history = client.get("/api/history").get_json()
        assert history[0]["result"] == "FAIL" and history[1]["result"] == "PASS"

    def test_clear_wipes_everything(self, client):
        verify(client, "VPN1$A$B$C", "VPN1")
        r = client.post("/api/clear")
        assert r.get_json()["removed"] == 1
        assert client.get("/api/stats").get_json()["total_scans"] == 0


class TestPages:
    def test_index_renders(self, client):
        r = client.get("/")
        assert r.status_code == 200
        assert b"Spool Verification" in r.data
