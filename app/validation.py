"""Sticker format validation rules (pure functions, no Flask dependencies).

Formats:
    Surbhi sticker:        VPN$lotcode$datecode$qty   (4 non-empty $-separated parts)
    Manufacturing sticker: VPN                        (single value, no '$')
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional


@dataclass(frozen=True)
class ValidationResult:
    valid: bool
    error: Optional[str] = None
    vpn: Optional[str] = None
    parts: Optional[List[str]] = None

    def to_dict(self) -> dict:
        out = {"valid": self.valid}
        if self.error:
            out["error"] = self.error
        if self.vpn is not None:
            out["vpn"] = self.vpn
        if self.parts is not None:
            out["parts"] = self.parts
        return out


def validate_surbhi(data) -> ValidationResult:
    """Validate the Surbhi sticker: ``VPN$lotcode$datecode$qty``."""
    if not data or not isinstance(data, str):
        return ValidationResult(False, error="Surbhi sticker data is empty")

    parts = [p.strip() for p in data.strip().split("$")]

    if len(parts) != 4:
        return ValidationResult(
            False, error="Surbhi sticker must have format: VPN$lotcode$datecode$qty"
        )

    for i, part in enumerate(parts):
        if not part:
            return ValidationResult(False, error=f"Part {i + 1} is empty in Surbhi sticker")

    return ValidationResult(True, vpn=parts[0], parts=parts)


def validate_manufacturing(data) -> ValidationResult:
    """Validate the Manufacturing sticker: VPN only (no '$' allowed)."""
    if not data or not isinstance(data, str):
        return ValidationResult(False, error="Manufacturing sticker data is empty")

    value = data.strip()

    if "$" in value:
        return ValidationResult(
            False, error="Manufacturing sticker must contain only VPN (no $ allowed)"
        )

    if not value:
        return ValidationResult(False, error="Manufacturing sticker VPN is empty")

    return ValidationResult(True, vpn=value)
