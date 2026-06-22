from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader, PdfWriter

from pdf_tools import delete_pages, extract_pages, inspect_pdf, merge_pdfs, reorder_pages, rotate_pages, split_pdf


def make_pdf(path: Path, pages: int) -> None:
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=200, height=300)
    with path.open("wb") as handle:
        writer.write(handle)


class PDFToolsTests(unittest.TestCase):
    def test_page_operations(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "source.pdf"
            make_pdf(source, 4)

            info = inspect_pdf(str(source))
            self.assertEqual(info["page_count"], 4)
            self.assertFalse(info["is_encrypted"])

            extracted = root / "extracted.pdf"
            extract_pages(str(source), [2, 4], str(extracted))
            self.assertEqual(len(PdfReader(str(extracted)).pages), 2)

            deleted = root / "deleted.pdf"
            delete_pages(str(source), [1, 3], str(deleted))
            self.assertEqual(len(PdfReader(str(deleted)).pages), 2)

            rotated = root / "rotated.pdf"
            rotate_pages(str(source), [1], 90, str(rotated))
            self.assertEqual(int(PdfReader(str(rotated)).pages[0].get("/Rotate", 0)), 90)

            reordered = root / "reordered.pdf"
            reorder_pages(str(source), [4, 3, 2, 1], str(reordered))
            self.assertEqual(len(PdfReader(str(reordered)).pages), 4)

    def test_merge_and_split(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            a = root / "a.pdf"
            b = root / "b.pdf"
            make_pdf(a, 2)
            make_pdf(b, 3)

            merged = root / "merged.pdf"
            merge_pdfs([str(a), str(b)], str(merged))
            self.assertEqual(len(PdfReader(str(merged)).pages), 5)

            result = split_pdf(
                str(merged),
                [{"start": 1, "end": 2}, {"start": 3, "end": 5}],
                output_dir=str(root / "parts"),
                prefix="merged",
            )
            self.assertEqual([item["page_count"] for item in result["files"]], [2, 3])


if __name__ == "__main__":
    unittest.main()
