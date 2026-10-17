"""Unit tests for sticker format validation."""

import pytest

from app.validation import validate_manufacturing, validate_surbhi


class TestValidateSurbhi:
    def test_valid(self):
        r = validate_surbhi("VPN123$LOT456$20241014$100")
        assert r.valid and r.vpn == "VPN123" and r.parts[3] == "100"

    @pytest.mark.parametrize("bad", ["", None, 123, "A$B$C", "A$$C$D", "$B$C$D", "A$B$C$D$E"])
    def test_invalid(self, bad):
        assert not validate_surbhi(bad).valid

    def test_strips_whitespace(self):
        r = validate_surbhi("  VPN1 $ L $ D $ Q ")
        assert r.valid and r.vpn == "VPN1"


class TestValidateManufacturing:
    def test_valid(self):
        r = validate_manufacturing("VPN123")
        assert r.valid and r.vpn == "VPN123"

    @pytest.mark.parametrize("bad", ["", None, 42, "VPN$123", "   "])
    def test_invalid(self, bad):
        assert not validate_manufacturing(bad).valid
