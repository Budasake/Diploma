# AI Learning Assistant — Diploma project

Bachelor's diploma project (MUST, School of ICT, 2026): a **teacher-centered AI learning assistant** web system.
Teachers upload course materials; students ask questions and get answers **grounded in those materials, with real citations**.

**Core idea (thesis contribution):** the LLM is *not* the default answerer. An **answer router** tries cheap steps first
(intent rules → teacher FAQ → semantic answer cache → retrieval gate "not in materials") and calls the LLM only for
genuinely new questions, then caches the answer. Citations are built in code from chunk metadata, never by the LLM.
The old Telegram bot prototype (`AI_Must`, separate repo, outside this folder) is the "before" baseline for evaluation.

Roadmap and progress: **`docs/PLAN.md`** (keep it updated when a milestone finishes).

## Working rules
- **Never `git commit` or `git push`.** The user commits and pushes themself. Finish work, then list changed files.
- Explain what was built in simple terms (the user is learning); UI text is **Mongolian**, code/comments English.
- Before writing Next.js code, read the bundled docs in `web/node_modules/next/dist/docs/` — this is **Next.js 16**
  (e.g. `middleware` is now `src/proxy.ts`; `params` is a Promise; with Cache Components, reading cookies/params must
  happen inside `<Suspense>`).
- Verify changes: backend `uv run pytest` + `uv run ruff check .`; frontend `npx tsc --noEmit` (after a build),
  `npm run lint`, `npm run build`; then check the flow in the browser. Delete any test users/data you create in `diploma`.
- Secrets live only in `backend/.env` (git-ignored). Never print or commit keys.

## Stack
| Part | Tech |
|---|---|
| Frontend `web/` | Next.js 16 App Router, TypeScript, Tailwind 4, lucide-react. Dark "modern AI" theme (tokens in `globals.css`) |
| Backend `backend/` | FastAPI, Python 3.12 (uv), SQLAlchemy 2, Alembic, Pydantic v2 |
| Database | PostgreSQL 17 (Postgres.app, local) + pgvector. DBs: `diploma` (dev), `diploma_test` (pytest) |
| Auth | Argon2 password hashes, JWT in httpOnly cookie `access_token` (SameSite=Lax), roles student/teacher/admin |
| LLM | **Gemini free tier** (default), pluggable via `LLM_PROVIDER` in `.env` (gemini/ollama/claude) |
| Embeddings | local multilingual model `paraphrase-multilingual-MiniLM-L12-v2` (fastembed), no API cost |

Browser only talks to Next.js (:3000); `next.config.ts` rewrites `/api/*` → FastAPI (:8000). Same origin = no CORS, first-party cookies.

## Run (dev)
```bash
cd backend && uv run fastapi dev app/main.py      # API  http://localhost:8000  (docs: /docs)
cd web && npm run dev                             # site http://localhost:3000
cd backend && uv run alembic upgrade head         # apply DB migrations
cd backend && uv run python -m app.scripts.create_user --role teacher --email x@y.mn --name "Name"   # asks for password
```
`psql` is at `/Applications/Postgres.app/Contents/Versions/latest/bin/psql` if not on PATH.

## Code map
```
backend/app/
  main.py               app, CORS, routers under /api
  core/config.py        settings from .env (DATABASE_URL, SECRET_KEY ≥32 chars, GEMINI_*, LLM_PROVIDER)
  core/db.py            engine, get_db(), Base
  core/security.py      hash_password/verify_password (Argon2), create/decode_access_token (JWT)
  models/               user.py (User, UserRole), course.py (Course, Enrollment) — import new models in models/__init__.py
  schemas/              Pydantic request/response models (auth.py, course.py)
  api/deps.py           DbSession, CurrentUser, require_role(...)
  api/health.py         GET /api/health
  api/auth.py           POST register/login/logout, GET me  (errors are short codes, e.g. "email_taken")
  api/courses.py        courses CRUD, join by code, students list/remove (no access → 404, not 403)
  scripts/create_user.py
backend/alembic/versions/   001 pgvector, 002 users, 003 courses+enrollments
backend/tests/              conftest.py (diploma_test DB, make_user fixture), test_health/auth/courses.py
web/src/
  app/page.tsx              landing page (components/landing/*, animated ChatPreview)
  app/(auth)/login|register login/register pages (components/auth/*)
  app/student|teacher|admin dashboards; student|teacher/courses/[id] course pages
  components/dashboard/     DashboardShell (top bar + logout), ComingSoonCards
  components/courses/       CourseCard, CreateCourseForm, JoinCodeCard, JoinCourseForm, StudentsTable, DeleteCourseButton
  lib/api-server.ts         apiGet() for Server Components (forwards cookie to FastAPI)
  lib/auth.ts               getCurrentUser(), requireRole(role) — call inside <Suspense>
  lib/api-errors.ts         backend error code → Mongolian message; safeNextPath()
  lib/types.ts              User, Course, Student, roleHome, roleLabel
  proxy.ts                  optimistic redirect to /login for /student|/teacher|/admin without cookie
```

## Patterns to follow
- **New table:** model in `app/models/` → import in `models/__init__.py` → `uv run alembic revision --autogenerate -m "..."`
  → review file (enum types need manual drop in downgrade) → `uv run alembic upgrade head`.
- **New endpoint:** router in `app/api/`, include in `main.py`, Pydantic schemas in `app/schemas/`, permission via
  `CurrentUser` / `require_role`, error `detail` as a short code + add its Mongolian text in `web/src/lib/api-errors.ts`.
- **Protected page:** `page.tsx` renders `<Suspense fallback={<DashboardSkeleton/>}>` around an async component that calls
  `requireRole(...)` and `apiGet(...)`, then wraps content in `DashboardShell`.
- **Mutations from the UI:** client component `fetch("/api/...")` then `router.refresh()` (or `router.push`).
- Tests: one behavior per test; use fixtures `client`, `make_user`; separate `TestClient` per logged-in user.
