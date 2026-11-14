"""
SPHEREx Blink API.

Run (from backend/):
    uvicorn app.main:app --reload              # real data from IRSA
    SPHEREX_MOCK=1 uvicorn app.main:app --reload   # fake data, no internet
    (Windows PowerShell: $env:SPHEREX_MOCK=1; uvicorn app.main:app --reload)

Open http://localhost:8000 for the frontend, http://localhost:8000/docs for the API.

Layout:
    config.py       settings (mock mode, paths, detectors)
    cache.py        disk cache of stacked images
    validation.py   query parameter checks
    routers/        one file per group of endpoints
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import FRONTEND_DIR
from .routers import analysis, context, frames, resolve, system

app = FastAPI(title="SPHEREx Blink API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"], allow_headers=["*"])

app.include_router(system.router)
app.include_router(resolve.router)
app.include_router(frames.router)
app.include_router(analysis.router)
app.include_router(context.router)

# Serve the frontend from the same server (must be mounted last)
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
