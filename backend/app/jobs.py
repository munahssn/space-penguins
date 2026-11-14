"""
Background jobs, so a request for a new spot of sky never waits on a slow download.

- A job = "download, align and stack this (ra, dec, fov, det)"; its key is the cache key.
- Identical requests share one job (nobody starts the same work twice).
- At most MAX_RUNNING jobs run at once; the rest wait in a FIFO queue and see their position.
- The API answers 202 {"status": "queued", "position": n} or
  {"status": "processing", "done": d, "total": t} until the result is on disk, then 200.

State lives in memory, so run exactly ONE uvicorn worker (several workers would each have
their own queue and the limits would not hold). Finished results are on disk and survive a restart;
running jobs do not.
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
        cache.compute_and_save(*args, progress=progress)
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


def result(ra, dec, fov, det):
    """('done', (stacks, meta, grid)) when the data is ready, else ('pending', info).
    Raises HTTPException when the job failed (404 no data, 502 IRSA failed) or the queue is full (503)."""
    global _counter
    ready = cache.load_cached(ra, dec, fov, det)
    if ready:
        return "done", ready
    if MOCK:  # fake data is instant: no job needed
        return "done", cache.compute_and_save(ra, dec, fov, det)

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
            return "pending", _info(job)
        queued = sum(1 for j in _jobs.values() if j.status == "queued")
        if queued >= MAX_QUEUED:
            raise HTTPException(503, "Too many requests waiting, please try again in a minute")
        _counter += 1
        job = _jobs[key] = Job(_counter)
        _pool.submit(_run, job, (ra, dec, fov, det))
        info = _info(job)
    # a job that finished between our first check and now
    ready = cache.load_cached(ra, dec, fov, det)
    return ("done", ready) if ready else ("pending", info)


def stats():
    with _lock:
        return {"jobs_running": sum(1 for j in _jobs.values() if j.status == "processing"),
                "jobs_queued": sum(1 for j in _jobs.values() if j.status == "queued")}
