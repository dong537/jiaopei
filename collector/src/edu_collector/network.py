"""One process per site: bounded HTTP capture that never discards responses."""

from __future__ import annotations

import re
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

import httpx
from filelock import FileLock, Timeout

from .store import Store


class CaptureBlocked(RuntimeError):
    pass


class CaptureFailed(RuntimeError):
    pass


def site_lock(root: str | Path, host: str) -> FileLock:
    if not re.fullmatch(r"[A-Za-z0-9.-]+", host):
        raise ValueError("invalid site host")
    # Shared by every data directory on this machine; never lock only a run's private root.
    path = Path(tempfile.gettempdir()) / "edu-collector-site-locks" / f"{host.lower()}.lock"
    path.parent.mkdir(parents=True, exist_ok=True)
    return FileLock(path)


def _wait_interval(store: Store, host: str, seconds: float, sleeper) -> None:
    if seconds <= 0:
        return
    last = store.last_request_started(host)
    if last is None:
        sleeper(seconds)
        return
    elapsed = (datetime.now(timezone.utc) - datetime.fromisoformat(last)).total_seconds()
    sleeper(max(0.0, seconds - elapsed))


def capture(
    store: Store, run_id: str, host: str, purpose: str, url: str, *,
    transport: httpx.BaseTransport | None = None, min_interval_seconds: float = 0.0,
    max_retries: int = 0, timeout_seconds: float = 20.0, sleeper=time.sleep,
) -> str:
    if urlsplit(url).scheme != "https" or urlsplit(url).hostname != host:
        raise ValueError("request URL must be HTTPS on the configured site")
    if purpose not in {"probe", "list", "detail"}:
        raise ValueError("unknown request purpose")
    if max_retries < 0 or max_retries > 1:
        raise ValueError("only zero or one recovery retry is supported")
    run = store.get_run(run_id)
    if run["host"] != host:
        raise ValueError("run/site mismatch")
    lock = site_lock(store.root, host)
    try:
        with lock.acquire(timeout=0):
            store.ensure_site_ready(host)
            with httpx.Client(transport=transport, timeout=timeout_seconds, follow_redirects=False, headers={"User-Agent": "edu-source-research/0.1"}) as client:
                for retry in range(max_retries + 1):
                    _wait_interval(store, host, min_interval_seconds, sleeper)
                    attempt_id = store.begin_attempt(run_id, purpose, url)
                    started = time.perf_counter()
                    try:
                        response = client.get(url)
                    except httpx.RequestError as exc:
                        duration_ms = (time.perf_counter() - started) * 1000
                        retryable = retry < max_retries and isinstance(exc, (httpx.TimeoutException, httpx.ConnectError))
                        store.record_error(attempt_id, type(exc).__name__, duration_ms, retryable=retryable)
                        if retryable:
                            continue
                        raise CaptureFailed(f"network request failed; attempt={attempt_id}") from exc
                    duration_ms = (time.perf_counter() - started) * 1000
                    store.record_http(attempt_id, response.status_code, dict(response.headers), response.content, duration_ms)
                    if response.status_code == 200:
                        store.set_attempt_state(attempt_id, "captured", "http_ok_unverified")
                        store.set_run_state(run_id, "captured")
                        return attempt_id
                    if response.status_code in {401, 403, 429} or 300 <= response.status_code < 400:
                        store.set_attempt_state(attempt_id, "blocked", f"http_{response.status_code}", f"HTTP {response.status_code}")
                        raise CaptureBlocked(f"HTTP {response.status_code}; attempt={attempt_id}; stop this site")
                    if response.status_code in {502, 503, 504} and retry < max_retries:
                        store.set_attempt_state(attempt_id, "retryable", f"http_{response.status_code}")
                        continue
                    store.set_attempt_state(attempt_id, "failed", f"http_{response.status_code}", f"HTTP {response.status_code}")
                    raise CaptureFailed(f"HTTP {response.status_code}; attempt={attempt_id}")
    except Timeout as exc:
        raise CaptureBlocked(f"site {host} is already being fetched by another process") from exc
    raise AssertionError("bounded capture ended without outcome")
