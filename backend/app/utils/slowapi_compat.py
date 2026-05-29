"""Compatibility layer for optional slowapi dependency.

The production image on some servers may not have slowapi installed.
We keep the import surface identical enough for the app to boot, while
silently disabling rate limiting when the dependency is unavailable.
"""

from __future__ import annotations

from typing import Any, Callable

try:  # pragma: no cover - best effort import guard
    from slowapi import Limiter as SlowapiLimiter  # type: ignore
    from slowapi.util import get_remote_address  # type: ignore
    from slowapi.errors import RateLimitExceeded  # type: ignore
    from slowapi import _rate_limit_exceeded_handler  # type: ignore

    Limiter = SlowapiLimiter
    slowapi_available = True
except Exception:  # pragma: no cover - runtime fallback for missing package
    slowapi_available = False

    class RateLimitExceeded(Exception):
        pass

    def get_remote_address(*args: Any, **kwargs: Any) -> str:
        return "127.0.0.1"

    def _rate_limit_exceeded_handler(*args: Any, **kwargs: Any):
        raise RateLimitExceeded("Rate limiting is unavailable in this runtime")

    class Limiter:
        def __init__(self, *args: Any, **kwargs: Any):
            pass

        def limit(self, *args: Any, **kwargs: Any):
            def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
                return func

            return decorator
