#!/usr/bin/env python3
import http.server
import hashlib
import json
import re
import threading
import urllib.request
import os
import sys
import time

# Load .env file if present
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.exists(env_path):
    for line in open(env_path):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

LLM_API_KEY = os.environ.get("LLM_API_KEY") or os.environ.get("GROQ_API_KEY", "")
LLM_MODEL = os.environ.get("LLM_MODEL") or os.environ.get("GROQ_MODEL", "moonshotai/kimi-k2-instruct")
LLM_API_URL = os.environ.get("LLM_API_URL") or os.environ.get("GROQ_URL", "https://api.groq.com/openai/v1/chat/completions")
DASHBOARD_SECRET = os.environ.get("DASHBOARD_SECRET") or LLM_API_KEY

LLM_HEADERS = {"Content-Type": "application/json", "User-Agent": "CodeProbe/1.0"}
if LLM_API_KEY:
    LLM_HEADERS["Authorization"] = f"Bearer {LLM_API_KEY}"

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
USERS_FILE = os.path.join(DATA_DIR, "_users.json")

# Bot protection
BOT_UA_RE = re.compile(
    r"bot|crawl|spider|slurp|bingpreview|mediapartners|facebookexternalhit"
    r"|semrush|ahref|mj12|dotbot|bytespider|gptbot|claudebot|ccbot",
    re.IGNORECASE,
)
TOKEN_SALT = "codeprobe_2026"
_UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
MAX_BODY = 256 * 1024  # 256KB

# Thread lock for shared file/state access
_lock = threading.Lock()

# Rate limiting for /api/chat: {ip: [timestamp, ...]}
_chat_hits = {}
CHAT_RATE_LIMIT = 30      # max requests
CHAT_RATE_WINDOW = 3600    # per hour
RETENTION_DAYS = 90        # auto-delete inactive data after this many days


def valid_uid(uid):
    return bool(_UUID_RE.match(uid))


def is_bot(ua):
    return bool(BOT_UA_RE.search(ua or ""))


def make_token(uid):
    """Expected token = first 8 chars of sha256(uid + salt)."""
    return hashlib.sha256((uid + TOKEN_SALT).encode()).hexdigest()[:8]


def check_rate(ip):
    """Returns True if under limit."""
    with _lock:
        now = time.time()
        hits = _chat_hits.get(ip, [])
        hits = [t for t in hits if now - t < CHAT_RATE_WINDOW]
        if len(hits) >= CHAT_RATE_LIMIT:
            _chat_hits[ip] = hits
            return False
        hits.append(now)
        _chat_hits[ip] = hits
        return True


def validate_messages(messages):
    """Validate chat messages array. Returns error string or None."""
    if not isinstance(messages, list) or len(messages) == 0:
        return "messages must be a non-empty array"
    if len(messages) > 20:
        return "too many messages"
    allowed_roles = {"system", "user", "assistant"}
    system_count = 0
    total_chars = 0
    for i, m in enumerate(messages):
        if not isinstance(m, dict) or "role" not in m or "content" not in m:
            return "invalid message format"
        if m["role"] not in allowed_roles:
            return f"invalid role: {m['role']}"
        if m["role"] == "system":
            system_count += 1
            if i != 0:
                return "system message must be first"
        total_chars += len(m.get("content", ""))
    if system_count > 1:
        return "only one system message allowed"
    if total_chars > 60000:
        return "messages too large"
    return None


def get_real_ip(handler):
    """Get client IP, checking X-Forwarded-For for proxied requests (ngrok etc)."""
    forwarded = handler.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return handler.client_address[0]


def ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def cleanup_expired_data():
    """Delete user data files inactive for more than RETENTION_DAYS."""
    if not os.path.exists(DATA_DIR):
        return
    cutoff = time.time() - (RETENTION_DAYS * 86400)
    with _lock:
        users = load_users()
        expired = []
        for uid in list(users.keys()):
            event_file = os.path.join(DATA_DIR, f"{uid}.jsonl")
            chat_file = os.path.join(DATA_DIR, f"{uid}_chat.jsonl")
            mtime = 0
            has_files = False
            for fpath in (event_file, chat_file):
                if os.path.exists(fpath):
                    has_files = True
                    mtime = max(mtime, os.path.getmtime(fpath))
            if not has_files or mtime < cutoff:
                expired.append(uid)
                for fpath in (event_file, chat_file):
                    if os.path.exists(fpath):
                        os.remove(fpath)
        for uid in expired:
            del users[uid]
        if expired:
            save_users(users)
            print(f"Retention cleanup: removed {len(expired)} inactive users", file=sys.stderr)


def schedule_cleanup():
    """Run cleanup on startup and every 24 hours."""
    try:
        cleanup_expired_data()
    except Exception as e:
        print(f"Retention cleanup error: {e}", file=sys.stderr)
    timer = threading.Timer(86400, schedule_cleanup)
    timer.daemon = True
    timer.start()


def load_users():
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE) as f:
            return json.load(f)
    return {}


def save_users(users):
    with open(USERS_FILE, "w") as f:
        json.dump(users, f, indent=2)


class Handler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_GET(self):
        if self.path == f"/dashboard/{DASHBOARD_SECRET}":
            dash_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dashboard.html")
            with open(dash_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)

        elif self.path.startswith("/api/users"):
            if f"key={DASHBOARD_SECRET}" not in self.path:
                self._json_response(403, {"error": "forbidden"})
                return
            qs = self.path.split("?", 1)[1] if "?" in self.path else ""
            params = dict(p.split("=", 1) for p in qs.split("&") if "=" in p)
            min_events = int(params.get("min_events", 0))
            ensure_data_dir()
            users = load_users()
            # Count events per user
            result = []
            for uid, meta in users.items():
                event_file = os.path.join(DATA_DIR, f"{uid}.jsonl")
                count = 0
                last_ts = 0
                if os.path.exists(event_file):
                    with open(event_file) as f:
                        for line in f:
                            count += 1
                            try:
                                evt = json.loads(line)
                                if evt.get("ts", 0) > last_ts:
                                    last_ts = evt["ts"]
                            except json.JSONDecodeError:
                                pass
                if count < min_events:
                    continue
                result.append({
                    "uid": uid,
                    "first_seen": meta.get("first_seen", 0),
                    "consent_ts": meta.get("consent_ts", 0),
                    "events": count,
                    "last_ts": last_ts,
                })
            result.sort(key=lambda u: u["last_ts"], reverse=True)
            self._json_response(200, result)

        elif self.path.startswith("/api/timeline"):
            if f"key={DASHBOARD_SECRET}" not in self.path:
                self._json_response(403, {"error": "forbidden"})
                return
            qs = self.path.split("?", 1)[1] if "?" in self.path else ""
            params = dict(p.split("=", 1) for p in qs.split("&") if "=" in p)
            uid = params.get("uid", "")
            if not uid or not valid_uid(uid):
                self._json_response(400, {"error": "valid uid required"})
                return
            event_file = os.path.join(DATA_DIR, f"{uid}.jsonl")
            events = []
            if os.path.exists(event_file):
                with open(event_file) as f:
                    for line in f:
                        try:
                            events.append(json.loads(line))
                        except json.JSONDecodeError:
                            pass
            self._json_response(200, events)

        elif self.path.startswith("/api/export"):
            uid = self.headers.get("X-UID", "")
            token = self.headers.get("X-Token", "")
            if not uid or not valid_uid(uid) or token != make_token(uid):
                self._json_response(403, {"error": "forbidden"})
                return
            ensure_data_dir()
            result = {"uid": uid, "events": [], "chats": []}
            event_file = os.path.join(DATA_DIR, f"{uid}.jsonl")
            if os.path.exists(event_file):
                with open(event_file) as f:
                    for line in f:
                        try: result["events"].append(json.loads(line))
                        except json.JSONDecodeError: pass
            chat_file = os.path.join(DATA_DIR, f"{uid}_chat.jsonl")
            if os.path.exists(chat_file):
                with open(chat_file) as f:
                    for line in f:
                        try: result["chats"].append(json.loads(line))
                        except json.JSONDecodeError: pass
            self._json_response(200, result)

        elif self.path == "/privacy":
            priv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "privacy.html")
            if os.path.exists(priv_path):
                with open(priv_path, "rb") as f:
                    content = f.read()
            else:
                content = b"<html><body><h1>Privacy</h1><p>Privacy policy not found.</p></body></html>"
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)

        else:
            super().do_GET()

    def do_POST(self):
        ua = self.headers.get("User-Agent", "")
        if is_bot(ua):
            self._json_response(403, {"error": "forbidden"})
            return

        # Body size limit
        length = int(self.headers.get("Content-Length", 0))
        if length > MAX_BODY:
            self._json_response(413, {"error": "request too large"})
            return

        # Verify JS proof token on API calls
        uid = self.headers.get("X-UID", "")
        token = self.headers.get("X-Token", "")
        if self.path.startswith("/api/") and uid:
            if not valid_uid(uid):
                self._json_response(400, {"error": "invalid uid"})
                return
            if token != make_token(uid):
                self._json_response(403, {"error": "invalid token"})
                return

        if self.path == "/api/chat":
            if not check_rate(get_real_ip(self)):
                self._json_response(429, {"error": "rate limit exceeded"})
                return
            try:
                body = json.loads(self.rfile.read(length))
            except (json.JSONDecodeError, ValueError):
                self._json_response(400, {"error": "invalid json"})
                return
            if "messages" not in body:
                self._json_response(400, {"error": "messages required"})
                return
            msg_err = validate_messages(body["messages"])
            if msg_err:
                self._json_response(400, {"error": msg_err})
                return

            saving = self.headers.get("X-Mode", "") == "saving"

            payload = json.dumps({
                "model": LLM_MODEL,
                "messages": body["messages"],
                "temperature": 0.7,
                "max_tokens": 1500,
            }).encode()

            req = urllib.request.Request(
                LLM_API_URL,
                data=payload,
                headers=LLM_HEADERS,
            )

            # First attempt
            reply = None
            error_info = None
            try:
                with urllib.request.urlopen(req, timeout=10) as resp:
                    result = json.loads(resp.read())
                    reply = result["choices"][0]["message"]["content"]
            except urllib.error.HTTPError as e:
                error_info = (e.code, e.read().decode(errors="replace"))
                print(f"LLM API error {error_info[0]}: {error_info[1]}", file=sys.stderr)
            except Exception as e:
                error_info = (500, str(e))
                print(f"Error: {e}", file=sys.stderr)

            # Retry once if error or too-short reply (~50 tokens ≈ 40 words)
            needs_retry = error_info is not None or (reply is not None and len(reply.split()) < 40)
            used_messages = body["messages"]

            if needs_retry:
                if saving:
                    ensure_data_dir()
                    chat_file = os.path.join(DATA_DIR, f"{uid}_chat.jsonl")
                    failed_record = {
                        "ts": int(time.time() * 1000),
                        "model": LLM_MODEL,
                        "messages": body["messages"],
                        "reply": reply,
                        "error": error_info[1] if error_info else None,
                        "failed": True,
                    }
                    with _lock:
                        with open(chat_file, "a") as cf:
                            cf.write(json.dumps(failed_record) + "\n")

                    event_file = os.path.join(DATA_DIR, f"{uid}.jsonl")
                    retry_evt = {
                        "type": "tutor_retry",
                        "ts": int(time.time() * 1000),
                        "reason": "error" if error_info else "too_short",
                        "original": reply,
                    }
                    with _lock:
                        with open(event_file, "a") as ef:
                            ef.write(json.dumps(retry_evt) + "\n")

                # Retry after 1s with trailing space on last message to avoid caching
                time.sleep(1)
                msgs = [dict(m) for m in body["messages"]]
                if msgs:
                    msgs[-1]["content"] += " "

                retry_payload = json.dumps({
                    "model": LLM_MODEL,
                    "messages": msgs,
                    "temperature": 0.7,
                    "max_tokens": 1500,
                }).encode()
                retry_req = urllib.request.Request(
                    LLM_API_URL,
                    data=retry_payload,
                    headers=LLM_HEADERS,
                )
                try:
                    with urllib.request.urlopen(retry_req, timeout=10) as resp:
                        result = json.loads(resp.read())
                        reply = result["choices"][0]["message"]["content"]
                        error_info = None
                        used_messages = msgs
                except urllib.error.HTTPError as e:
                    error_info = (e.code, e.read().decode(errors="replace"))
                    print(f"LLM retry error {error_info[0]}: {error_info[1]}", file=sys.stderr)
                except Exception as e:
                    error_info = (500, str(e))
                    print(f"Retry error: {e}", file=sys.stderr)

            # Return error if still failing after retry
            if error_info:
                self._json_response(error_info[0], {"error": error_info[1]})
                return

            # Log final exchange to chat history (only in saving mode)
            if saving:
                ensure_data_dir()
                chat_file = os.path.join(DATA_DIR, f"{uid}_chat.jsonl")
                chat_record = {
                    "ts": int(time.time() * 1000),
                    "model": LLM_MODEL,
                    "messages": used_messages,
                    "reply": reply,
                }
                with _lock:
                    with open(chat_file, "a") as cf:
                        cf.write(json.dumps(chat_record) + "\n")
            self._json_response(200, {"reply": reply})

        elif self.path == "/api/event":
            # Only log events when student is in saving mode
            if self.headers.get("X-Mode", "") != "saving":
                if length:
                    self.rfile.read(length)  # drain body for HTTP/1.1
                self._json_response(200, {"ok": True})
                return

            body = self.rfile.read(length) if length else b"{}"
            try:
                evt_data = json.loads(body)
            except (json.JSONDecodeError, ValueError):
                self._json_response(400, {"error": "invalid json"})
                return
            uid = self.headers.get("X-UID", "")

            ensure_data_dir()

            with _lock:
                users = load_users()
                now = int(time.time() * 1000)
                if uid not in users:
                    users[uid] = {"first_seen": now, "consent_ts": now}
                    save_users(users)
                elif "consent_ts" not in users[uid]:
                    users[uid]["consent_ts"] = now
                    save_users(users)

            event_file = os.path.join(DATA_DIR, f"{uid}.jsonl")
            with _lock:
                with open(event_file, "a") as f:
                    f.write(json.dumps(evt_data) + "\n")

            self._json_response(200, {"ok": True})

        elif self.path == "/api/delete":
            if length:
                self.rfile.read(length)  # drain body for HTTP/1.1
            # Explicit auth check — destructive operation
            if not uid or not valid_uid(uid) or token != make_token(uid):
                self._json_response(403, {"error": "forbidden"})
                return
            ensure_data_dir()
            with _lock:
                users = load_users()
                if uid in users:
                    del users[uid]
                    save_users(users)
                for suffix in ["", "_chat"]:
                    fpath = os.path.join(DATA_DIR, f"{uid}{suffix}.jsonl")
                    if os.path.exists(fpath):
                        os.remove(fpath)
            self._json_response(200, {"ok": True})

        elif self.path == "/api/feedback":
            body = self.rfile.read(length) if length else b"{}"
            try:
                data = json.loads(body)
            except (json.JSONDecodeError, ValueError):
                self._json_response(400, {"error": "invalid json"})
                return
            text = data.get("text", "").strip()
            if not text:
                self._json_response(400, {"error": "text required"})
                return
            ensure_data_dir()
            record = {
                "ts": int(time.time() * 1000),
                "text": text,
                "lesson": data.get("lesson"),
            }
            with _lock:
                with open(os.path.join(DATA_DIR, "_feedback.jsonl"), "a") as f:
                    f.write(json.dumps(record) + "\n")
            self._json_response(200, {"ok": True})

        else:
            self.send_response(404)
            self.send_header("Content-Length", "0")
            self.end_headers()

    def _json_response(self, code, data):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Content-Length", "0")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-UID, X-Token, X-Mode")
        self.end_headers()

    def log_message(self, fmt, *args):
        first = str(args[0]) if args else ""
        if "/api/" in first:
            super().log_message(fmt, *args)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print(f"codeprobe at http://localhost:{port}")
    print(f"Dashboard at http://localhost:{port}/dashboard/{DASHBOARD_SECRET}")
    print(f"Using model: {LLM_MODEL}")
    print(f"API: {LLM_API_URL}")
    schedule_cleanup()
    server = http.server.ThreadingHTTPServer(("", port), Handler)
    server.request_queue_size = 64
    server.socket.listen(64)
    server.serve_forever()
