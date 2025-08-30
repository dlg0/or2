# Repository Guidelines

**Project Overview**
- **Goal:** Web-first, 2D multiplayer social world for kids (6–12) with parent-controlled safety.
- **MVP Loop:** Choose simple shape avatar, move on a shared 2D canvas, see other players, preset emotes only.
- **Safety Model:** Parent accounts own families; children require approval and have enforced play-time windows.
- **World & Data:** Chunked world with color pickups driving points and evolution; durable state in Postgres, presence in Redis.
- **Stack:** Next.js client (Canvas), Colyseus server, TypeScript across repo, Zod for shared schemas.

## Project Structure & Module Organization
- Root keeps minimal config files (README, LICENSE, `.gitignore`).
- Place source code in `src/` (language-specific subfolders if needed).
- Tests live in `tests/` mirroring `src/` paths (e.g., `src/utils/` → `tests/utils/`).
- Put scripts and one-off tooling in `scripts/` (bash, Python, Node).
- Use `assets/` for static files and `examples/` for runnable samples.

## Build, Test, and Development Commands
- Prefer a Makefile as the single entry point:
  - `make setup`: install dependencies and pre-commit hooks.
  - `make dev`: run the app locally (watch mode where applicable).
  - `make test`: run the full test suite with coverage.
  - `make lint`: run linters/formatters and fail on issues.
  - `make build`: produce a release artifact.
- If no Makefile, mirror these with package or tool commands (e.g., `pytest -q`, `ruff check`, `npm run build`).

## Coding Style & Naming Conventions
- Use lowercase, hyphenated repo and directory names; snake_case for files in Python, kebab-case for web assets.
- 2 spaces or 4 spaces consistently; do not mix tabs.
- Recommended tools (adopt per language):
  - Python: `black`, `ruff`, `mypy` (strict on `src/`).
  - JS/TS: `eslint`, `prettier`, `tsc --noEmit`.
- Keep public APIs small and documented in docstrings or `README` examples.

## Testing Guidelines
- Mirror `src/` in `tests/`; name tests like `test_<module>.py` or `<name>.spec.ts`.
- Aim for ≥80% coverage on changed lines; add regression tests for bugs.
- Fast tests default; mark slow/integration separately (e.g., `@pytest.mark.slow`).

## Commit & Pull Request Guidelines
- Use Conventional Commits (e.g., `feat: add parser options`).
- Small, focused PRs with:
  - Clear description, motivation, and before/after notes.
  - Linked issues and screenshots/logs for UX or CLI changes.
  - Passing CI: lint, test, and build checks.

## Security & Configuration Tips
- Never commit secrets; use `.env` (local) and provide `.env.example`.
- Document required environment variables in `README`.

## Agent Notes (for automated contributors)
- Keep patches minimal and scoped; avoid sweeping refactors.
- Explain intent briefly before running commands; prefer `apply_patch` for edits.
- Do not add new dependencies or network calls without explicit instruction.
