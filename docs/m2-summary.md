# M2 summary: what to understand

*Written 22 Nov 2026, after M2a (courses), M2b (materials) and M2c (FAQ + viewer). For the thesis and the defense.*

M2 builds everything the AI chat (M3) will use.

## The big picture: what M2 prepares for M3

```
Teacher's side (M2)                         Student's side (M3)
──────────────────                          ───────────────────
Course + join code   ── who can ask ──►     Student asks a question
FAQ (85 Q&A)         ── step 2 ──────►      Router: FAQ match?
Materials → chunks   ── steps 4-5 ───►      Router: find passages → Gemini
Viewer ?page=N       ── citations ───►      "lab2.pdf, page 3" link
```

**One sentence:** M2 turns the teacher's files into a searchable knowledge base; M3 answers questions from it.

## 1. Courses and access (M2a)

- **What:** a teacher creates a course and gets a 6-character **join code**; students enter it to join.
- **Why it matters:** each course is a separate knowledge base. A student only gets answers from courses they've joined.
- **Know:**
  - Join codes skip look-alike characters (no 0/O or 1/I/L), so they're easy to type.
  - Outsiders get **404, not 403**, so they can't even tell a course exists.
- **Tables:** `courses` and `enrollments` (the student ↔ course link).

## 2. Ingestion: from a file to searchable pieces (M2b — the most important part)

```
Upload → check → save to disk → [background] read → cut → embed → save to `chunks`
```

| Step | Key idea | Why |
|---|---|---|
| **Check** | Files are checked by their first bytes (`%PDF-`, `PK`), not by the name | A renamed virus is rejected |
| **Background** | The teacher gets an answer immediately (202); the work happens afterwards | The page never freezes |
| **Read** | Text is read page by page | Page numbers make citations possible |
| **Old-font fix** | `Çîðèëãî` → «Зорилго» (cp1251) | The lab PDFs were unreadable without it (search score 0.52 → 0.76) |
| **Cut (chunk)** | About 600 characters each, with 100 characters of overlap | Small enough to match one question; the overlap stops an answer being split |
| **Embed** | Text → 384 numbers that represent its meaning (local model) | Search by meaning; free; student text stays private |
| **Save** | `chunks` table with pgvector and an HNSW index | Fast "nearest meaning" search |

**Status flow** (shown to the teacher): `processing → ready`, or `no_text` (a scan with no text layer), or
`failed` (then the teacher clicks reprocess).

Details: `docs/file-reading.md`, `docs/languages.md`.

## 3. Vector search: how "finding by meaning" works (M2c)

- **The question becomes a vector**, and pgvector finds the closest stored vectors.
- **Cosine similarity:** 1.0 means the same meaning; about 0 means unrelated.
- **Real numbers from F.CSM101:**
  - the same question reworded: **0.79–0.90**
  - a related lecture passage: **0.5–0.75**
  - off-topic: **about 0.3**
- **Why it matters:** these numbers decide the router's thresholds in M3 — e.g. FAQ match ≥ 0.8, and below 0.4 →
  "not in the materials". The full measurement table is in `docs/PLAN.md` (M2c section).
- **Where:** `backend/app/ai/retrieval.py`; the teacher's **test search** page shows it live.

## 4. The FAQ (M2c)

- **What:** the teacher's own approved answers, imported from Word («Асуулт: … / Хариулт: …»).
- **Why it matters:** this is step 2 of the router. A matching question gets **the teacher's answer, with no LLM
  call** — the thesis contribution in action.
- **Know:**
  - The *question* is embedded, so «Ирцэнд хэдэн оноо өгдөг вэ» finds «Ирц хэдэн оноотой вэ?».
  - Importing again is safe: answers are updated, never duplicated.
  - **The weakness:** ambiguous questions like «Шалгалт хэзээ» (midterm or final?).

## 5. The viewer and citations (M2c)

- **What:** `…/materials/11?page=3` opens the PDF at page 3. The browser's own PDF viewer understands `#page=3`.
- **Why it matters:** in M3, every answer will say *"lab2.pdf, page 3"* and link here. **The citation is built by
  code from the chunk's page number, so the AI can't invent it.**
- **Teacher extra:** the "what the AI read" panel shows the extracted text for each page — how a teacher checks quality.

## The M2 tables, and how they connect

```
users ─┬─< courses (teacher) ─┬─< enrollments >─ users (students)
       │                      ├─< materials ─< chunks   (text + vector + page)
       │                      └─< faq_items             (Q + A + vector)
```

Deleting a course removes everything under it, including the files on disk.

## Defense questions to practise

1. "What happens when a teacher uploads a file?" → walk through the pipeline in section 2.
2. "Why do you cut files into chunks?" → specific enough to match one question, and each has a page number for citations.
3. "How does the computer know two sentences mean the same thing?" → embeddings + cosine similarity.
4. "How do you make sure citations are correct?" → built from chunk metadata (file + page), never written by the AI.
5. "Why do you need a FAQ if you have AI?" → cheaper, faster, and approved by the teacher.
6. "What problems did you find with real data?" → old Mongolian fonts, scanned PDFs, ambiguous questions, weak
   Mongolian → English matching.

## How to check your understanding (hands-on)

1. Upload a lecture as a teacher, open it in the viewer, and compare the PDF page with "what the AI read".
2. On the **test search** page, try three questions: one from the FAQ, one about a lecture topic, one off-topic.
   Look at the scores.
3. Explain the scores out loud: why one is 0.9 and another 0.3.

If you can do step 3 confidently, you understand M2.
