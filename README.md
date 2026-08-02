# codeprobe

Active learning tool for codebases. Engineers learn by reading real code and being quizzed on it, instead of reading the docs.

An AI tutor guides the learner through code snippets, asks questions, and verifies understanding before moving on. Based on research showing that scaffolded AI (+127% practice gains, no exam loss) and retrieval practice (g=0.50) outperform passive reading and plain chatbots.

**Tech stack:** Python 3 stdlib backend (no frameworks, no pip dependencies for the core), vanilla JS frontend (no build step), JSONL storage (no database), any OpenAI-compatible LLM provider, optional ML line-reference validator (LightGBM). Live at [codeprobe-app.dev](https://codeprobe-app.dev).

## Setup

```bash
# 1. Configure your LLM provider (any OpenAI-compatible API)
cp .env.example .env
# Edit .env with your API key and endpoint

# 2. Start
python3 serve.py
# → http://localhost:3000
```

Environment variables:

| Variable | Description | Example |
|---|---|---|
| `LLM_API_KEY` | API key (omit for keyless local models) | `sk-...` |
| `LLM_API_URL` | Chat completions endpoint | `https://api.groq.com/openai/v1/chat/completions` |
| `LLM_MODEL` | Model identifier | `llama-3.3-70b-versatile` |

Works with Groq, xAI, OpenAI, Ollama, or any provider with an OpenAI-compatible `/v1/chat/completions` endpoint.

## Running tests

```bash
python3 -m pytest tests/ -v              # full suite: 164 tests, < 1 second
python3 tests/test_frontend_runner.py    # JavaScript suite alone (needs Node)
```

Tests cover input validation, static-file security, path traversal, TOFU auth, rate limiting, GDPR export/deletion, data retention, cross-user isolation, and frontend logic. They run in temp directories with a stubbed LLM — no network, no real data.

## Repository structure

```
serve.py            Backend: HTTP server, API, auth, rate limiting, LLM proxy (~900 lines, stdlib only)
validator.py        ML line-reference validator (LightGBM ranker, HMAC-signed model)
app.js              Frontend: lesson phases, chat, prompt construction
lessons.js          Main track index; lessons_*.js = other tracks (auto-discovered)
lessons/            Lesson content modules (C, C++, Python, Ruby, Rust, TypeScript, …)
dashboard.html/js   Admin analytics dashboard (per-user event timelines)
privacy.html        Privacy policy
vendor/             Self-hosted highlight.js (BSD-3-Clause, see vendor/highlight.js/LICENSE)
tests/              Automated test suite
deploy/             Production deployment: deploy.sh, setup.sh, systemd unit
data/               Runtime user data (JSONL, gitignored)
```

## Production deployment

Automated via `deploy/deploy.sh` (rsync + `deploy/setup.sh` on the server): creates an unprivileged system user, installs Caddy with auto-HTTPS and security headers, generates secrets, signs the ML model, installs a hardened systemd unit (filesystem sandbox, 300 MB memory cap, auto-restart), and configures the firewall. Requirements: a Debian-based VPS with 512 MB RAM, a domain's A record, and your `.env`. Updates are `git pull` + `systemctl restart codeprobe` — no builds, no migrations.

## ML line-reference validator

The tutor cites specific code lines and sometimes gets them wrong. `validator.py` post-processes every response: each cited line is re-scored against every line in the file by a trained ranker (33 features: identifier overlap, TF-IDF similarity, backtick-span matching), and wrong references are rewritten in milliseconds before the learner sees them. The model file is HMAC-SHA256 signed and verified before loading; without a key the platform simply runs with validation off. Training pipeline and evaluation live in the project's `ml/` directory.

## Writing lessons

Each file in `lessons/` exports a series object with a `name` and a `lessons` array:

```js
export const pythonLessons = { name: "Python", lessons: [
  {
    id: "auth-middleware",
    title: "How Auth Middleware Works",
    difficulty: "Intermediate",
    concepts: [
      "Request lifecycle",
      "Token validation",
      "Middleware chaining",
    ],
    code: `def auth_middleware(request):
      token = request.headers.get("Authorization")
      if not token or not verify(token):
          return Response(401)
      request.user = decode(token)
      return next(request)`,
    seedQuestions: [
      "What happens if the Authorization header is missing?",
      "Where does request.user come from downstream?",
    ],
  },
] };
```

Use `files` instead of `code` when a concept spans multiple files:

```js
{
  id: "api-route-flow",
  title: "Request Flow: Route to DB",
  files: [
    { name: "routes.py", code: `...` },
    { name: "models.py", code: `...` },
    { name: "db.py",     code: `...` },
  ],
  seedQuestions: [
    "Trace a GET /users request from route to database query",
  ],
}
```

### Generating lessons

The most efficient way to create new lessons is to point Claude Code, Codex or similar at your source and have it generate lesson objects using existing lessons as a template. Review and update as necessary.

Similarly, you can run Claude Code, Codex or similar periodically to check if the existing lessons are up-to-date with existing codebase, and update.

Each lesson gets its own id: to update the existing lesson without side-effects, update the lesson and keep the id. If you want the lesson to appear new - update the id as well.

### Lesson fields

| Field | Required | Description |
|---|---|---|
| `id` | yes | Unique identifier |
| `title` | yes | Short title |
| `difficulty` | yes | `Beginner`, `Intermediate`, `Advanced`, `Essential` |
| `concepts` | yes | Array of concept strings the lesson covers |
| `code` | * | Code string (single-file lessons) |
| `files` | * | Array of `{ name, code }` objects (multi-file lessons) |
| `seedQuestions` | yes | 2-3 questions shown before the session starts |
| `description` | no | One-line summary |
| `icon` | no | Emoji icon |
| `bridges` | no | `{ Language: "explanation..." }` for cross-language context |

\* Provide either `code` or `files`, not both.

## Dashboard

`/dashboard.html` shows per-user progress: lessons completed, questions asked, where learners struggled. Useful for tracking onboarding across a team.

## Privacy

No accounts, no cookies, no trackers, no PII. Ephemeral by default — nothing is stored unless the learner opts in. Data export and deletion are one click, retention is 90 days, and the server runs in the EU. Full policy at `/privacy`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the branching strategy, commit conventions, and code style.

## License

MIT — see [LICENSE](LICENSE). Bundled third-party code: highlight.js v11.9.0 (BSD-3-Clause, [vendor/highlight.js/LICENSE](vendor/highlight.js/LICENSE)).
