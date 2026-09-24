from __future__ import annotations

from typing import Any


class ApiError(Exception):
    """Rendered as ``{"error": {"code", "message", "details"}}`` (spec §5)."""

    def __init__(self, status: int, code: str, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.details = details or {}


def not_found(what: str) -> ApiError:
    return ApiError(404, "NOT_FOUND", f"{what} not found")


def plan_limit(message: str, **details: Any) -> ApiError:
    return ApiError(403, "PLAN_LIMIT", message, details)
