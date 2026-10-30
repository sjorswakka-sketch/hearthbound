"""Build an offline, page-complete search library from the official CC-BY SRDs.

Requires Python 3 and pypdf. Normal app/Windows startup uses the generated JSON,
so testers do not need Python. Run with --download only to retrieve the pinned
official source files again. Original PDFs are never rewritten.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import unicodedata
import urllib.request

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / "public" / "rules"
LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/legalcode"
BOOKS = [
    {
        "id": "srd-5.1", "title": "System Reference Document 5.1",
        "edition": "D&D 2014 / 5e", "expectedPages": 403,
        "source": "https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf",
        "attribution": "This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.",
    },
    {
        "id": "srd-5.2.1", "title": "System Reference Document 5.2.1",
        "edition": "D&D 2024 / 5.5e", "expectedPages": 364,
        "source": "https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf",
        "attribution": "This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.",
    },
]


def normalize_text(text: str) -> str:
    # pypdf's extraction of the 5.1 PDF contains tab/CR separators between words.
    # Preserve page boundaries, all text, and line breaks. Do not guess table
    # columns or reconstruct prose; the original PDF is the layout authority.
    text = unicodedata.normalize("NFKC", text).replace("\r", "").replace("\t", " ")
    return "\n".join(re.sub(r"[^\S\n]+", " ", line).strip() for line in text.split("\n")).strip()


def outlines(reader: PdfReader) -> list[dict]:
    result = []
    def walk(items, depth=0):
        for item in items:
            if isinstance(item, list):
                walk(item, depth + 1)
                continue
            try:
                page = reader.get_destination_page_number(item) + 1
                title = normalize_text(str(item.title)).replace("_", " ")
                if 1 <= page <= len(reader.pages) and title:
                    result.append({"title": title, "page": page, "depth": depth})
            except (AttributeError, TypeError, ValueError):
                continue
    walk(reader.outline)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--download", action="store_true")
    args = parser.parse_args()
    DESTINATION.mkdir(parents=True, exist_ok=True)
    manifest = []
    for book in BOOKS:
        path = DESTINATION / f"{book['id']}.pdf"
        if args.download:
            request = urllib.request.Request(book["source"], headers={"User-Agent": "Hearthbound SRD importer"})
            with urllib.request.urlopen(request, timeout=90) as response:
                content = response.read()
            if not content.startswith(b"%PDF-"):
                raise ValueError(f"Official source did not return a PDF: {book['id']}")
            path.write_bytes(content)
        content = path.read_bytes()
        reader = PdfReader(path)
        if len(reader.pages) != book["expectedPages"]:
            raise ValueError(f"Unexpected page count for {book['id']}; verify the official version before replacing the library")
        pages = [{"page": index + 1, "text": normalize_text(page.extract_text() or "")} for index, page in enumerate(reader.pages)]
        if any(not page["text"] for page in pages):
            raise ValueError(f"Text extraction left an empty page in {book['id']}")
        metadata = {
            "id": book["id"], "title": book["title"], "edition": book["edition"],
            "source": book["source"], "sourcePage": "https://www.dndbeyond.com/srd",
            "pdf": f"/rules/{book['id']}.pdf", "json": f"/rules/{book['id']}.json",
            "license": "CC-BY-4.0", "licenseUrl": LICENSE_URL,
            "attribution": book["attribution"], "pageCount": len(pages),
            "sha256": hashlib.sha256(content).hexdigest(), "pdfBytes": len(content),
            "textCharacters": sum(len(page["text"]) for page in pages),
            "coverage": "Complete official SRD reference; engine automation is tracked separately.",
            "extractionNotes": "Text extracted using pypdf with Unicode compatibility normalization and whitespace cleanup. All PDF pages are included. Columns, tables, line-wrap hyphens, and display capitalization may differ in extracted text; use the original PDF for exact layout and wording. Original PDF bytes are unchanged.",
        }
        output = {**metadata, "contents": outlines(reader), "pages": pages}
        (DESTINATION / f"{book['id']}.json").write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        manifest.append(metadata)
        print(f"{book['id']}: {len(pages)} complete pages, {metadata['textCharacters']:,} text characters")
    (DESTINATION / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
