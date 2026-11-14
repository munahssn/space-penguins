"""
SPHEREx Blink API.

Run (from backend/):
    uvicorn app.main:app --reload              # real data from IRSA
    SPHEREX_MOCK=1 uvicorn app.main:app --reload   # fake data, no internet
    (Windows PowerShell: $env:SPHEREX_MOCK=1; uvicorn app.main:app --reload)

Open http://localhost:8000 for the frontend, http://localhost:8000/docs for the API.

Layout:
    config.py       settings (mock mode, paths, CORS, proxy, limits); env vars listed there
    ratelimit.py    per-IP rate limit (429)
    cache.py        disk cache of stacked images
    validation.py   query parameter checks
    routers/        one file per group of endpoints
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import CORS_ORIGINS, FRONTEND_DIR
from .ratelimit import RateLimitMiddleware
from .routers import analysis, context, explain, frames, images, resolve, system

app = FastAPI(title="SPHEREx Blink API")
# The last middleware added is the outermost: CORS wraps the rate limit, so a 429 still carries
# the CORS headers and the browser lets the page read it.
app.add_middleware(RateLimitMiddleware)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["GET"], allow_headers=["*"])

app.include_router(system.router)
app.include_router(resolve.router)
app.include_router(frames.router)
app.include_router(images.router)
app.include_router(analysis.router)
app.include_router(context.router)
app.include_router(explain.router)

# Serve the frontend from the same server (must be mounted last)
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
