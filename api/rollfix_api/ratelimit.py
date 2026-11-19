"""A small in-memory rate limiter for writes.

Client addresses are only held in memory, hashed with a random per-process key, for at most
an hour. They are never written to the database or to logs.
"""

import hashlib
import hmac
import secrets
import time
from collections import deque


class RateLimiter:
    def __init__(self, limit: int, window_seconds: float = 3600.0) -> None:
        self.limit = limit
        self.window = window_seconds
        self._key = secrets.token_bytes(32)
        self._hits: dict[bytes, deque[float]] = {}

    def _client(self, address: str) -> bytes:
        return hmac.new(self._key, address.encode(), hashlib.sha256).digest()

    def allow(self, address: str, now: float | None = None) -> bool:
        now = time.monotonic() if now is None else now
        key = self._client(address)
        hits = self._hits.setdefault(key, deque())
        while hits and now - hits[0] > self.window:
            hits.popleft()
        if len(hits) >= self.limit:
            return False
        hits.append(now)
        if len(self._hits) > 50_000:
            self._sweep(now)
        return True

    def _sweep(self, now: float) -> None:
        stale = [
            key for key, hits in self._hits.items() if not hits or now - hits[-1] > self.window
        ]
        for key in stale:
            del self._hits[key]

    def reset(self) -> None:
        self._hits.clear()
