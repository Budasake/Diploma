# Languages: how the system handles Mongolian and English

*Written 22 Nov 2026 (after M2b). For the thesis and the defense.*

**Short answer: yes, both work.** Proof from the real F.CSM101 files: the 574-page textbook is English, and the
syllabus, FAQ and grading document are Mongolian; all of them were read correctly. "Reading" has two separate
parts, though, and they behave a bit differently.

## 1. Getting the text out: any language

`pypdf` and `python-docx` don't care about language. They copy out the characters using the **Unicode**
standard, which covers Cyrillic, Latin and almost every other script. So Mongolian, English, Russian, or a mix on
the same page (like the syllabus: «ХИЧЭЭЛИЙН ХӨТӨЛБӨР /COURSE SYLLABUS/») all come out fine.

The one Mongolian-specific problem was **old fonts** (text like `Çîðèëãî`), which is now fixed automatically —
see `docs/file-reading.md`, section 2b.

## 2. Understanding the meaning: multilingual, with one weak spot

The embedding model, `paraphrase-multilingual-MiniLM-L12-v2`, was trained on 50+ languages, including Mongolian
and English. Measured results:

| Question vs. text | Works? | Example score |
|---|---|---|
| Mongolian question → Mongolian text | ✅ Good | 0.56 for the relevant text vs about 0 for unrelated |
| English question → English text | ✅ Good | the model's strongest language |
| **Mongolian question → English text** | ⚠️ **Weak** | only 0.27 ("Өгөгдлийн сан гэж юу вэ?" vs "A database is…") |

**Why the weak spot matters:** the F.CSM101 lectures are in Mongolian, but the textbook is in English. When a
student asks in Mongolian, the system will mostly find the **Mongolian lectures** and may miss a good answer that
exists only in the English textbook.

## 3. How to improve it (planned, not built yet)

- **Hybrid search (M3):** add keyword search next to vector search. It helps with terms written the same in both
  languages (`CFG`, `LL(1)`, `lambda`). PostgreSQL's trigram search (`pg_trgm`) also copes with Mongolian word
  endings (өгөгдөл / өгөгдлийн / өгөгдлөөс) without a Mongolian grammar tool.
- **Translate the question (M3):** when a course has English materials, also search with an English version of the
  question — or let Gemini do it only when the Mongolian search finds nothing.
- **Letter normalization:** map Latin look-alikes and other "ө/ү" characters (`o`→`о`, `Y`→`Ү`, `ѳ`/`ö`→`ө`)
  and apply Unicode NFC, to both materials and questions, so the same word always matches.
- **OCR for scanned PDFs (optional):** Tesseract with the Mongolian (`mon`) language pack first, Gemini vision
  only as a fallback — the same "cheap first, AI last" rule as the answer router.
- **A stronger model (M7):** compare models such as `multilingual-e5-large` or `bge-m3` on ~50 real student
  questions, especially Mongolian question → English text. Choose by measurement, not reputation — there is
  little published testing on Mongolian.

The traditional vertical Mongolian script (ᠮᠣᠩᠭᠣᠯ) is out of scope: all course materials are in Cyrillic.

## For the thesis

> "Text extraction is language-independent (Unicode). Semantic search uses a multilingual embedding model, which
> works well within Mongolian and within English; cross-lingual retrieval (Mongolian question, English source) is
> weaker and is addressed with hybrid search and evaluated in the experiments chapter."

Pointing out this weakness yourself, and measuring it, makes the thesis stronger than claiming everything works
perfectly.
