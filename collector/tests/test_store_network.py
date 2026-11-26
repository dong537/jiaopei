import hashlib
import os
import sqlite3
import subprocess
import sys

import httpx
import pytest

from edu_collector.network import CaptureBlocked, CaptureFailed, capture, site_lock
from edu_collector.store import BudgetExceeded, IncompleteCapture, Store


HOST = "jyj.longyan.gov.cn"
URL = "https://jyj.longyan.gov.cn/zwgk/gggs/202604/example.xlsx"


def make_run(tmp_path, max_requests=2):
    store = Store(tmp_path)
    run_id = store.new_run(
        "longyan-2026-white-nonsubject", HOST,
        max_pages=1, max_ids=5, max_requests=max_requests,
    )
    return store, run_id


def test_budget_is_reserved_before_request_and_crash_is_visible(tmp_path):
    store, run_id = make_run(tmp_path, max_requests=1)
    first = store.begin_attempt(run_id, "list", URL)
    assert store.get_attempt(first)["state"] == "started"
    with pytest.raises(BudgetExceeded):
        store.begin_attempt(run_id, "list", URL)
    with pytest.raises(IncompleteCapture):
        store.ensure_site_ready(HOST)


def test_403_raw_response_survives_and_blocks_site(tmp_path):
    store, run_id = make_run(tmp_path)
    transport = httpx.MockTransport(lambda _: httpx.Response(403, content=b"denied by site"))
    with pytest.raises(CaptureBlocked, match="403"):
        capture(store, run_id, HOST, "list", URL, transport=transport)
    (attempt,) = store.attempts(run_id)
    assert attempt["http_status"] == 403
    assert attempt["state"] == "blocked"
    assert store.raw_bytes(attempt["attempt_id"]) == b"denied by site"
    assert attempt["sha256"] == hashlib.sha256(b"denied by site").hexdigest()
    assert attempt["ended_at_utc"] and attempt["duration_ms"] >= 0
    with pytest.raises(IncompleteCapture):
        store.ensure_site_ready(HOST)


def test_429_records_retry_after_and_does_not_retry(tmp_path):
    store, run_id = make_run(tmp_path, max_requests=3)
    calls = []

    def respond(request):
        calls.append(request.url)
        return httpx.Response(429, headers={"Retry-After": "120"}, content=b"slow down")

    with pytest.raises(CaptureBlocked, match="429"):
        capture(store, run_id, HOST, "list", URL, transport=httpx.MockTransport(respond), max_retries=1)
    assert len(calls) == 1
    assert store.attempts(run_id)[0]["retry_after"] == "120"


def test_bounded_retry_keeps_both_raw_observations(tmp_path):
    store, run_id = make_run(tmp_path, max_requests=2)
    statuses = iter([503, 200])
    transport = httpx.MockTransport(lambda _: httpx.Response(next(statuses), content=b"result"))
    final_attempt = capture(store, run_id, HOST, "list", URL, transport=transport, max_retries=1)
    attempts = store.attempts(run_id)
    assert len(attempts) == 2
    assert attempts[0]["http_status"] == 503
    assert attempts[1]["attempt_id"] == final_attempt
    assert all(store.raw_bytes(a["attempt_id"]) == b"result" for a in attempts)


def test_retry_cannot_exceed_request_budget(tmp_path):
    store, run_id = make_run(tmp_path, max_requests=1)
    transport = httpx.MockTransport(lambda _: httpx.Response(503, content=b"temporary"))
    with pytest.raises(BudgetExceeded):
        capture(store, run_id, HOST, "list", URL, transport=transport, max_retries=1)
    assert len(store.attempts(run_id)) == 1
    assert store.get_run(run_id)["state"] == "stopped_budget"


def test_opaque_network_failure_is_visible_not_empty_success(tmp_path):
    store, run_id = make_run(tmp_path)
    def fail(_):
        raise httpx.ConnectError("connection refused")
    with pytest.raises(CaptureFailed):
        capture(store, run_id, HOST, "list", URL, transport=httpx.MockTransport(fail))
    assert store.attempts(run_id)[0]["state"] == "failed"
    assert store.attempts(run_id)[0]["raw_path"] is None


def test_timeout_retry_is_bounded_and_retains_failed_attempt(tmp_path):
    store, run_id = make_run(tmp_path, max_requests=2)
    calls = 0
    def respond(_):
        nonlocal calls
        calls += 1
        if calls == 1:
            raise httpx.ConnectTimeout("temporary")
        return httpx.Response(200, content=b"recovered")
    capture(store, run_id, HOST, "list", URL, transport=httpx.MockTransport(respond), max_retries=1)
    attempts = store.attempts(run_id)
    assert calls == 2
    assert attempts[0]["business_status"] == "network_retryable"
    assert attempts[0]["state"] == "retryable"
    assert attempts[1]["http_status"] == 200


def test_review_retry_only_transient_failures(tmp_path):
    store, run_id = make_run(tmp_path)
    attempt_id = store.begin_attempt(run_id, "list", URL)
    store.record_error(attempt_id, "ConnectTimeout", 4.0)
    store.review_retry(attempt_id, "operator checked network interruption")
    assert store.get_attempt(attempt_id)["state"] == "reviewed"
    assert store.get_run(run_id)["state"] == "reviewed"
    with pytest.raises(ValueError):
        store.review_retry(attempt_id, "again")

    blocked_store, blocked_run = make_run(tmp_path / "blocked")
    blocked_id = blocked_store.begin_attempt(blocked_run, "list", URL)
    blocked_store.record_http(blocked_id, 429, {"Retry-After": "120"}, b"wait", 2.0)
    blocked_store.set_attempt_state(blocked_id, "blocked", "http_429")
    with pytest.raises(ValueError):
        blocked_store.review_retry(blocked_id, "request again")
    with pytest.raises(ValueError):
        blocked_store.review_reverify(blocked_id, "recheck the blocked response")


def test_site_lock_is_exclusive_across_processes(tmp_path):
    child = "from edu_collector.network import site_lock; import sys; site_lock(sys.argv[1],sys.argv[2]).acquire(timeout=0)"
    with site_lock(tmp_path, HOST).acquire(timeout=0):
        result = subprocess.run([sys.executable, "-c", child, os.fspath(tmp_path), HOST], capture_output=True, text=True, timeout=10)
    assert result.returncode != 0 and "Timeout" in result.stderr


def test_site_lock_is_shared_across_data_directories(tmp_path):
    child = "from edu_collector.network import site_lock; import sys; site_lock(sys.argv[1],sys.argv[2]).acquire(timeout=0)"
    with site_lock(tmp_path / "first", HOST).acquire(timeout=0):
        result = subprocess.run([sys.executable, "-c", child, os.fspath(tmp_path / "second"), HOST], capture_output=True, text=True, timeout=10)
    assert result.returncode != 0 and "Timeout" in result.stderr


def test_interruption_after_raw_write_reconciles_without_refetch(tmp_path):
    store, run_id = make_run(tmp_path, max_requests=1)
    attempt_id = store.begin_attempt(run_id, "list", URL)
    store.record_http(attempt_id, 200, {"Content-Type": "application/octet-stream"}, b"raw bytes", 5.0)
    with sqlite3.connect(store.db_path) as db:
        db.execute("UPDATE attempts SET state='started',raw_path=NULL,sha256=NULL,http_status=NULL WHERE attempt_id=?", (attempt_id,))
    assert store.reconcile_orphaned() == [attempt_id]
    assert store.get_attempt(attempt_id)["state"] == "captured"
    assert store.raw_bytes(attempt_id) == b"raw bytes"
    assert store.reconcile_orphaned() == []


def test_tampered_orphan_remains_blocked_for_manual_review(tmp_path):
    store, run_id = make_run(tmp_path)
    attempt_id = store.begin_attempt(run_id, "list", URL)
    store.record_http(attempt_id, 200, {}, b"original", 1.0)
    with sqlite3.connect(store.db_path) as db:
        db.execute("UPDATE attempts SET state='started',raw_path=NULL,sha256=NULL,http_status=NULL WHERE attempt_id=?", (attempt_id,))
    (store.root / "raw" / f"{attempt_id}.bin").write_bytes(b"tampered")
    assert store.reconcile_orphaned() == []
    with pytest.raises(IncompleteCapture):
        store.ensure_site_ready(HOST)


def test_orphaned_server_error_remains_blocked(tmp_path):
    store, run_id = make_run(tmp_path)
    attempt_id = store.begin_attempt(run_id, "list", URL)
    store.record_http(attempt_id, 500, {}, b"server error", 1.0)
    with sqlite3.connect(store.db_path) as db:
        db.execute("UPDATE attempts SET state='started',raw_path=NULL,sha256=NULL,http_status=NULL WHERE attempt_id=?", (attempt_id,))
    assert store.reconcile_orphaned() == [attempt_id]
    assert store.get_attempt(attempt_id)["state"] == "blocked"
    with pytest.raises(IncompleteCapture):
        store.ensure_site_ready(HOST)
