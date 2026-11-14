"""Settings shared by the whole backend."""
import os
from pathlib import Path

MOCK = os.environ.get("SPHEREX_MOCK") == "1"
CACHE_DIR = Path(__file__).resolve().parent.parent / "cache"
FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"
DETECTORS = {"D1", "D2", "D3", "D4", "D5", "D6", "all"}
