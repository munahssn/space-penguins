"""Settings shared by the whole backend.

Everything below is OFF or wide open by default, so nothing gets in the way while the team builds
and demos. Turn things on with environment variables when the site is public:

    SPHEREX_MOCK=1          fake data, no internet
    CORS_ORIGINS            comma-separated websites allowed to call the API from a browser,
                            e.g. "https://spherex-blink.vercel.app". Default: everyone ("*").
    RATE_LIMIT=on           per-IP rate limit (default off); numbers are in ratelimit.py
    TRUST_PROXY_HOPS=1      only matters with RATE_LIMIT=on and a proxy in front (Hugging Face, ...):
                            the client IP is then the LAST address in X-Forwarded-For (the one our own
                            proxy added). Leave 0 without a proxy: the header can be forged.
    MAX_DOWNLOAD_EXPOSURES  refuse requests that would download more exposures than this
                            (default 0 = no limit)
    MAX_EXPOSURES_PER_JOB   most frames exposure mode returns (default 400)
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
MAX_EXPOSURES_PER_JOB = _env_int("MAX_EXPOSURES_PER_JOB", 400)  # most frames exposure mode returns
MAX_DOWNLOAD_EXPOSURES = _env_int("MAX_DOWNLOAD_EXPOSURES", 0)  # 0 = no limit

# Browsers on other websites may only call us if their address is listed here.
# (This does not stop scripts, curl or other servers.)
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()] or ["*"]

RATE_LIMIT_ON = os.environ.get("RATE_LIMIT", "off").lower() == "on"
TRUST_PROXY_HOPS = _env_int("TRUST_PROXY_HOPS", 0)
