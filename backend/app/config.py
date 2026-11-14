"""Settings shared by the whole backend.

Environment variables (all optional):
    SPHEREX_MOCK=1          fake data, no internet
    CORS_ORIGINS            comma-separated websites allowed to call the API from a browser,
                            e.g. "https://spherex-blink.vercel.app,https://blink.example.com".
                            Default: localhost development servers only. "*" allows everyone.
    TRUST_PROXY_HOPS=1      number of reverse proxies in front of the app (Hugging Face, ...).
                            With 1 the client IP is the LAST address in X-Forwarded-For (the one our
                            own proxy added). Leave 0 when running without a proxy: the header can
                            then be forged and would let anyone dodge the rate limit.
    RATE_LIMIT=off          turn the per-IP rate limit off (tests, precache)
    MAX_EXPOSURES_PER_JOB   most exposures one request may download / return (default 400)
"""
import os
from pathlib import Path


def _env_int(name, default):
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


MOCK = os.environ.get("SPHEREX_MOCK") == "1"
CACHE_DIR = Path(__file__).resolve().parent.parent / "cache"
FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"
DETECTORS = {"D1", "D2", "D3", "D4", "D5", "D6", "all"}
MODES = {"epoch", "exposure"}
MAX_EXPOSURES_PER_JOB = _env_int("MAX_EXPOSURES_PER_JOB", 400)  # also the most frames exposure mode returns

# Browsers on other websites may only call us if their address is listed here.
# (This does not stop scripts, curl or other servers; the rate limit covers those.)
DEV_ORIGINS = [f"http://{h}:{p}" for h in ("localhost", "127.0.0.1") for p in (8000, 5173, 3000, 4173)]
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()] or DEV_ORIGINS

TRUST_PROXY_HOPS = _env_int("TRUST_PROXY_HOPS", 0)
RATE_LIMIT_ON = os.environ.get("RATE_LIMIT", "on").lower() != "off"
