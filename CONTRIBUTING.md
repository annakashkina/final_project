# Contributing

## Branching Strategy

The project uses a lightweight trunk-based flow:

- **`main`** is the trunk. It is always deployable — every commit on `main` must pass the full test suite (`python3 -m pytest tests/`, runs in under a second).
- **Feature branches** are created from `main` for any change larger than a trivial fix, and merged back via pull request (or fast-forward merge for solo work) once tests pass.
- Branches are short-lived: merge within days, not weeks, to minimize conflicts. Rebase on `main` before merging if the branch has drifted.

### Branch naming

```
feature/<short-slug>    new functionality        feature/exam-mode
fix/<short-slug>        bug fixes                fix/stale-token-after-delete
lessons/<short-slug>    lesson content only      lessons/rust-ownership
ml/<short-slug>         validator / ML pipeline  ml/real-error-mining
docs/<short-slug>       documentation only       docs/deploy-guide
```

Slugs are lowercase, hyphen-separated, and descriptive enough that `git branch` output reads as a to-do list.

### Merging rules

- Run the test suite before merging; add tests alongside behavior changes.
- No secrets in commits: `.env`, `token`, and `data/` are gitignored — keep it that way.
- Deployment happens from `main` only (`deploy/deploy.sh`).

## Commit Messages

Short, imperative, and informative about *what changed and why it matters* — e.g.
`Add invite flow, study page, prompt lab redesign; refactor serve.py templates`.
No ticket prefixes, no authorship tags. Group related changes into one commit rather
than many fragmentary ones.

## Code Style

- **Python:** stdlib only for the core server (`serve.py`) — adding a pip dependency to the core is an architectural decision, not a convenience. Follow the existing single-file structure and naming.
- **JavaScript:** vanilla ES6 modules, no build step, no framework. Escape all user- and LLM-provided content before rendering.
- **Lessons:** follow the schema in README ("Writing lessons"); keep lesson code short and readable — no walls of text.
- Match the surrounding code's comment density: comments explain constraints the code can't show, not what the next line does.

## Tests

```bash
python3 -m pytest tests/ -v              # full suite (Python + JS)
python3 tests/test_frontend_runner.py    # JS suite alone
```

Tests run against temp directories and a stubbed LLM — they must never touch `data/` or make network calls.
