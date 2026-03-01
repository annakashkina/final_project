# codeprobe

Active learning tool for codebases. Engineers learn by reading real code and being quizzed on it — not by reading docs.

An AI tutor guides the learner through code snippets, asks questions, and verifies understanding before moving on. Based on research showing that scaffolded AI (+127% practice gains, no exam loss) and retrieval practice (g=0.50) outperform passive reading and plain chatbots.

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
| `LLM_API_KEY` | API key (omit for keyless local models) | `gsk_...` |
| `LLM_API_URL` | Chat completions endpoint | `https://api.groq.com/openai/v1/chat/completions` |
| `LLM_MODEL` | Model identifier | `llama-3.3-70b-versatile` |

Works with Groq, xAI, OpenAI, Ollama, or any provider with an OpenAI-compatible `/v1/chat/completions` endpoint.

## Writing lessons

A lesson is a JS object in `lessons/`. Each file exports an array grouped by language or topic.

### Single-file lesson

```js
{
  id: "auth-middleware",
  lang: "python",
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
}
```

### Multi-file lesson

Use `files` instead of `code` when a concept spans multiple files:

```js
{
  id: "api-route-flow",
  lang: "python",
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

### Generating lessons with AI

Point Claude Code or Codex at your source and have it generate lesson objects using existing lessons as a template. Review and update as necessary.

Each lesson gets has its own id, so if you want to update the existing lesson without users noticing, update the id only. If you want the lesson to appear new - update the id as well.

### Lesson fields

| Field | Required | Description |
|---|---|---|
| `id` | yes | Unique identifier |
| `lang` | yes | Language tag |
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
