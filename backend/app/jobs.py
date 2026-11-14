"""
Background jobs, so a request for a new spot of sky never waits on a slow download.

- A job = "download every exposure for this (ra, dec, fov, det) into the cache". That is the only
  slow step; wavelength filtering, stacking and diffs are fast and run per request afterwards.
- Identical requests share one job (nobody starts the same work twice).
- At most MAX_RUNNING jobs run at once; the rest wait in a FIFO queue and see their position.
- While the data is not ready the API answers 202 {"status": "queued", "position": n} or
  {"status": "processing", "done": d, "total": t}, then 200 once it is on disk.

State lives in memory, so run exactly ONE uvicorn worker (several workers would each have
their own queue and the limits would not hold). Finished downloads are on disk and survive a
restart; running jobs do not.
"""
import threading
from concurrent.futures import ThreadPoolExecutor

from fastapi import HTTPException

from . import cache
from .config import MOCK

MAX_RUNNING = 2    # the free host has 2 CPUs, and IRSA should not be hammered
MAX_QUEUED = 20    # more than this waiting: ask the client to come back later

_lock = threading.Lock()
_jobs = {}         # key -> Job, only while queued, running or failed (done jobs are removed)
_counter = 0
_pool = ThreadPoolExecutor(max_workers=MAX_RUNNING, thread_name_prefix="job")


class Job:
    def __init__(self, order):
        self.order = order        # arrival number, defines queue position
        self.status = "queued"    # queued -> processing -> done | error
        self.done = 0
        self.total = 0
        self.error = None         # (http status, message)


def _run(job, args):
    with _lock:
        job.status = "processing"

    def progress(done, total):
        job.done, job.total = done, total

    try:
        cache.get_exposures(*args, progress=progress)
    except HTTPException as e:
        job.error = (e.status_code, e.detail)
    except Exception as e:  # never let a job die silently
        job.error = (500, f"job failed: {e}")
    with _lock:
        job.status = "error" if job.error else "done"


def _info(job):
    if job.status == "queued":
        position = 1 + sum(1 for j in _jobs.values() if j.status == "queued" and j.order < job.order)
        return {"status": "queued", "position": position}
    return {"status": "processing", "done": job.done, "total": job.total}


def pending(ra, dec, fov, det):
    """None when the data is ready (read it with cache.get_stacks), otherwise a status dict
    for a 202 answer. Starts a job if needed. Raises HTTPException when the job failed
    (404 no data, 502 IRSA failed, reported once) or too many requests are waiting (503)."""
    global _counter
    if cache.is_cached(ra, dec, fov, det):
        return None
    if MOCK:  # fake data is instant: no job needed
        cache.get_exposures(ra, dec, fov, det)
        return None

    key = cache.cache_key(ra, dec, fov, det)
    with _lock:
        job = _jobs.get(key)
        if job and job.status == "error":
            del _jobs[key]  # report once; the next request starts a fresh job
            raise HTTPException(*job.error)
        if job and job.status == "done":
            del _jobs[key]
            job = None
        if job:
            return _info(job)
        queued = sum(1 for j in _jobs.values() if j.status == "queued")
        if queued >= MAX_QUEUED:
            raise HTTPException(503, "Too many requests waiting, please try again in a minute")
        _counter += 1
        job = _jobs[key] = Job(_counter)
        _pool.submit(_run, job, (ra, dec, fov, det))
        info = _info(job)
    # a job that finished between our first check and now
    return None if cache.is_cached(ra, dec, fov, det) else info


def stats():
    with _lock:
        return {"jobs_running": sum(1 for j in _jobs.values() if j.status == "processing"),
                "jobs_queued": sum(1 for j in _jobs.values() if j.status == "queued")}
