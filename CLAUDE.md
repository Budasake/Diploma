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
  core/config.py        settings from .env (DATABASE_URL, SECRET_KEY ≥32 chars, GEMINI_*, LLM_PROVIDER, UPLOAD_DIR, MAX_UPLOAD_MB)
  core/db.py            engine, get_db(), Base
  core/security.py      hash_password/verify_password (Argon2), create/decode_access_token (JWT)
  models/               user.py (User, UserRole), course.py (Course, Enrollment), material.py (Material, MaterialStatus,
                        Chunk with vector(384) + HNSW index), faq.py (FaqItem with question embedding)
                        — import new models in models/__init__.py
  schemas/              Pydantic request/response models (auth.py, course.py, material.py, faq.py incl. search)
  api/deps.py           DbSession, CurrentUser, require_role(...)
  api/health.py         GET /api/health
  api/auth.py           POST register/login/logout, GET me  (errors are short codes, e.g. "email_taken")
  api/courses.py        courses CRUD, join by code, students list/remove (no access → 404, not 403);
                        can_manage / get_visible_course / get_managed_course are reused by other routers
  api/materials.py      /courses/{id}/materials: upload (202 + BackgroundTasks), list, one, /chunks?page=, /file,
                        delete, reprocess
  api/faq.py            /courses/{id}/faq: list (students too), create/patch/delete, delete all, POST /import (DOCX)
  api/search.py         GET /courses/{id}/search?q= (teacher test search: FAQ + chunks with similarity)
  ingest/               faq.py (Асуулт/Хариулт DOCX → FaqEntry list); parse.py (pypdf/python-docx → pages,
                        legacy Mongolian font fix) → chunking.py (~600 chars, 100 overlap, per page)
                        → pipeline.py process_material() (embed + store, sets status); files in backend/data/uploads
  ai/embeddings.py      embed_texts() — local fastembed multilingual MiniLM (384-dim), model cached in backend/data/models.
                        Call it as `embeddings.embed_texts(...)` (module attribute) so tests can replace it.
  ai/retrieval.py       embed_query(), search_faq(), search_chunks() — pgvector cosine search inside one course
  scripts/create_user.py
backend/alembic/versions/   001 pgvector, 002 users, 003 courses+enrollments, 004 materials+chunks, 005 faq_items
backend/tests/              conftest.py (diploma_test DB, temp UPLOAD_DIR, fake embeddings unless @pytest.mark.real_embeddings,
                            fixtures make_user/teacher/other_teacher/student/admin, login_as; fake embeddings are hash-based), sample_files.py (make_pdf/make_docx),
                            test_health/auth/courses/materials/ingest/faq.py
web/src/
  app/page.tsx              landing page (components/landing/*, animated ChatPreview)
  app/(auth)/login|register login/register pages (components/auth/*)
  app/student|teacher|admin dashboards; student|teacher/courses/[id] course pages
  components/dashboard/     DashboardShell (top bar + logout), ComingSoonCards
  components/courses/       CourseCard, CreateCourseForm, JoinCodeCard, JoinCourseForm, StudentsTable, DeleteCourseButton
  components/materials/     MaterialsManager (teacher: drag-drop, XHR upload progress, polls while processing),
                            StudentMaterialList, MaterialStatusBadge, MaterialViewer (PDF at ?page=N + teacher text panel)
  components/faq/           FaqManager (teacher: import/add/edit/delete), FaqList (student, grouped + filter)
  components/search/        SearchTester (teacher test search)
  components/courses/BackLink.tsx  "← back" link for inner pages
  lib/api-server.ts         apiGet() for Server Components (forwards cookie to FastAPI)
  lib/auth.ts               getCurrentUser(), requireRole(role) — call inside <Suspense>
  lib/api-errors.ts         backend error code → Mongolian message; safeNextPath()
  lib/types.ts              User, Course, Student, Material, Chunk, FaqItem, SearchResult, groupFaq(), materialFileUrl(), …
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
- **Uploads through Next.js:** `next.config.ts` sets `experimental.proxyClientMaxBodySize: "60mb"` — without it the
  proxy cuts request bodies at 10 MB. FastAPI enforces the real 50 MB limit.
- **Git ignore gotcha:** the teacher's real course files live in `/materials/` (root, git-ignored). Always write
  root-only ignore rules with a leading `/` — a plain `materials/` also hid `web/src/components/materials/`.
- **Tailwind gotcha:** arbitrary `vh` classes like `h-[75vh]` were not generated (px ones are) — use an inline
  `style={{ height: "75vh" }}`. Grid columns with long words (URLs, emails) need `min-w-0` or they overflow on phones.
- Tests: one behavior per test; use fixtures `client`, `make_user`; separate `TestClient` per logged-in user.
