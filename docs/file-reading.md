# How the system reads uploaded files (PDF, DOCX)

*Written 22 Nov 2026 (milestone M2b). For the thesis and the defense.*

Short answer: the code currently reads **PDF and DOCX**. PPTX is not supported yet (see section 6).

All reading code is in one short file: `backend/app/ingest/parse.py`.

## The big picture

Reading is step 1 of a 4-step ingestion pipeline (`backend/app/ingest/pipeline.py`):

```
File on disk → ① READ text (parse.py) → ② CUT into pieces (chunking.py)
             → ③ EMBED into vectors (embeddings.py) → ④ SAVE in database (chunks table)
```

Whatever the file type, step 1 always produces the same thing — **a list of pages, each with a number and its text**:

```python
@dataclass
class Page:
    number: int | None   # page 1, 2, 3 … (None for DOCX)
    text: str
```

Why pages? So the AI can later say *"this answer comes from lecture5.pdf, page 12"*. The page number is what
makes a citation possible.

## 1. How a PDF is read

**What a PDF is inside:** not really a text document — it is a set of *drawing instructions* for each page,
like *"use font F1, size 12, go to position (72, 720), draw the letters 'Hello'"*. Getting the text out means
collecting the letters from those instructions, page by page.

**The code** (library `pypdf`):

```python
def parse_pdf(path):
    reader = PdfReader(path)                 # open the PDF
    return [
        Page(number=i, text=clean_text(page.extract_text() or ""))
        for i, page in enumerate(reader.pages, start=1)   # each page, numbered from 1
    ]
```

1. `PdfReader` opens the file.
2. Loop over every page.
3. `extract_text()` collects the letters drawn on that page.
4. `clean_text()` tidies the result (section 3).

**What PDFs can't do:**

- **Scanned PDFs** are photos of paper — no letters, only pixels. The system marks them **"no_text"**.
  (Reading them would need OCR — optical character recognition — not built.)
- **Old fonts (fixed automatically):** some documents were typed with old Mongolian fonts (e.g. "Arial Mon")
  that draw Cyrillic letters but store them under Latin-1 codes. The text then comes out as `Çîðèëãî` instead
  of «Зорилго». See section 2b.

## 2. How a DOCX is read

**What a DOCX is inside:** a **ZIP file**. Rename `notes.docx` to `notes.zip` and you can open it — inside,
`word/document.xml` holds the text as structured XML (paragraphs, tables, …).

**The code** (library `python-docx`):

```python
def parse_docx(path):
    doc = Document(str(path))
    parts = [p.text for p in doc.paragraphs]          # 1. every paragraph
    for table in doc.tables:                           # 2. every table, row by row
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if cells:
                parts.append(" | ".join(cells))        #    e.g. "Оноо | 10"
    return [Page(number=None, text=clean_text("\n".join(parts)))]
```

1. Read every paragraph.
2. Read every table, joining each row's cells with `|` (lecture handouts often use tables).
3. Return it all as **one "page" with number `None`**.

**Why no page numbers?** A DOCX doesn't store pages. Word works out the page breaks only when it draws the
document on screen, and they change with paper size, font, and so on. So a DOCX citation names only the file.

## 2b. Fixing old Mongolian fonts

All 8 lab PDFs of F.CSM101 came out garbled: `Çîðèëãî: Èíòåðïðåòàòîðûí ³íäñèéã îéëãîõ`.
The garbling follows a fixed pattern, so it can be reversed:

- Letters А…я are stored as À…ÿ, exactly as in the old Windows Cyrillic code page **cp1251**.
- A few letters that cp1251 doesn't have are stored in odd places:

| Stored as | Real letter |
|---|---|
| `³` | ү |
| `\x93` | Ү |
| `°` | ө |
| `\x90` | Ө |
| `¼` | ё |
| `\x88` | • (bullet) |

**How the code decides** (`looks_like_legacy_mongolian` in `parse.py`): a document is treated as garbled only
when there are at least 20 À…ÿ letters, they make up more than 40% of all Latin letters, and there is almost no
real Cyrillic. Normal English has none of these letters, and French or German use only a few, so they are never
touched. The decision is made for the **whole document**, so a short page (only a title, say) is fixed too.

**How it converts** (`decode_legacy_mongolian`): each À…ÿ character is decoded with cp1251; the 6 special
characters use the table above; everything else (digits, English words like "C++", punctuation) stays as it is.

**Result on the real files:** all 8 labs fixed with no garbled characters left; the 19 lectures, the 574-page
English textbook and the other documents were left unchanged. Searching lab2 with
«Палиндром хэлийг CFG ашиглан хэрхэн тодорхойлох вэ?» gave a similarity of **0.52 before the fix and 0.76 after**.

## 3. Cleaning the text: `clean_text()`

Text taken out of files is messy, so one shared function tidies it:

```python
text = text.replace("\x00", "").replace("­", "")   # remove invisible junk characters
text = re.sub(r"[ \t ​]+", " ", text)         # many spaces/tabs → one space
lines = [line.strip() for line in text.splitlines()]    # trim each line
text = re.sub(r"\n{3,}", "\n\n", text)                   # at most one empty line in a row
```

Example: `"a   \t b\n\n\n\nc"` → `"a b\n\nc"`.

## 4. Choosing the reader: `parse_file()`

```python
def parse_file(path, file_type):
    if file_type == "pdf":  return parse_pdf(path)
    if file_type == "docx": return parse_docx(path)
    raise ValueError("unsupported file type")
```

The only entry point. Supporting a new format means writing one more `parse_xxx()` function and adding one line here.

## 5. Security checks before reading

These happen at upload (`backend/app/api/materials.py`). The system never trusts the file name alone; it checks
the **first bytes** of the file (its "magic number"):

| Type | Every real file starts with |
|---|---|
| PDF | `%PDF-` |
| DOCX | `PK` (the ZIP signature) |

So a virus renamed to `lecture.pdf` is rejected. Also rejected: files over 50 MB, empty files, and the same file
uploaded twice (checked with a SHA-256 fingerprint).

## 6. PPTX — how it would work (not built yet)

A PPTX is also a ZIP of XML, like a DOCX. The `python-pptx` library could read the text boxes on each slide, and
**each slide would become a "page"**, so citations would say *"slide 7"*. That is one new `parse_pptx()` function
plus the magic-number check. Teachers often lecture from slides, so this is a good "future work" item.

## 7. Test on the real course materials (F.CSM101, 31 files)

| Group | Files | Result |
|---|---|---|
| Lectures | 19 | Mongolian, clean text; 15–146 pages each, about 1,700 chunks |
| Syllabus, grading document | 2 | Mongolian, clean |
| `F_CSM101_QAQ.docx` | 1 | Mongolian, clean; "Асуулт: … / Хариулт: …" format, ready for the FAQ import (M2c) |
| Textbook (574 pages) | 1 | English, clean; 3,089 chunks, read in about 6 s |
| Labs | 8 | Old Mongolian font → garbled text; **fixed automatically** (section 2b) |

## How to say it in the defense (one paragraph)

> "Uploaded files go through a four-step ingestion pipeline. First, the parser extracts text page by page: PDFs
> with *pypdf*, which collects the characters drawn on each page, and DOCX files with *python-docx*, which reads
> paragraphs and tables from the document's XML. Keeping page numbers lets every answer cite its source. The text
> is then normalized, split into ~600-character overlapping chunks, converted into 384-dimensional semantic
> vectors by a local multilingual model, and stored in PostgreSQL with pgvector. Files are validated by their
> binary signature rather than by name, scanned PDFs without a text layer are detected and flagged instead of
> silently failing, and text typed with legacy Mongolian fonts is detected and converted back to proper Cyrillic."
