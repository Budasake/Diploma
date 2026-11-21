"""Unit tests for reading files and cutting text into chunks."""

import pytest

from app.ingest.chunking import CHUNK_SIZE, MIN_CHUNK_CHARS, chunk_pages, split_text
from app.ingest.parse import Page, clean_text, parse_docx, parse_pdf
from tests.sample_files import make_docx, make_pdf

# ---------- parsing ----------


def test_pdf_text_is_read_per_page(tmp_path):
    path = tmp_path / "lecture.pdf"
    path.write_bytes(make_pdf(["Variables store values", "", "Loops repeat code"]))

    pages = parse_pdf(path)

    assert [p.number for p in pages] == [1, 2, 3]
    assert pages[0].text == "Variables store values"
    assert pages[1].text == ""
    assert pages[2].text == "Loops repeat code"


def test_docx_paragraphs_and_tables_are_read(tmp_path):
    path = tmp_path / "notes.docx"
    path.write_bytes(
        make_docx(["Хувьсагч гэж юу вэ?", "Утга хадгалах нэр."], table=[["int", "бүхэл тоо"]])
    )

    [page] = parse_docx(path)

    assert page.number is None
    assert "Хувьсагч гэж юу вэ?" in page.text
    assert "int | бүхэл тоо" in page.text


def test_clean_text_squeezes_spaces_and_empty_lines():
    assert clean_text("a  \t b\n\n\n\nc\x00") == "a b\n\nc"


# ---------- chunking ----------


def test_short_text_is_one_chunk():
    assert split_text("Энэ бол богино догол мөр юм.") == ["Энэ бол богино догол мөр юм."]


def test_tiny_text_is_skipped():
    assert split_text("12") == []


def test_long_text_is_split_with_overlap_and_size_limit():
    sentences = [f"Өгүүлбэр дугаар {i} энд байна." for i in range(80)]
    text = " ".join(sentences)

    chunks = split_text(text)

    assert len(chunks) > 1
    assert all(MIN_CHUNK_CHARS <= len(c) <= CHUNK_SIZE for c in chunks)
    # Each chunk ends where a sentence ends (we prefer to cut at ". ").
    assert all(c.endswith(".") for c in chunks[:-1])
    # Neighbouring chunks share some text (the overlap).
    assert chunks[1].split(".")[0] in chunks[0]
    # Nothing is lost: every sentence appears in some chunk.
    assert all(any(s in c for c in chunks) for s in sentences)


def test_chunks_keep_their_page_number():
    pages = [Page(1, "Нэгдүгээр хуудасны текст энд байна."), Page(2, ""), Page(3, "Гурав " * 200)]

    chunks = chunk_pages(pages)

    assert chunks[0].page == 1
    assert {c.page for c in chunks[1:]} == {3}


# ---------- the real embedding model ----------


@pytest.mark.real_embeddings
def test_real_embeddings_match_meaning():
    from app.ai.embeddings import embed_texts

    question, relevant, unrelated = embed_texts(
        [
            "Өгөгдлийн сан гэж юу вэ?",
            "Өгөгдлийн сан нь зохион байгуулалттай мэдээллийн цуглуулга юм.",
            "Улаанбаатар хотод өнөөдөр цас орсон.",
        ]
    )

    def cosine(a, b):
        dot = sum(x * y for x, y in zip(a, b, strict=True))
        return dot / (sum(x * x for x in a) ** 0.5 * sum(y * y for y in b) ** 0.5)

    assert len(question) == 384
    assert cosine(question, relevant) > cosine(question, unrelated) + 0.2
