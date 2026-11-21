# Project plan & progress

*Last updated: 22 Nov 2026 — update the table when a milestone finishes.*

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
| M2b Materials | Upload PDF/DOCX → parse → chunk (with file/page metadata) → local embeddings → `chunks` table (pgvector); status per file; background processing | ✅ done |
| M2c FAQ + viewer | Import Асуулт/Хариулт DOCX into `faq_items`; open PDF at a page; teacher test search | ✅ done |
| **M3 Smart chat** | Retrieval + answer router + Gemini `generate()` + SSE streaming + citations + chat UI + route logging | ⏭️ **next** |
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

## M2b — what was built (22 Nov 2026)
- Tables `materials` (status processing/ready/no_text/failed, size, SHA-256 hash, pages, chunk count, error) and
  `chunks` (material, course, position, page, text, `embedding vector(384)`, HNSW cosine index). Migration 004.
- `POST /api/courses/{id}/materials` (course teacher or admin): checks extension **and** file signature, max 50 MB,
  rejects empty files and duplicates (same hash in the course), stores under `backend/data/uploads/` (git-ignored),
  answers 202 and processes in a FastAPI background task. Server restart marks unfinished jobs `failed: interrupted`.
- `GET` list (students see only `ready`), `GET .../{mid}/file` (PDF inline → `#page=N` works later), `DELETE`,
  `POST .../reprocess`. Deleting a course also deletes its files from disk.
- Chunking: per page, ~600 chars, 100 overlap, cut at paragraph/sentence/space. Embeddings: local
  `paraphrase-multilingual-MiniLM-L12-v2` (fastembed, ~220 MB, downloaded once to `backend/data/models/`).
- UI: teacher drag-and-drop upload with progress bar, live status (polls every 2 s), reprocess/delete; student list.
- Tests: 61 passing (parse, chunking, real-model similarity, upload permissions/limits/status, delete, reprocess).
- Quick check with a Mongolian lecture PDF: the right page was the top search hit for all 3 test questions
  (similarity 0.32–0.53 vs ~0.22 for others) — useful baseline for the M3 retrieval threshold.
- Legacy Mongolian fonts ("Arial Mon"-style, text like `Çîðèëãî`) are detected per document and decoded
  (cp1251 + ³→ү, °→ө, ¼→ё …) — fixed all 8 F.CSM101 lab PDFs. Details: `docs/file-reading.md` §2b.
- Known limits: scanned PDFs (images) → `no_text` (no OCR); DOCX has no page numbers (citation = file only);
  PPTX not supported yet; background tasks are in-process (fine for one server; a job queue would be needed at scale).

Explanation of how files are read (for the thesis/defense): `docs/file-reading.md`.
Mongolian/English handling, the cross-lingual weak spot and planned improvements: `docs/languages.md`.
What to understand from M2 (study guide + defense questions): `docs/m2-summary.md`.

## M2c — what was built (22 Nov 2026)
- Table `faq_items` (course, category, question, answer, `embedding vector(384)` of the question, source
  import/manual, position). Migration 005.
- FAQ parser (`backend/app/ingest/faq.py`): Word headings → categories; «Асуулт: …» starts a question,
  «Хариулт: …» its answer; an empty «Хариулт:» takes the following lines; otherwise only list items continue an
  answer; a blank line, heading or next question ends it; other text is ignored. The real F.CSM101 FAQ gives
  **85 pairs in 11 categories** (all of them), and the grading notes outside Q/A pairs are not glued on.
- API: `GET/POST/PATCH/DELETE /api/courses/{id}/faq`, `POST .../faq/import` (DOCX; re-import is safe — new
  questions added, changed answers updated, no duplicates; same question = same text ignoring case/spaces).
  Students can read the FAQ; only the course teacher/admin can change it.
- `backend/app/ai/retrieval.py`: `search_faq()` and `search_chunks()` (pgvector cosine) — reused by M3.
  `GET /api/courses/{id}/search?q=` = teacher "test search" page (FAQ + passages with similarity scores).
- Viewer: `/{teacher|student}/courses/{id}/materials/{mid}?page=N` shows the PDF at a page (browser PDF viewer,
  `#page=N`) — citations in M3 will link here. Teachers also see "what the AI read" from that page
  (`GET .../materials/{mid}/chunks?page=N`). On phones, PDFs open in a new tab.
- UI: teacher FAQ page (import, add, edit, delete), test-search page, links from the course page;
  student course page shows the FAQ (grouped, with a filter) and materials open in the viewer.
- Tests: 87 passing. Fake embeddings in tests are now hash-based (same text → same vector), so search is testable.

**First retrieval measurements (real files, real model) — starting point for M3 thresholds:**

| Student question | Best FAQ match | Best passage |
|---|---|---|
| Ирц хэдэн оноотой вэ? (exact FAQ text) | 1.00 ✅ | 0.52 syllabus |
| Ирцэнд хэдэн оноо өгдөг вэ (reworded) | 0.79 ✅ correct | 0.54 |
| Багш нь хэн бэ | 0.90 ✅ «Үндсэн багш хэн бэ?» | 0.68 |
| Шалгалт хэзээ болох вэ | 0.86 ⚠️ «Явцын шалгалт…» (ambiguous: midterm or final?) | 0.52 |
| Палиндром хэлийг CFG-ээр яаж тодорхойлох вэ | 0.49 (no FAQ) | 0.74 ✅ lab2.pdf p.1 |
| Стек санах ой гэж юу вэ | 0.56 (wrong FAQ) | 0.56 Memory Management p.4 |
| Монголын нийслэл хаана вэ (off-topic) | 0.28 | 0.32 |

So: FAQ threshold around **0.75–0.8**; "not in the materials" gate around **0.4–0.45**; ambiguous questions
(«шалгалт») need care — e.g. show the top 2 FAQ answers when their scores are close. Tune in M3/M7.

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
