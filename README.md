# codeprobe

Active learning tool for codebases. Engineers learn by reading real code and being quizzed on it, instead of reading the docs.

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
| `LLM_API_KEY` | API key (omit for keyless local models) | `sk-...` |
| `LLM_API_URL` | Chat completions endpoint | `https://api.groq.com/openai/v1/chat/completions` |
| `LLM_MODEL` | Model identifier | `llama-3.3-70b-versatile` |

Works with Groq, xAI, OpenAI, Ollama, or any provider with an OpenAI-compatible `/v1/chat/completions` endpoint.

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
