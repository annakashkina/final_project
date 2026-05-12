"""Tests for serve.py — codeprobe backend.

Covers: authentication (TOFU), rate limiting, input validation, static file
security, bot detection, API endpoints (register, chat, event, feedback,
export, delete, dashboard), data retention, and security headers.

Run:  python3 -m pytest test_serve.py -v
"""

import hashlib
import hmac as hmac_mod
import http.client
import json
import os
import shutil
import sys
import tempfile
import threading
import time
import unittest
from http.server import ThreadingHTTPServer
from unittest.mock import MagicMock, patch

# Patch env before importing serve so it doesn't try to connect to LLM or
# discover tracks from the real filesystem.
os.environ["LLM_API_KEY"] = "test-key"
os.environ["LLM_API_URL"] = "http://localhost:19999/v1/chat/completions"
os.environ["LLM_MODEL"] = "test-model"
os.environ["DASHBOARD_SECRET"] = "test-dashboard-secret"

import serve

# Override DASHBOARD_SECRET in case serve.py loaded a .env file that set it
serve.DASHBOARD_SECRET = "test-dashboard-secret"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

TEST_UID = "11111111-1111-1111-1111-111111111111"
TEST_UID_2 = "22222222-2222-2222-2222-222222222222"
INVALID_UID = "not-a-uuid"
DASHBOARD_SECRET = "test-dashboard-secret"


def _fresh_data_dir():
    """Create a fresh temp data dir and point serve at it."""
    d = tempfile.mkdtemp(prefix="codeprobe_test_")
    serve.DATA_DIR = d
    serve.USERS_FILE = os.path.join(d, "_users.json")
    return d


def _reset_rate_limits():
    serve._rate_hits.clear()


def _register(uid=TEST_UID):
    """Register a UID and return the token."""
    tok = serve.register_uid(uid)
    assert tok is not None, f"register_uid({uid}) returned None"
    return tok


# ---------------------------------------------------------------------------
# Unit tests — pure functions, no server needed
# ---------------------------------------------------------------------------

class TestValidUID(unittest.TestCase):
    def test_valid(self):
        assert serve.valid_uid(TEST_UID)
        assert serve.valid_uid("abcdef01-2345-6789-abcd-ef0123456789")

    def test_invalid(self):
        assert not serve.valid_uid("")
        assert not serve.valid_uid("not-a-uuid")
        assert not serve.valid_uid("11111111-1111-1111-1111-11111111111")  # too short
        assert not serve.valid_uid("11111111-1111-1111-1111-1111111111111")  # too long
        assert not serve.valid_uid("GGGGGGGG-1111-1111-1111-111111111111")  # bad hex


class TestIsBot(unittest.TestCase):
    def test_bots(self):
        assert serve.is_bot("Googlebot/2.1")
        assert serve.is_bot("Mozilla/5.0 (compatible; Bingbot/2.0)")
        assert serve.is_bot("GPTBot")
        assert serve.is_bot("ClaudeBot/1.0")
        assert serve.is_bot("CCBot/2.0")

    def test_normal_agents(self):
        assert not serve.is_bot("Mozilla/5.0 (Macintosh; Intel Mac OS X)")
        assert not serve.is_bot("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
        assert not serve.is_bot("")


class TestValidToken(unittest.TestCase):
    def test_valid(self):
        tok = serve.mint_token()
        assert serve.valid_token(tok)

    def test_invalid(self):
        assert not serve.valid_token("")
        assert not serve.valid_token(None)
        assert not serve.valid_token("short")
        assert not serve.valid_token("has spaces in the token value here!!")


class TestValidateMessages(unittest.TestCase):
    def test_valid_single_user(self):
        msgs = [{"role": "user", "content": "hello"}]
        assert serve.validate_messages(msgs) is None

    def test_valid_system_then_user(self):
        msgs = [
            {"role": "system", "content": "You are a tutor."},
            {"role": "user", "content": "Hi"},
        ]
        assert serve.validate_messages(msgs) is None

    def test_valid_full_conversation(self):
        msgs = [
            {"role": "system", "content": "prompt"},
            {"role": "user", "content": "q1"},
            {"role": "assistant", "content": "a1"},
            {"role": "user", "content": "q2"},
        ]
        assert serve.validate_messages(msgs) is None

    def test_empty(self):
        assert serve.validate_messages([]) is not None

    def test_not_list(self):
        assert serve.validate_messages("hello") is not None

    def test_too_many(self):
        msgs = [{"role": "user", "content": f"msg {i}"} for i in range(21)]
        assert serve.validate_messages(msgs) is not None

    def test_missing_role(self):
        msgs = [{"content": "hello"}]
        assert serve.validate_messages(msgs) is not None

    def test_missing_content(self):
        msgs = [{"role": "user"}]
        assert serve.validate_messages(msgs) is not None

    def test_invalid_role(self):
        msgs = [{"role": "admin", "content": "hello"}]
        assert serve.validate_messages(msgs) is not None

    def test_system_not_first(self):
        msgs = [
            {"role": "user", "content": "hi"},
            {"role": "system", "content": "prompt"},
        ]
        assert serve.validate_messages(msgs) is not None

    def test_multiple_system(self):
        msgs = [
            {"role": "system", "content": "p1"},
            {"role": "system", "content": "p2"},
        ]
        assert serve.validate_messages(msgs) is not None

    def test_too_large(self):
        msgs = [{"role": "user", "content": "x" * 61000}]
        assert serve.validate_messages(msgs) is not None


class TestStaticSafety(unittest.TestCase):
    def test_allowed(self):
        assert serve._is_static_safe("app.js")
        assert serve._is_static_safe("style.css")
        assert serve._is_static_safe("vendor/highlight.js")
        assert serve._is_static_safe("lessons/c.js")
        assert serve._is_static_safe("")  # index

    def test_denied_extensions(self):
        assert not serve._is_static_safe("serve.py")
        assert not serve._is_static_safe("validator.py")
        assert not serve._is_static_safe(".env")
        assert not serve._is_static_safe("validator_model.pkl")
        assert not serve._is_static_safe("data/user.jsonl")
        assert not serve._is_static_safe("deploy/setup.sh")
        assert not serve._is_static_safe("validator_model.pkl.sig")

    def test_path_traversal(self):
        assert not serve._is_static_safe("../etc/passwd")
        assert not serve._is_static_safe("foo/../../../etc/passwd")
        assert not serve._is_static_safe("/etc/passwd")

    def test_null_byte(self):
        assert not serve._is_static_safe("app.js\x00.html")

    def test_backslash(self):
        assert not serve._is_static_safe("foo\\bar.js")

    def test_dotfiles(self):
        assert not serve._is_static_safe(".git/config")
        assert not serve._is_static_safe(".env.example")

    def test_denied_data_prefix(self):
        assert not serve._is_static_safe("data/something.json")

    def test_denied_specific_files(self):
        assert not serve._is_static_safe("_users.json")


# ---------------------------------------------------------------------------
# TOFU authentication
# ---------------------------------------------------------------------------

class TestTOFU(unittest.TestCase):
    def setUp(self):
        self._data_dir = _fresh_data_dir()
        _reset_rate_limits()

    def tearDown(self):
        shutil.rmtree(self._data_dir, ignore_errors=True)

    def test_register_and_verify(self):
        tok = _register()
        assert serve.verify_token(TEST_UID, tok)

    def test_verify_wrong_token(self):
        _register()
        assert not serve.verify_token(TEST_UID, "wrong-token-that-is-long-enough-here")

    def test_verify_unregistered_uid(self):
        assert not serve.verify_token(TEST_UID, "some-token-long-enough-for-regex")

    def test_double_register_returns_none(self):
        _register()
        second = serve.register_uid(TEST_UID)
        assert second is None

    def test_register_invalid_uid(self):
        assert serve.register_uid(INVALID_UID) is None

    def test_different_users_different_tokens(self):
        t1 = _register(TEST_UID)
        t2 = _register(TEST_UID_2)
        assert t1 != t2
        assert serve.verify_token(TEST_UID, t1)
        assert serve.verify_token(TEST_UID_2, t2)
        assert not serve.verify_token(TEST_UID, t2)
        assert not serve.verify_token(TEST_UID_2, t1)

    def test_verify_invalid_uid_format(self):
        assert not serve.verify_token(INVALID_UID, "some-token-long-enough-for-regex")

    def test_verify_empty_token(self):
        _register()
        assert not serve.verify_token(TEST_UID, "")

    def test_token_persists_across_loads(self):
        tok = _register()
        users = serve.load_users()
        assert TEST_UID in users
        assert users[TEST_UID]["token"] == tok
        assert "first_seen" in users[TEST_UID]


# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------

class TestRateLimiting(unittest.TestCase):
    def setUp(self):
        _reset_rate_limits()

    def test_under_limit(self):
        for _ in range(5):
            assert serve.check_rate("chat", "1.2.3.4")

    def test_hit_limit(self):
        limit, _ = serve.RATE_LIMITS["register"]
        for _ in range(limit):
            assert serve.check_rate("register", "1.2.3.4")
        assert not serve.check_rate("register", "1.2.3.4")

    def test_separate_ips(self):
        limit, _ = serve.RATE_LIMITS["register"]
        for _ in range(limit):
            serve.check_rate("register", "1.1.1.1")
        assert not serve.check_rate("register", "1.1.1.1")
        assert serve.check_rate("register", "2.2.2.2")

    def test_separate_buckets(self):
        limit, _ = serve.RATE_LIMITS["register"]
        for _ in range(limit):
            serve.check_rate("register", "1.1.1.1")
        assert not serve.check_rate("register", "1.1.1.1")
        assert serve.check_rate("chat", "1.1.1.1")


# ---------------------------------------------------------------------------
# Data retention
# ---------------------------------------------------------------------------

class TestRetention(unittest.TestCase):
    def setUp(self):
        self._data_dir = _fresh_data_dir()
        _reset_rate_limits()

    def tearDown(self):
        shutil.rmtree(self._data_dir, ignore_errors=True)

    def test_cleanup_expired(self):
        tok = _register()
        event_file = os.path.join(serve.DATA_DIR, f"{TEST_UID}.jsonl")
        with open(event_file, "w") as f:
            f.write('{"type":"test","ts":1}\n')
        old_time = time.time() - (serve.RETENTION_DAYS + 1) * 86400
        os.utime(event_file, (old_time, old_time))

        serve.cleanup_expired_data()

        assert not os.path.exists(event_file)
        users = serve.load_users()
        assert TEST_UID not in users

    def test_keep_recent(self):
        tok = _register()
        event_file = os.path.join(serve.DATA_DIR, f"{TEST_UID}.jsonl")
        with open(event_file, "w") as f:
            f.write('{"type":"test","ts":1}\n')

        serve.cleanup_expired_data()

        assert os.path.exists(event_file)
        users = serve.load_users()
        assert TEST_UID in users

    def test_cleanup_no_files(self):
        _register()
        serve.cleanup_expired_data()
        users = serve.load_users()
        assert TEST_UID not in users


# ---------------------------------------------------------------------------
# Integration tests — actual HTTP server
# ---------------------------------------------------------------------------

def _start_test_server():
    """Start a threaded HTTP server on a random port. Returns (server, port)."""
    server = ThreadingHTTPServer(("127.0.0.1", 0), serve.Handler)
    port = server.server_address[1]
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    return server, port


class TestHTTPEndpoints(unittest.TestCase):
    """Integration tests using a real HTTP server."""

    @classmethod
    def setUpClass(cls):
        cls._data_dir = _fresh_data_dir()
        cls.server, cls.port = _start_test_server()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        shutil.rmtree(cls._data_dir, ignore_errors=True)

    def setUp(self):
        _reset_rate_limits()
        # Clean data dir between tests
        for f in os.listdir(serve.DATA_DIR):
            fp = os.path.join(serve.DATA_DIR, f)
            if os.path.isfile(fp):
                os.remove(fp)

    def _conn(self):
        return http.client.HTTPConnection("127.0.0.1", self.port)

    def _register_via_http(self, uid=TEST_UID):
        conn = self._conn()
        conn.request("POST", "/api/register", headers={
            "Content-Type": "application/json",
            "X-UID": uid,
            "Content-Length": "0",
        })
        resp = conn.getresponse()
        body = json.loads(resp.read())
        conn.close()
        return resp.status, body

    # --- /api/register ---

    def test_register_success(self):
        status, body = self._register_via_http()
        assert status == 200
        assert "token" in body
        assert len(body["token"]) >= 32

    def test_register_duplicate(self):
        self._register_via_http()
        status, body = self._register_via_http()
        assert status == 409
        assert "already" in body.get("error", "")

    def test_register_invalid_uid(self):
        status, body = self._register_via_http("bad-uid")
        assert status == 400

    # --- /api/chat ---

    def test_chat_no_auth(self):
        conn = self._conn()
        payload = json.dumps({"messages": [{"role": "user", "content": "hi"}]})
        conn.request("POST", "/api/chat", body=payload, headers={
            "Content-Type": "application/json",
            "Content-Length": str(len(payload)),
        })
        resp = conn.getresponse()
        resp.read()
        assert resp.status == 403
        conn.close()

    def test_chat_invalid_token(self):
        self._register_via_http()
        conn = self._conn()
        payload = json.dumps({"messages": [{"role": "user", "content": "hi"}]})
        conn.request("POST", "/api/chat", body=payload, headers={
            "Content-Type": "application/json",
            "X-UID": TEST_UID,
            "X-Token": "wrong-token-that-is-definitely-long-enough",
            "Content-Length": str(len(payload)),
        })
        resp = conn.getresponse()
        resp.read()
        assert resp.status == 403
        conn.close()

    def test_chat_missing_messages(self):
        status, reg = self._register_via_http()
        conn = self._conn()
        payload = json.dumps({"foo": "bar"})
        conn.request("POST", "/api/chat", body=payload, headers={
            "Content-Type": "application/json",
            "X-UID": TEST_UID,
            "X-Token": reg["token"],
            "Content-Length": str(len(payload)),
        })
        resp = conn.getresponse()
        resp.read()
        assert resp.status == 400
        conn.close()

    def test_chat_invalid_json(self):
        status, reg = self._register_via_http()
        conn = self._conn()
        payload = "not json at all"
        conn.request("POST", "/api/chat", body=payload, headers={
            "Content-Type": "application/json",
            "X-UID": TEST_UID,
            "X-Token": reg["token"],
            "Content-Length": str(len(payload)),
        })
        resp = conn.getresponse()
        resp.read()
        assert resp.status == 400
        conn.close()

    def test_chat_invalid_messages(self):
        _, reg = self._register_via_http()
        conn = self._conn()
        payload = json.dumps({"messages": [{"role": "admin", "content": "hi"}]})
        conn.request("POST", "/api/chat", body=payload, headers={
            "Content-Type": "application/json",
            "X-UID": TEST_UID,
            "X-Token": reg["token"],
            "Content-Length": str(len(payload)),
        })
        resp = conn.getresponse()
        resp.read()
        assert resp.status == 400
        conn.close()

    def test_chat_bot_blocked(self):
        _, reg = self._register_via_http()
        conn = self._conn()
        payload = json.dumps({"messages": [{"role": "user", "content": "hi"}]})
        conn.request("POST", "/api/chat", body=payload, headers={
            "Content-Type": "application/json",
            "X-UID": TEST_UID,
            "X-Token": reg["token"],
            "User-Agent": "Googlebot/2.1",
            "Content-Length": str(len(payload)),
        })
        resp = conn.getresponse()
        resp.read()
        assert resp.status == 403
        conn.close()

    # --- /api/event ---

    def test_event_saving_mode(self):
        _, reg = self._register_via_http()
        conn = self._conn()
        payload = json.dumps({"type": "page_load", "ts": 12345})
        conn.request("POST", "/api/event", body=payload, headers={
            "Content-Type": "application/json",
            "X-UID": TEST_UID,
            "X-Token": reg["token"],
            "X-Mode": "saving",
            "Content-Length": str(len(payload)),
        })
        resp = conn.getresponse()
        body = json.loads(resp.read())
        assert resp.status == 200
        assert body.get("ok")
        event_file = os.path.join(serve.DATA_DIR, f"{TEST_UID}.jsonl")
        assert os.path.exists(event_file)
        with open(event_file) as f:
            line = json.loads(f.readline())
        assert line["type"] == "page_load"
        conn.close()

    def test_event_ephemeral_mode(self):
        _, reg = self._register_via_http()
        conn = self._conn()
        payload = json.dumps({"type": "page_load", "ts": 12345})
        conn.request("POST", "/api/event", body=payload, headers={
            "Content-Type": "application/json",
            "X-UID": TEST_UID,
            "X-Token": reg["token"],
            "X-Mode": "private",
            "Content-Length": str(len(payload)),
        })
        resp = conn.getresponse()
        body = json.loads(resp.read())
        assert resp.status == 200
        event_file = os.path.join(serve.DATA_DIR, f"{TEST_UID}.jsonl")
        assert not os.path.exists(event_file)
        conn.close()

    # --- /api/feedback ---

    def test_feedback_success(self):
        _, reg = self._register_via_http()
        conn = self._conn()
        payload = json.dumps({"text": "Great lesson!", "lesson": "c-pointers"})
        conn.request("POST", "/api/feedback", body=payload, headers={
            "Content-Type": "application/json",
            "X-UID": TEST_UID,
            "X-Token": reg["token"],
            "Content-Length": str(len(payload)),
        })
        resp = conn.getresponse()
        body = json.loads(resp.read())
        assert resp.status == 200
        assert body.get("ok")
        fb_file = os.path.join(serve.DATA_DIR, "_feedback.jsonl")
        assert os.path.exists(fb_file)
        with open(fb_file) as f:
            record = json.loads(f.readline())
        assert record["text"] == "Great lesson!"
        assert record["lesson"] == "c-pointers"
        assert "ts" in record
        conn.close()

    def test_feedback_empty_text(self):
        _, reg = self._register_via_http()
        conn = self._conn()
        payload = json.dumps({"text": ""})
        conn.request("POST", "/api/feedback", body=payload, headers={
            "Content-Type": "application/json",
            "X-UID": TEST_UID,
            "X-Token": reg["token"],
            "Content-Length": str(len(payload)),
        })
        resp = conn.getresponse()
        resp.read()
        assert resp.status == 400
        conn.close()

    def test_feedback_too_long(self):
        _, reg = self._register_via_http()
        conn = self._conn()
        payload = json.dumps({"text": "x" * 5001})
        conn.request("POST", "/api/feedback", body=payload, headers={
            "Content-Type": "application/json",
            "X-UID": TEST_UID,
            "X-Token": reg["token"],
            "Content-Length": str(len(payload)),
        })
        resp = conn.getresponse()
        resp.read()
        assert resp.status == 413
        conn.close()

    # --- /api/export ---

    def test_export_empty(self):
        _, reg = self._register_via_http()
        conn = self._conn()
        conn.request("GET", "/api/export", headers={
            "X-UID": TEST_UID,
            "X-Token": reg["token"],
        })
        resp = conn.getresponse()
        body = json.loads(resp.read())
        assert resp.status == 200
        assert body["uid"] == TEST_UID
        assert body["events"] == []
        assert body["chats"] == []
        conn.close()

    def test_export_with_data(self):
        _, reg = self._register_via_http()
        # Write some event data
        serve.ensure_data_dir()
        event_file = os.path.join(serve.DATA_DIR, f"{TEST_UID}.jsonl")
        with open(event_file, "w") as f:
            f.write(json.dumps({"type": "test", "ts": 100}) + "\n")
            f.write(json.dumps({"type": "test2", "ts": 200}) + "\n")

        conn = self._conn()
        conn.request("GET", "/api/export", headers={
            "X-UID": TEST_UID,
            "X-Token": reg["token"],
        })
        resp = conn.getresponse()
        body = json.loads(resp.read())
        assert resp.status == 200
        assert len(body["events"]) == 2
        conn.close()

    def test_export_no_auth(self):
        conn = self._conn()
        conn.request("GET", "/api/export")
        resp = conn.getresponse()
        resp.read()
        assert resp.status == 403
        conn.close()

    # --- /api/delete ---

    def test_delete_removes_data(self):
        _, reg = self._register_via_http()
        serve.ensure_data_dir()
        event_file = os.path.join(serve.DATA_DIR, f"{TEST_UID}.jsonl")
        chat_file = os.path.join(serve.DATA_DIR, f"{TEST_UID}_chat.jsonl")
        with open(event_file, "w") as f:
            f.write('{"type":"test"}\n')
        with open(chat_file, "w") as f:
            f.write('{"ts":1}\n')

        conn = self._conn()
        conn.request("POST", "/api/delete", headers={
            "Content-Type": "application/json",
            "X-UID": TEST_UID,
            "X-Token": reg["token"],
            "Content-Length": "0",
        })
        resp = conn.getresponse()
        body = json.loads(resp.read())
        assert resp.status == 200
        assert body.get("ok")
        assert not os.path.exists(event_file)
        assert not os.path.exists(chat_file)
        users = serve.load_users()
        assert TEST_UID not in users
        conn.close()

    # --- /api/users (dashboard) ---

    def test_dashboard_users_no_secret(self):
        conn = self._conn()
        conn.request("GET", "/api/users")
        resp = conn.getresponse()
        resp.read()
        assert resp.status == 403
        conn.close()

    def test_dashboard_users_wrong_secret(self):
        conn = self._conn()
        conn.request("GET", "/api/users?key=wrong-secret")
        resp = conn.getresponse()
        resp.read()
        assert resp.status == 403
        conn.close()

    def test_dashboard_users_with_secret(self):
        self._register_via_http()
        conn = self._conn()
        conn.request("GET", f"/api/users?key={DASHBOARD_SECRET}")
        resp = conn.getresponse()
        body = json.loads(resp.read())
        assert resp.status == 200
        assert isinstance(body, list)
        conn.close()

    # --- /api/timeline (dashboard) ---

    def test_timeline_no_secret(self):
        conn = self._conn()
        conn.request("GET", f"/api/timeline?uid={TEST_UID}")
        resp = conn.getresponse()
        resp.read()
        assert resp.status == 403
        conn.close()

    def test_timeline_invalid_uid(self):
        conn = self._conn()
        conn.request("GET", f"/api/timeline?uid=bad&key={DASHBOARD_SECRET}")
        resp = conn.getresponse()
        resp.read()
        assert resp.status == 400
        conn.close()

    def test_timeline_with_data(self):
        self._register_via_http()
        serve.ensure_data_dir()
        event_file = os.path.join(serve.DATA_DIR, f"{TEST_UID}.jsonl")
        with open(event_file, "w") as f:
            f.write(json.dumps({"type": "lesson_open", "ts": 123}) + "\n")

        conn = self._conn()
        conn.request("GET", f"/api/timeline?uid={TEST_UID}&key={DASHBOARD_SECRET}")
        resp = conn.getresponse()
        body = json.loads(resp.read())
        assert resp.status == 200
        assert len(body) == 1
        assert body[0]["type"] == "lesson_open"
        conn.close()

    # --- Security headers ---

    def test_security_headers_on_api(self):
        conn = self._conn()
        conn.request("POST", "/api/register", headers={
            "Content-Type": "application/json",
            "X-UID": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            "Content-Length": "0",
        })
        resp = conn.getresponse()
        resp.read()
        assert resp.getheader("X-Content-Type-Options") == "nosniff"
        assert resp.getheader("X-Frame-Options") == "DENY"
        assert resp.getheader("Referrer-Policy") == "strict-origin-when-cross-origin"
        assert "max-age=31536000" in resp.getheader("Strict-Transport-Security", "")
        assert resp.getheader("Cache-Control") == "no-store"
        conn.close()

    # --- POST to unknown endpoint ---

    def test_unknown_post_no_auth_403(self):
        """Unknown /api/* endpoints without auth hit the token gate first."""
        conn = self._conn()
        conn.request("POST", "/api/nonexistent", headers={
            "Content-Length": "0",
        })
        resp = conn.getresponse()
        resp.read()
        assert resp.status == 403
        conn.close()

    def test_unknown_post_with_auth_404(self):
        """Unknown /api/* endpoints with valid auth return 404."""
        _, reg = self._register_via_http()
        conn = self._conn()
        conn.request("POST", "/api/nonexistent", headers={
            "Content-Type": "application/json",
            "X-UID": TEST_UID,
            "X-Token": reg["token"],
            "Content-Length": "0",
        })
        resp = conn.getresponse()
        resp.read()
        assert resp.status == 404
        conn.close()

    # --- Body size limit ---

    def test_body_too_large(self):
        _, reg = self._register_via_http()
        conn = self._conn()
        big = "x" * (256 * 1024 + 1)
        conn.request("POST", "/api/chat", body=big, headers={
            "Content-Type": "application/json",
            "X-UID": TEST_UID,
            "X-Token": reg["token"],
            "Content-Length": str(len(big)),
        })
        resp = conn.getresponse()
        resp.read()
        assert resp.status == 413
        conn.close()

    # --- OPTIONS ---

    def test_options(self):
        conn = self._conn()
        conn.request("OPTIONS", "/api/chat")
        resp = conn.getresponse()
        resp.read()
        assert resp.status == 204
        conn.close()

    # --- Rate limiting via HTTP ---

    def test_register_rate_limit(self):
        limit, _ = serve.RATE_LIMITS["register"]
        for i in range(limit):
            uid = f"{i:08d}-1111-1111-1111-111111111111"
            self._register_via_http(uid)

        uid = f"{limit:08d}-1111-1111-1111-111111111111"
        status, body = self._register_via_http(uid)
        assert status == 429

    # --- Dashboard path ---

    def test_dashboard_wrong_secret(self):
        conn = self._conn()
        conn.request("GET", "/dashboard/wrong-secret")
        resp = conn.getresponse()
        resp.read()
        assert resp.status == 403
        conn.close()

    def test_dashboard_correct_secret(self):
        conn = self._conn()
        conn.request("GET", f"/dashboard/{DASHBOARD_SECRET}")
        resp = conn.getresponse()
        body = resp.read()
        assert resp.status == 200
        assert resp.getheader("Content-Type") == "text/html"
        assert b"dashboard" in body.lower() or b"<!DOCTYPE" in body or b"<html" in body
        conn.close()

    # --- Page serving ---

    def test_landing_page(self):
        conn = self._conn()
        conn.request("GET", "/")
        resp = conn.getresponse()
        body = resp.read()
        assert resp.status == 200
        assert resp.getheader("Content-Type") == "text/html"
        assert len(body) > 100
        conn.close()

    def test_privacy_page(self):
        conn = self._conn()
        conn.request("GET", "/privacy")
        resp = conn.getresponse()
        body = resp.read()
        assert resp.status == 200
        assert resp.getheader("Content-Type") == "text/html"
        conn.close()

    def test_static_js_served(self):
        conn = self._conn()
        conn.request("GET", "/app.js")
        resp = conn.getresponse()
        body = resp.read()
        assert resp.status == 200
        assert b"function" in body or b"const" in body
        conn.close()

    def test_static_css_served(self):
        conn = self._conn()
        conn.request("GET", "/style.css")
        resp = conn.getresponse()
        body = resp.read()
        assert resp.status == 200
        conn.close()

    def test_static_blocked_py(self):
        conn = self._conn()
        conn.request("GET", "/serve.py")
        resp = conn.getresponse()
        resp.read()
        assert resp.status == 404
        conn.close()

    def test_static_blocked_env(self):
        conn = self._conn()
        conn.request("GET", "/.env")
        resp = conn.getresponse()
        resp.read()
        assert resp.status == 404
        conn.close()

    def test_static_blocked_data(self):
        conn = self._conn()
        conn.request("GET", "/data/something.jsonl")
        resp = conn.getresponse()
        resp.read()
        assert resp.status == 404
        conn.close()

    def test_path_traversal_blocked(self):
        conn = self._conn()
        conn.request("GET", "/../../../etc/passwd")
        resp = conn.getresponse()
        resp.read()
        assert resp.status in (400, 404)
        conn.close()

    def test_csp_on_html_pages(self):
        conn = self._conn()
        conn.request("GET", "/")
        resp = conn.getresponse()
        resp.read()
        csp = resp.getheader("Content-Security-Policy", "")
        assert "default-src 'self'" in csp
        assert "script-src 'self'" in csp
        assert "frame-ancestors 'none'" in csp
        conn.close()

    def test_hsts_header(self):
        conn = self._conn()
        conn.request("GET", "/app.js")
        resp = conn.getresponse()
        resp.read()
        hsts = resp.getheader("Strict-Transport-Security", "")
        assert "max-age=31536000" in hsts
        conn.close()

    # --- End-to-end flow: register → events → export → delete ---

    def test_full_lifecycle(self):
        """End-to-end: register, send events, export data, delete everything."""
        uid = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"

        # 1. Register
        status, reg = self._register_via_http(uid)
        assert status == 200
        token = reg["token"]

        # 2. Send a few events in saving mode
        for evt_type in ["page_load", "lesson_open", "lesson_complete"]:
            conn = self._conn()
            payload = json.dumps({"type": evt_type, "ts": int(time.time() * 1000)})
            conn.request("POST", "/api/event", body=payload, headers={
                "Content-Type": "application/json",
                "X-UID": uid,
                "X-Token": token,
                "X-Mode": "saving",
                "Content-Length": str(len(payload)),
            })
            resp = conn.getresponse()
            assert json.loads(resp.read()).get("ok")
            conn.close()

        # 3. Export — should have 3 events
        conn = self._conn()
        conn.request("GET", "/api/export", headers={
            "X-UID": uid,
            "X-Token": token,
        })
        resp = conn.getresponse()
        data = json.loads(resp.read())
        assert resp.status == 200
        assert len(data["events"]) == 3
        conn.close()

        # 4. Submit feedback
        conn = self._conn()
        payload = json.dumps({"text": "lifecycle test feedback"})
        conn.request("POST", "/api/feedback", body=payload, headers={
            "Content-Type": "application/json",
            "X-UID": uid,
            "X-Token": token,
            "Content-Length": str(len(payload)),
        })
        resp = conn.getresponse()
        assert resp.status == 200
        conn.close()

        # 5. Verify user appears on dashboard
        conn = self._conn()
        conn.request("GET", f"/api/users?key={DASHBOARD_SECRET}")
        resp = conn.getresponse()
        users = json.loads(resp.read())
        assert any(u["uid"] == uid for u in users)
        conn.close()

        # 6. Verify timeline has events
        conn = self._conn()
        conn.request("GET", f"/api/timeline?uid={uid}&key={DASHBOARD_SECRET}")
        resp = conn.getresponse()
        events = json.loads(resp.read())
        assert resp.status == 200
        assert len(events) == 3
        conn.close()

        # 7. Delete everything
        conn = self._conn()
        conn.request("POST", "/api/delete", headers={
            "Content-Type": "application/json",
            "X-UID": uid,
            "X-Token": token,
            "Content-Length": "0",
        })
        resp = conn.getresponse()
        assert resp.status == 200
        conn.close()

        # 8. Verify data is gone
        assert not os.path.exists(os.path.join(serve.DATA_DIR, f"{uid}.jsonl"))
        users = serve.load_users()
        assert uid not in users

    def test_cross_user_isolation(self):
        """Two users' data cannot leak across boundaries."""
        uid_a = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        uid_b = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

        _, reg_a = self._register_via_http(uid_a)
        _, reg_b = self._register_via_http(uid_b)

        # A cannot use B's token
        conn = self._conn()
        conn.request("GET", "/api/export", headers={
            "X-UID": uid_a,
            "X-Token": reg_b["token"],
        })
        resp = conn.getresponse()
        resp.read()
        assert resp.status == 403
        conn.close()

        # Write event for A
        conn = self._conn()
        payload = json.dumps({"type": "test_a", "ts": 1})
        conn.request("POST", "/api/event", body=payload, headers={
            "Content-Type": "application/json",
            "X-UID": uid_a,
            "X-Token": reg_a["token"],
            "X-Mode": "saving",
            "Content-Length": str(len(payload)),
        })
        resp = conn.getresponse()
        resp.read()
        conn.close()

        # B's export should have no events
        conn = self._conn()
        conn.request("GET", "/api/export", headers={
            "X-UID": uid_b,
            "X-Token": reg_b["token"],
        })
        resp = conn.getresponse()
        data = json.loads(resp.read())
        assert data["events"] == []
        conn.close()


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    unittest.main()
