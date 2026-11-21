# Project plan & progress

*Last updated: 21 Nov 2026 — update the table when a milestone finishes.*

## Goal
A web platform where teachers upload course materials and students get **source-cited answers from those materials**,
while **most questions are answered without calling the LLM** (FAQ, cache, precomputed content). Three roles:
student, teacher, admin. Thesis evaluation compares it with the old Telegram bot (`AI_Must`).

## Progress
| Milestone | What | Status |
|---|---|---|
| M0 Setup | uv, Python 3.12, Postgres.app 17 + pgvector, Next.js 16 app, FastAPI, Alembic, health check, `/api` proxy | ✅ done |
| M0 Landing | Dark "modern AI" landing page, animated chat preview showing FAQ / cache / LLM routes | ✅ done |
| M0 CI | GitHub Actions: ruff + pytest (Postgres service), npm lint + build | ⬜ todo |
| M1 Auth & roles | Register (students), login/logout, JWT httpOnly cookie, role guards, dashboards, create_user script | ✅ done |
| M2a Courses | Teacher creates course + 6-char join code; students join; teacher sees/removes students | ✅ done |
| **M2b Materials** | Upload PDF/DOCX → parse → chunk (with file/page metadata) → local embeddings → `chunks` table (pgvector); status per file; background processing | ⏭️ **next** |
| M2c FAQ + viewer | Import Асуулт/Хариулт DOCX into `faq_items`; open PDF at a page | ⬜ |
| M3 Smart chat | Retrieval + answer router + Gemini `generate()` + SSE streaming + citations + chat UI + route logging | ⬜ |
| M4 Precompute & review | One-time Gemini drafts (summary, glossary, quiz questions) per material → teacher review queue | ⬜ |
| M5 Learning | Quizzes, flashcards, topic pages, progress | ⬜ |
| M6 Analytics & admin | Top questions, "not found" gaps, LLM-call share; admin user management, usage | ⬜ |
| M7 Evaluation | ~50-question gold set; old bot vs new: LLM-call rate, latency, citation accuracy, correctness | ⬜ |
| M8 Deploy + thesis | Hosted frontend/API/Postgres; thesis in LaTeX (MUST Overleaf template) | ⬜ (thesis in parallel) |

## Answer router (M3, `backend/app/ai/router.py`)
Each step stops at the first answer; the step is logged in `messages.route`:
1. **Intent rules** (no AI): greetings/thanks, "quiz me", "summarize lecture N", glossary "X гэж юу вэ".
2. **Teacher FAQ**: embedding similarity against approved FAQ items.
3. **Semantic answer cache**: same course + material version; numbers in the question must match; follow-ups skip it.
4. **Retrieval gate**: no chunk above threshold → "not in the course materials" (no LLM).
5. **LLM (Gemini)**: top-k chunks + course settings + history → streamed answer → saved to cache.

## M2b plan (next)
- Table `materials` (course, filename, type, size, status uploading/processing/ready/failed/no_text, pages, chunks, error, version hash, uploader).
- Table `chunks` (material, course, page, text, `embedding vector(384)`), index for vector search.
- `POST /api/courses/{id}/materials` (teacher owner; PDF/DOCX ≤ 50 MB) → save to `backend/data/uploads/` (git-ignored)
  → background task: parse (pypdf / docx) → chunk ~600 chars with overlap → embed (fastembed) → insert.
- `GET /api/courses/{id}/materials` (teacher + enrolled students), `GET .../materials/{mid}/file` (download/view),
  `DELETE` (teacher), `POST .../reprocess`.
- UI: teacher upload box + file list with live status; student materials list.
- Tests: upload permissions, parse/chunk unit tests with a tiny PDF/DOCX, status transitions.

## Key decisions
- Local Postgres.app now; move to a hosted Postgres when deploying (same engine, only the URL changes).
- Gemini free tier: rate-limited and may use prompts for training → no personal student data in prompts; mention in thesis.
  The router multiplies how many questions one free quota serves.
- Join codes avoid look-alike characters (no 0/O, 1/I/L).
- Courses a user may not see return 404 (hides existence).

## Thesis notes
- Structure follows the MUST template (as in the two example theses): Introduction → Ch.1 research (similar systems,
  survey) → Ch.2 analysis (requirements, MoSCoW, use cases, diagrams) → Ch.3 design & implementation (architecture,
  ERD, UI, testing + RTM) → **evaluation of the AI** (the part neither example had) → conclusion.
- Take screenshots after each milestone (landing, login, teacher course page, join code, student list, …).
