"""
Read small pieces of SPHEREx FITS files straight from IRSA's public S3 bucket
with HTTP range requests, instead of downloading the whole ~65 MB file.

The bucket is public (no credentials). In each file IMAGE, VARIANCE and ZODI are plain
float32 arrays, FLAGS is tile-compressed (one tile per image row), so astropy's lazy
`.section[...]` reads only the bytes it needs. No extra dependencies: just `requests`.
"""
import io
import threading
from collections import OrderedDict

import requests
from astropy.io import fits

S3_BASE = "https://nasa-irsa-spherex.s3.us-east-1.amazonaws.com/"
IRSA_IBE_PREFIX = "https://irsa.ipac.caltech.edu/ibe/data/spherex/"
BLOCK = 256 * 1024          # bytes fetched per request (and cached)
MAX_CACHED_BLOCKS = 64      # per file: 16 MB at most
TIMEOUT = 60

_local = threading.local()


def _session():
    if not hasattr(_local, "s"):
        _local.s = requests.Session()
    return _local.s


def s3_url_from_access_url(access_url):
    """IRSA access URLs (.../ibe/data/spherex/<path>.fits?center=...) -> S3 URL of the whole file."""
    base = access_url.split("?")[0]
    if not base.startswith(IRSA_IBE_PREFIX):
        raise ValueError(f"not an IRSA SPHEREx URL: {access_url}")
    return S3_BASE + base[len(IRSA_IBE_PREFIX):]


class RangeFile(io.RawIOBase):
    """Read-only, seekable file object over HTTP range requests with a small block cache."""

    def __init__(self, url):
        self.url = url
        self.pos = 0
        self.blocks = OrderedDict()
        r = _session().get(url, headers={"Range": "bytes=0-0"}, timeout=TIMEOUT)
        if r.status_code != 206:
            raise OSError(f"range request failed ({r.status_code}) for {url}")
        self.size = int(r.headers["Content-Range"].split("/")[1])

    # file protocol
    def readable(self):
        return True

    def seekable(self):
        return True

    def tell(self):
        return self.pos

    def seek(self, offset, whence=io.SEEK_SET):
        if whence == io.SEEK_SET:
            self.pos = offset
        elif whence == io.SEEK_CUR:
            self.pos += offset
        else:
            self.pos = self.size + offset
        return self.pos

    def _block(self, i):
        b = self.blocks.get(i)
        if b is not None:
            self.blocks.move_to_end(i)
            return b
        start = i * BLOCK
        end = min(start + BLOCK, self.size) - 1
        r = _session().get(self.url, headers={"Range": f"bytes={start}-{end}"}, timeout=TIMEOUT)
        if r.status_code != 206:
            raise OSError(f"range request failed ({r.status_code}) for {self.url}")
        self.blocks[i] = r.content
        if len(self.blocks) > MAX_CACHED_BLOCKS:
            self.blocks.popitem(last=False)
        return r.content

    def read(self, n=-1):
        if n is None or n < 0:
            n = self.size - self.pos
        end = min(self.pos + n, self.size)
        out = []
        p = self.pos
        while p < end:
            i = p // BLOCK
            blk = self._block(i)
            lo = p - i * BLOCK
            take = min(len(blk) - lo, end - p)
            out.append(blk[lo:lo + take])
            p += take
        self.pos = p
        return b"".join(out)

    def readinto(self, b):
        data = self.read(len(b))
        b[:len(data)] = data
        return len(data)


def open_remote(url):
    """Open a SPHEREx FITS file lazily over range requests. The HDU list keeps the remote file open."""
    return fits.open(RangeFile(url), memmap=False, lazy_load_hdus=True)
