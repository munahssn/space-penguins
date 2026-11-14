"""
Per-IP rate limit, so one visitor (or script) cannot use up the free server or hammer IRSA.

A sliding window in memory: at most N requests per route group per client per minute, then
HTTP 429 with a Retry-After header. Like jobs.py it lives in memory, so it assumes ONE uvicorn
worker; a restart resets the counters. Static files (the frontend) are never limited.
"""
import time
from collections import deque

from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from .config import RATE_LIMIT_ON, TRUST_PROXY_HOPS

WINDOW = 60  # seconds

# (path prefix, group name, max requests per WINDOW). The first match wins.
LIMITS = [
    # may start a download job. A page polling a pending job every 2 s makes 30 requests a minute,
    # so this must stay well above 30; the job queue (jobs.py) bounds the real work.
    ("/api/frames", "heavy", 60),
    ("/api/diff", "heavy", 60),
    ("/api/explain", "explain", 10),  # will call an LLM
    ("/api/resolve", "resolve", 30),  # calls an outside name service
    ("/img/", "img", 600),            # exposure mode can show 400 images at once
    ("/api/", "other", 120),
]

_hits = {}  # (group, ip) -> deque of request times
MAX_KEYS = 10_000


def client_ip(request):
    """The caller's address. Behind our own proxy (TRUST_PROXY_HOPS=1) it is the last entry of
    X-Forwarded-For, which the proxy appended; earlier entries can be forged by the client."""
    if TRUST_PROXY_HOPS > 0:
        parts = [p.strip() for p in request.headers.get("x-forwarded-for", "").split(",") if p.strip()]
        if len(parts) >= TRUST_PROXY_HOPS:
            return parts[-TRUST_PROXY_HOPS]
    return request.client.host if request.client else "unknown"


def _rule(path):
    for prefix, group, limit in LIMITS:
        if path.startswith(prefix):
            return group, limit
    return None


def check(group, ip, limit, now=None):
    """(allowed, seconds to wait). Records the request when allowed."""
    now = time.monotonic() if now is None else now
    if len(_hits) > MAX_KEYS:  # forget clients that have been quiet for a whole window
        for k in [k for k, q in _hits.items() if not q or now - q[-1] > WINDOW]:
            del _hits[k]
    q = _hits.setdefault((group, ip), deque())
    while q and now - q[0] > WINDOW:
        q.popleft()
    if len(q) >= limit:
        return False, max(1, int(WINDOW - (now - q[0])) + 1)
    q.append(now)
    return True, 0


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        rule = _rule(request.url.path) if RATE_LIMIT_ON and request.method == "GET" else None
        if rule and request.url.path != "/api/health":
            group, limit = rule
            ok, wait = check(group, client_ip(request), limit)
            if not ok:
                return JSONResponse(
                    status_code=429, headers={"Retry-After": str(wait)},
                    content={"detail": f"Too many requests, please wait {wait} s and try again"})
        return await call_next(request)
