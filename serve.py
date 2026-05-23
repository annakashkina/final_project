#!/usr/bin/env python3
import http.server
import hmac
import json
import glob
import html
import re
import secrets
import threading
import urllib.request
import os
import sys
import time

try:
    from validator import fix_line_refs, extract_code_from_messages
    VALIDATOR_ENABLED = True
except ImportError:
    VALIDATOR_ENABLED = False

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Load .env file if present
env_path = os.path.join(BASE_DIR, ".env")
if os.path.exists(env_path):
    for line in open(env_path):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ[k.strip()] = v.strip()

LLM_API_KEY = os.environ.get("LLM_API_KEY") or os.environ.get("GROQ_API_KEY", "")
LLM_MODEL = os.environ.get("LLM_MODEL") or os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")
LLM_API_URL = os.environ.get("LLM_API_URL") or os.environ.get("GROQ_URL", "https://api.groq.com/openai/v1/chat/completions")
DASHBOARD_SECRET = os.environ.get("DASHBOARD_SECRET") or secrets.token_urlsafe(32)
_DASHBOARD_SECRET_AUTOGEN = not os.environ.get("DASHBOARD_SECRET")

# Unsloth Studio: if UNSLOTH_PASSWORD is set, authenticate at startup to get a JWT,
# then use it as the bearer token for the /v1/chat/completions endpoint.
UNSLOTH_PASSWORD = os.environ.get("UNSLOTH_PASSWORD", "")
UNSLOTH_USER = os.environ.get("UNSLOTH_USER", "unsloth")

def _unsloth_auth():
    """Authenticate with Unsloth Studio and return a JWT access token."""
    base = LLM_API_URL.rsplit("/v1", 1)[0]
    payload = json.dumps({"username": UNSLOTH_USER, "password": UNSLOTH_PASSWORD}).encode()
    req = urllib.request.Request(base + "/api/auth/login", data=payload,
                                headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read())
    return data.get("access_token") or data.get("token", "")

if UNSLOTH_PASSWORD:
    try:
        LLM_API_KEY = _unsloth_auth()
        LLM_MODEL = "active-model"
        print(f"Unsloth: authenticated, model={LLM_MODEL}", file=sys.stderr)
    except Exception as e:
        print(f"Unsloth auth failed: {e}", file=sys.stderr)

LLM_HEADERS = {"Content-Type": "application/json", "User-Agent": "CodeProbe/1.0"}
if LLM_API_KEY:
    LLM_HEADERS["Authorization"] = f"Bearer {LLM_API_KEY}"

# Fallback LLM (used when primary returns 429). URL/MODEL default to primary's
# so a different key on the same provider just works.
LLM_FALLBACK_API_KEY = os.environ.get("LLM_FALLBACK_API_KEY", "")
LLM_FALLBACK_API_URL = os.environ.get("LLM_FALLBACK_API_URL") or LLM_API_URL
LLM_FALLBACK_MODEL = os.environ.get("LLM_FALLBACK_MODEL") or LLM_MODEL
LLM_FALLBACK_HEADERS = {"Content-Type": "application/json", "User-Agent": "CodeProbe/1.0"}
if LLM_FALLBACK_API_KEY:
    LLM_FALLBACK_HEADERS["Authorization"] = f"Bearer {LLM_FALLBACK_API_KEY}"


def _llm_call(messages, llm_extra, use_fallback=False):
    """Call the LLM once. Returns (reply, error_info, model_used)."""
    if use_fallback:
        api_url, headers, model, label = LLM_FALLBACK_API_URL, LLM_FALLBACK_HEADERS, LLM_FALLBACK_MODEL, "fallback"
    else:
        api_url, headers, model, label = LLM_API_URL, LLM_HEADERS, LLM_MODEL, "primary"
    payload = json.dumps({
        "model": model,
        "messages": messages,
        "temperature": 0.7,
        "stream": False,
        **llm_extra,
    }).encode()
    req = urllib.request.Request(api_url, data=payload, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read())
            return result["choices"][0]["message"]["content"], None, model
    except urllib.error.HTTPError as e:
        try:
            err_body = e.read().decode(errors="replace")
            print(f"LLM API ({label}) error status={e.code} body={err_body[:500]}", file=sys.stderr)
        except Exception:
            print(f"LLM API ({label}) error status={e.code}", file=sys.stderr)
        return None, (e.code, "upstream error"), model
    except Exception as e:
        print(f"LLM API ({label}) error: {type(e).__name__}: {e}", file=sys.stderr)
        return None, (500, "upstream error"), model

DATA_DIR = os.path.join(BASE_DIR, "data")
USERS_FILE = os.path.join(DATA_DIR, "_users.json")

# Bot protection
BOT_UA_RE = re.compile(
    r"bot|crawl|spider|slurp|bingpreview|mediapartners|facebookexternalhit"
    r"|semrush|ahref|mj12|dotbot|bytespider|gptbot|claudebot|ccbot",
    re.IGNORECASE,
)
_UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
_TOKEN_RE = re.compile(r'^[A-Za-z0-9_-]{32,64}$')
_INVITE_PATH_RE = re.compile(r'^/invite/[A-Za-z0-9_-]{1,64}$')
MAX_BODY = 256 * 1024  # 256KB
MAX_FEEDBACK_LEN = 5000
TRUSTED_PROXIES = {"127.0.0.1", "::1"}

# Thread lock for shared file/state access
_lock = threading.Lock()

# Rate limiting per bucket: {(bucket, ip): [timestamp, ...]}
_rate_hits = {}
RATE_LIMITS = {
    "chat":     (60,  3600),   # 60/hour — LLM spend
    "event":    (600, 3600),   # 600/hour — analytics
    "register": (20,  3600),   # 20/hour — token mint
    "mutate":   (30,  3600),   # 30/hour — delete/export/feedback
}
RETENTION_DAYS = 90        # auto-delete inactive data after this many days

STATIC_ALLOWED_EXT = {
    ".html", ".css", ".js", ".mjs", ".map",
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp",
    ".woff", ".woff2", ".ttf", ".otf",
    ".txt", ".json",
}
STATIC_DENIED_PREFIXES = ("data/", "deploy/", "__pycache__/", ".")
STATIC_DENIED_SUFFIXES = (".env", ".pkl", ".py", ".jsonl", ".service", ".sh", ".sig")
STATIC_DENIED_FILES = {"_users.json", ".env", ".env.example", ".token_secret"}

_TRACK_RE = re.compile(r'/\*\s*@codeprobe-track\s*\n(.*?)\*/', re.DOTALL)


def _template_page(filename, title):
    path = os.path.join(BASE_DIR, filename)
    if not os.path.exists(path):
        return None
    with open(path) as f:
        tpl = f.read()
    return tpl.replace("{{TITLE}}", title).encode()


def _template_pages(specs):
    pages = {}
    for route, filename, title in specs:
        page = _template_page(filename, title)
        if page:
            pages[route] = page
    return pages


def _discover_tracks():
    """Scan lessons*.js for @codeprobe-track metadata, generate pages in memory."""
    track_tpl = os.path.join(BASE_DIR, "_track.html")
    landing_tpl = os.path.join(BASE_DIR, "_landing.html")
    with open(track_tpl) as f:
        track_html = f.read()
    with open(landing_tpl) as f:
        landing_html = f.read()

    pages = {}
    tracks = []

    for path in sorted(glob.glob(os.path.join(BASE_DIR, "lessons*.js"))):
        fname = os.path.basename(path)
        # lessons.js → "default", lessons_foo.js → "foo"
        if fname == "lessons.js":
            route = "default"
        else:
            route = fname.removeprefix("lessons_").removesuffix(".js")

        with open(path) as f:
            content = f.read()

        meta = {}
        m = _TRACK_RE.search(content)
        if m:
            try:
                meta = json.loads(m.group(1).strip())
            except json.JSONDecodeError:
                print(f"WARNING: bad @codeprobe-track JSON in {fname}", file=sys.stderr)

        title = meta.get("title", "codeprobe")
        page = track_html.replace("{{LESSONS_SRC}}", f"./{fname}").replace("{{TITLE}}", html.escape(title))
        pages[f"/{route}"] = page.encode()

        if "section" in meta:
            tracks.append({"route": route, **meta})

    tracks.sort(key=lambda t: t.get("order", 999))

    # Group by section, preserving first-seen order
    sections = {}
    for t in tracks:
        sections.setdefault(t["section"], []).append(t)

    cards_html = []
    for section, items in sections.items():
        cards_html.append(f'    <div class="section-label">{html.escape(section)}</div>')
        cards_html.append('    <div class="track-grid">')
        for t in items:
            icon = html.escape(t.get("icon", ""))
            name = html.escape(t.get("name", t["route"]))
            desc = html.escape(t.get("description", ""))
            meta_spans = "".join(f"<span>{html.escape(m)}</span>" for m in t.get("meta", []))
            cards_html.append(
                f'      <a class="track-card" href="/{html.escape(t["route"])}">\n'
                f'        <div class="track-card-head">\n'
                f'          <span class="track-icon">{icon}</span>\n'
                f'          <span class="track-name">{name}</span>\n'
                f'        </div>\n'
                f'        <div class="track-desc">{desc}</div>\n'
                f'        <div class="track-meta">{meta_spans}</div>\n'
                f'      </a>'
            )
        cards_html.append('    </div>')

    pages["/"] = landing_html.replace("{{TRACKS}}", "\n".join(cards_html)).encode()
    return pages

_PAGES = _discover_tracks()
_PAGES.update(_template_pages((
    ("/assessment", "_assessment.html", "C Comprehension Test"),
    ("/study", "_study.html", "C Comprehension Test"),
)))
_INVITE_PAGE = _template_page("_invite.html", "CodeProbe Invite")


def valid_uid(uid):
    return bool(_UUID_RE.match(uid))


def is_bot(ua):
    return bool(BOT_UA_RE.search(ua or ""))


def valid_token(tok):
    return bool(tok) and bool(_TOKEN_RE.match(tok))


def valid_invite_path(path):
    return bool(_INVITE_PATH_RE.match(path))


def mint_token():
    return secrets.token_urlsafe(32)


def verify_token(uid, presented):
    """Constant-time token check against the token stored in _users.json.
    Returns True only if the uid has a stored token and it matches."""
    if not valid_uid(uid) or not valid_token(presented):
        return False
    with _lock:
        users = load_users()
        stored = (users.get(uid) or {}).get("token")
    if not stored:
        return False
    return hmac.compare_digest(stored, presented)


def register_uid(uid):
    """Trust-on-first-use: mint a token for a new uid. Returns token, or None
    if uid already has a token (prevents hijacking a registered account)."""
    if not valid_uid(uid):
        return None
    with _lock:
        users = load_users()
        if uid in users and "token" in users[uid]:
            return None  # already claimed
        now = int(time.time() * 1000)
        meta = users.get(uid, {"first_seen": now})
        meta["token"] = mint_token()
        meta.setdefault("first_seen", now)
        users[uid] = meta
        save_users(users)
        return meta["token"]


def check_rate(bucket, ip):
    """Returns True if under limit for (bucket, ip)."""
    limit, window = RATE_LIMITS.get(bucket, (60, 3600))
    with _lock:
        now = time.time()
        key = (bucket, ip)
        hits = _rate_hits.get(key, [])
        hits = [t for t in hits if now - t < window]
        if len(hits) >= limit:
            _rate_hits[key] = hits
            return False
        hits.append(now)
        _rate_hits[key] = hits
        return True


def validate_messages(messages):
    """Validate chat messages array. Returns error string or None."""
    if not isinstance(messages, list) or len(messages) == 0:
        return "messages must be a non-empty array"
    if len(messages) > 60:
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
    """Client IP. Trust X-Forwarded-For only when direct peer is a trusted proxy
    (Caddy on localhost). Otherwise the peer IP wins — prevents XFF spoofing."""
    peer = handler.client_address[0]
    if peer in TRUSTED_PROXIES:
        forwarded = handler.headers.get("X-Forwarded-For", "")
        if forwarded:
            first = forwarded.split(",")[0].strip()
            if re.match(r"^[0-9a-fA-F:.]{2,45}$", first):
                return first
    return peer


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


def _is_static_safe(rel_path):
    """Allow-list gate for the static file fallthrough. rel_path is the request
    path stripped of leading '/' and query string; must be a simple relative
    path (no absolute, no '..', no backslash, no NUL)."""
    if not rel_path:
        return True  # index
    if "\x00" in rel_path or "\\" in rel_path:
        return False
    if rel_path.startswith("/") or ".." in rel_path.split("/"):
        return False
    lower = rel_path.lower()
    if any(lower.startswith(p) for p in STATIC_DENIED_PREFIXES):
        return False
    basename = lower.rsplit("/", 1)[-1]
    if basename in STATIC_DENIED_FILES or basename.startswith("."):
        return False
    if any(lower.endswith(s) for s in STATIC_DENIED_SUFFIXES):
        return False
    ext = os.path.splitext(basename)[1]
    if ext and ext not in STATIC_ALLOWED_EXT:
        return False
    return True


class Handler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _dashboard_ok(self):
        """Constant-time check that the path carries the dashboard secret."""
        # Path form: /dashboard/<secret> OR ?key=<secret>
        query = self.path.split("?", 1)[1] if "?" in self.path else ""
        params = dict(p.split("=", 1) for p in query.split("&") if "=" in p)
        supplied = params.get("key", "")
        if not supplied and self.path.startswith("/dashboard/"):
            supplied = self.path.split("/dashboard/", 1)[1].split("?", 1)[0]
        if not supplied:
            return False
        return hmac.compare_digest(supplied, DASHBOARD_SECRET)

    def do_GET(self):
        if self.path.startswith("/dashboard/"):
            if not self._dashboard_ok():
                self._json_response(403, {"error": "forbidden"})
                return
            dash_path = os.path.join(BASE_DIR, "dashboard.html")
            with open(dash_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)

        elif self.path.startswith("/api/users"):
            if not self._dashboard_ok():
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
            if not self._dashboard_ok():
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
            if not verify_token(uid, token):
                self._json_response(403, {"error": "forbidden"})
                return
            if not check_rate("mutate", get_real_ip(self)):
                self._json_response(429, {"error": "rate limit exceeded"})
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
            priv_path = os.path.join(BASE_DIR, "privacy.html")
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

        elif self.path == "/whoami":
            who_path = os.path.join(BASE_DIR, "whoami.html")
            with open(who_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)

        elif self.path.split("?")[0] in _PAGES:
            self._serve_page_route()

        elif valid_invite_path(self.path.split("?", 1)[0]):
            self._serve_html(_INVITE_PAGE)

        else:
            rel = self.path.split("?", 1)[0].lstrip("/")
            if not _is_static_safe(rel):
                self.send_error(404)
                return
            super().do_GET()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))

        ua = self.headers.get("User-Agent", "")
        if is_bot(ua):
            if length:
                self.rfile.read(length)  # drain body for HTTP/1.1 keep-alive
            self._json_response(403, {"error": "forbidden"})
            return

        if length > MAX_BODY:
            # Don't try to drain a huge body — just close the connection.
            self.close_connection = True
            self._json_response(413, {"error": "request too large"})
            return

        uid = self.headers.get("X-UID", "")
        token = self.headers.get("X-Token", "")

        # /api/register is unauth'd (TOFU) — handle before token check
        if self.path == "/api/register":
            if length:
                self.rfile.read(length)  # drain body
            if not check_rate("register", get_real_ip(self)):
                self._json_response(429, {"error": "rate limit exceeded"})
                return
            if not valid_uid(uid):
                self._json_response(400, {"error": "invalid uid"})
                return
            new_tok = register_uid(uid)
            if not new_tok:
                self._json_response(409, {"error": "already registered"})
                return
            self._json_response(200, {"token": new_tok})
            return

        # All other /api/* endpoints require a valid token
        if self.path.startswith("/api/"):
            if not verify_token(uid, token):
                if length:
                    self.rfile.read(length)  # drain body for HTTP/1.1 keep-alive
                self._json_response(403, {"error": "invalid token"})
                return

        if self.path == "/api/chat":
            if not check_rate("chat", get_real_ip(self)):
                if length:
                    self.rfile.read(length)
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

            msgs = body["messages"]
            if UNSLOTH_PASSWORD and len(msgs) == 1 and msgs[0]["role"] == "system":
                msgs = msgs + [{"role": "user", "content": "Begin."}]

            llm_extra = {}
            if UNSLOTH_PASSWORD:
                llm_extra["enable_thinking"] = False

            # First attempt on primary
            reply, error_info, used_model = _llm_call(msgs, llm_extra, use_fallback=False)

            # On 429, switch to fallback for the rest of this request
            use_fallback = False
            if error_info and error_info[0] == 429 and LLM_FALLBACK_API_KEY:
                print("LLM API: primary rate-limited, switching to fallback", file=sys.stderr)
                use_fallback = True
                reply, error_info, used_model = _llm_call(msgs, llm_extra, use_fallback=True)

            # Retry once if error or too-short reply (~50 tokens ≈ 40 words)
            # Skip short-reply check when caller expects a short response (e.g. assessment grading)
            expect_short = body.get("expect_short", False)
            needs_retry = error_info is not None or (not expect_short and reply is not None and len(reply.split()) < 40)
            used_messages = body["messages"]

            if needs_retry:
                if saving:
                    ensure_data_dir()
                    chat_file = os.path.join(DATA_DIR, f"{uid}_chat.jsonl")
                    failed_record = {
                        "ts": int(time.time() * 1000),
                        "model": used_model,
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
                retry_msgs = [dict(m) for m in body["messages"]]
                if UNSLOTH_PASSWORD and len(retry_msgs) == 1 and retry_msgs[0]["role"] == "system":
                    retry_msgs.append({"role": "user", "content": "Begin."})
                if retry_msgs:
                    retry_msgs[-1]["content"] += " "

                reply, error_info, used_model = _llm_call(retry_msgs, llm_extra, use_fallback=use_fallback)

                # If the retry hit 429 on primary, give fallback one shot
                if error_info and error_info[0] == 429 and not use_fallback and LLM_FALLBACK_API_KEY:
                    print("LLM API: retry rate-limited on primary, switching to fallback", file=sys.stderr)
                    use_fallback = True
                    reply, error_info, used_model = _llm_call(retry_msgs, llm_extra, use_fallback=True)

                if not error_info:
                    used_messages = retry_msgs

            # Return error if still failing after retry
            if error_info:
                self._json_response(error_info[0], {"error": error_info[1]})
                return

            # Validate and fix line references before sending to student
            if VALIDATOR_ENABLED:
                code = extract_code_from_messages(body["messages"])
                if code:
                    reply = fix_line_refs(reply, code)

            # Log final exchange to chat history (only in saving mode)
            if saving:
                ensure_data_dir()
                chat_file = os.path.join(DATA_DIR, f"{uid}_chat.jsonl")
                chat_record = {
                    "ts": int(time.time() * 1000),
                    "model": used_model,
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
            if not check_rate("event", get_real_ip(self)):
                if length:
                    self.rfile.read(length)
                self._json_response(429, {"error": "rate limit exceeded"})
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
            # Token already verified by the gate above; also rate-limit.
            if not check_rate("mutate", get_real_ip(self)):
                self._json_response(429, {"error": "rate limit exceeded"})
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
            if not check_rate("mutate", get_real_ip(self)):
                if length:
                    self.rfile.read(length)
                self._json_response(429, {"error": "rate limit exceeded"})
                return
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
            if len(text) > MAX_FEEDBACK_LEN:
                self._json_response(413, {"error": "feedback too long"})
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
            if length:
                self.rfile.read(length)  # drain body for HTTP/1.1 keep-alive
            self.send_response(404)
            self.send_header("Content-Length", "0")
            self.end_headers()

    def _serve_page_route(self):
        """Serve a generated HTML page from memory."""
        route = self.path.split("?")[0]
        self._serve_html(_PAGES.get(route))

    def _serve_html(self, content):
        if not content:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def _json_response(self, code, data):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        # Security headers on every response (safe on JSON + HTML + static)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        path_only = self.path.split("?", 1)[0]
        if path_only.endswith(".html") or "." not in path_only.rsplit("/", 1)[-1] or path_only.startswith("/dashboard") or path_only == "/privacy":
            self.send_header(
                "Content-Security-Policy",
                "default-src 'self'; "
                "script-src 'self'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data:; "
                "font-src 'self' data:; "
                "connect-src 'self'; "
                "frame-ancestors 'none'; "
                "base-uri 'self'",
            )
        super().end_headers()

    def do_OPTIONS(self):
        # Same-origin only — no CORS needed; respond minimal
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def log_message(self, fmt, *args):
        first = str(args[0]) if args else ""
        if "/api/" in first:
            super().log_message(fmt, *args)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
    os.chdir(BASE_DIR)
    print(f"codeprobe at http://localhost:{port}")
    if _DASHBOARD_SECRET_AUTOGEN:
        print(
            "WARNING: DASHBOARD_SECRET env var not set — generated an ephemeral "
            "random secret. Set DASHBOARD_SECRET to a persistent value in production.",
            file=sys.stderr,
        )
        print(f"Dashboard at http://localhost:{port}/dashboard/{DASHBOARD_SECRET}")
    else:
        preview = DASHBOARD_SECRET[:4] + "…" if len(DASHBOARD_SECRET) > 4 else "…"
        print(f"Dashboard at http://localhost:{port}/dashboard/<DASHBOARD_SECRET={preview}>")
    print(f"Using model: {LLM_MODEL}")
    print(f"API: {LLM_API_URL}")
    if LLM_FALLBACK_API_KEY:
        print(f"Fallback model: {LLM_FALLBACK_MODEL}")
        print(f"Fallback API: {LLM_FALLBACK_API_URL}")
    schedule_cleanup()
    server = http.server.ThreadingHTTPServer(("", port), Handler)
    server.request_queue_size = 64
    server.socket.listen(64)
    server.serve_forever()
