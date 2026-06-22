from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple


class PDFToolError(ValueError):
    pass


def _pypdf():
    try:
        import pypdf
    except ModuleNotFoundError as exc:
        raise PDFToolError(
            "Missing dependency: pypdf. Run `python3 -m pip install -r requirements.txt` "
            "inside the plugin folder, or start the MCP server through scripts/run_mcp.py."
        ) from exc
    return pypdf


def _path(value: str, field: str) -> Path:
    if not isinstance(value, str) or not value.strip():
        raise PDFToolError(f"{field} must be a non-empty file path")
    return Path(value).expanduser().resolve()


def _existing_pdf(value: str, field: str = "input_path") -> Path:
    path = _path(value, field)
    if not path.exists():
        raise PDFToolError(f"{field} does not exist: {path}")
    if not path.is_file():
        raise PDFToolError(f"{field} must be a file: {path}")
    return path


def _prepare_output(value: str, field: str, forbidden_inputs: Iterable[Path]) -> Path:
    path = _path(value, field)
    for source in forbidden_inputs:
        if path == source:
            raise PDFToolError(f"{field} must be different from input path: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def _reader(input_path: Path, password: Optional[str] = None):
    PdfReader = _pypdf().PdfReader
    reader = PdfReader(str(input_path))
    if reader.is_encrypted:
        if not password:
            raise PDFToolError("PDF is encrypted; provide password")
        decrypt_result = reader.decrypt(password)
        if decrypt_result == 0:
            raise PDFToolError("Could not decrypt PDF with the provided password")
    return reader


def _writer():
    return _pypdf().PdfWriter()


def _write_pdf(writer: Any, output_path: Path) -> None:
    with output_path.open("wb") as handle:
        writer.write(handle)


def _metadata(reader: Any) -> Dict[str, str]:
    raw = reader.metadata or {}
    result: Dict[str, str] = {}
    for key, value in raw.items():
        clean_key = str(key).lstrip("/")
        if value is not None:
            result[clean_key] = str(value)
    return result


def _page_count(reader: Any) -> int:
    return len(reader.pages)


def _parse_page_numbers(pages: Sequence[Any], page_count: int, field: str = "pages") -> List[int]:
    if not isinstance(pages, Sequence) or isinstance(pages, (str, bytes)) or not pages:
        raise PDFToolError(f"{field} must be a non-empty array of 1-based page numbers")

    result: List[int] = []
    for page in pages:
        if isinstance(page, bool) or not isinstance(page, int):
            raise PDFToolError(f"{field} must contain integers only")
        if page < 1 or page > page_count:
            raise PDFToolError(f"Page {page} is out of range; PDF has {page_count} pages")
        result.append(page - 1)
    return result


def _parse_ranges(ranges: Sequence[Any], page_count: int) -> List[Tuple[int, int]]:
    if not isinstance(ranges, Sequence) or isinstance(ranges, (str, bytes)) or not ranges:
        raise PDFToolError("ranges must be a non-empty array")

    parsed: List[Tuple[int, int]] = []
    for item in ranges:
        if isinstance(item, dict):
            start = item.get("start")
            end = item.get("end")
        elif isinstance(item, Sequence) and not isinstance(item, (str, bytes)) and len(item) == 2:
            start, end = item
        else:
            raise PDFToolError("Each range must be {start, end} or [start, end]")

        if (
            isinstance(start, bool)
            or isinstance(end, bool)
            or not isinstance(start, int)
            or not isinstance(end, int)
        ):
            raise PDFToolError("Range start and end must be integers")
        if start < 1 or end < 1 or start > page_count or end > page_count:
            raise PDFToolError(f"Range {start}-{end} is out of range; PDF has {page_count} pages")
        if start > end:
            raise PDFToolError(f"Range start must be <= end: {start}-{end}")
        parsed.append((start - 1, end - 1))
    return parsed


def _add_pages(writer: Any, reader: Any, indices: Iterable[int]) -> int:
    count = 0
    for index in indices:
        writer.add_page(reader.pages[index])
        count += 1
    return count


def inspect_pdf(input_path: str, password: Optional[str] = None) -> Dict[str, Any]:
    source = _existing_pdf(input_path)
    PdfReader = _pypdf().PdfReader
    reader = PdfReader(str(source))
    is_encrypted = bool(reader.is_encrypted)

    if is_encrypted and not password:
        return {
            "ok": True,
            "input_path": str(source),
            "is_encrypted": True,
            "requires_password": True,
            "page_count": None,
            "metadata": {},
            "pages": [],
        }

    if is_encrypted:
        decrypt_result = reader.decrypt(password or "")
        if decrypt_result == 0:
            raise PDFToolError("Could not decrypt PDF with the provided password")

    pages = []
    for index, page in enumerate(reader.pages, start=1):
        box = page.mediabox
        pages.append(
            {
                "page": index,
                "width": float(box.width),
                "height": float(box.height),
                "rotation": int(page.get("/Rotate", 0) or 0),
            }
        )

    return {
        "ok": True,
        "input_path": str(source),
        "is_encrypted": is_encrypted,
        "requires_password": False,
        "page_count": len(pages),
        "metadata": _metadata(reader),
        "pages": pages,
    }


def merge_pdfs(
    input_paths: Sequence[str],
    output_path: str,
    password: Optional[str] = None,
) -> Dict[str, Any]:
    if not isinstance(input_paths, Sequence) or isinstance(input_paths, (str, bytes)) or len(input_paths) < 2:
        raise PDFToolError("input_paths must contain at least two PDF paths")

    sources = [_existing_pdf(path, "input_paths") for path in input_paths]
    output = _prepare_output(output_path, "output_path", sources)
    writer = _writer()
    total_pages = 0

    for source in sources:
        reader = _reader(source, password)
        total_pages += _add_pages(writer, reader, range(_page_count(reader)))

    _write_pdf(writer, output)
    return {
        "ok": True,
        "operation": "merge",
        "input_paths": [str(path) for path in sources],
        "output_path": str(output),
        "page_count": total_pages,
    }


def extract_pages(
    input_path: str,
    pages: Sequence[int],
    output_path: str,
    password: Optional[str] = None,
) -> Dict[str, Any]:
    source = _existing_pdf(input_path)
    reader = _reader(source, password)
    indices = _parse_page_numbers(pages, _page_count(reader))
    output = _prepare_output(output_path, "output_path", [source])
    writer = _writer()
    written = _add_pages(writer, reader, indices)
    _write_pdf(writer, output)
    return {
        "ok": True,
        "operation": "extract_pages",
        "input_path": str(source),
        "output_path": str(output),
        "pages": list(pages),
        "page_count": written,
    }


def delete_pages(
    input_path: str,
    pages: Sequence[int],
    output_path: str,
    password: Optional[str] = None,
) -> Dict[str, Any]:
    source = _existing_pdf(input_path)
    reader = _reader(source, password)
    page_count = _page_count(reader)
    delete_indices = set(_parse_page_numbers(pages, page_count))
    if len(delete_indices) >= page_count:
        raise PDFToolError("Cannot delete every page; at least one page must remain")

    output = _prepare_output(output_path, "output_path", [source])
    writer = _writer()
    kept = _add_pages(writer, reader, (index for index in range(page_count) if index not in delete_indices))
    _write_pdf(writer, output)
    return {
        "ok": True,
        "operation": "delete_pages",
        "input_path": str(source),
        "output_path": str(output),
        "deleted_pages": sorted(set(pages)),
        "page_count": kept,
    }


def rotate_pages(
    input_path: str,
    pages: Sequence[int],
    angle: int,
    output_path: str,
    password: Optional[str] = None,
) -> Dict[str, Any]:
    if angle not in (90, 180, 270):
        raise PDFToolError("angle must be one of 90, 180, or 270")

    source = _existing_pdf(input_path)
    reader = _reader(source, password)
    page_count = _page_count(reader)
    rotate_indices = set(_parse_page_numbers(pages, page_count))
    output = _prepare_output(output_path, "output_path", [source])
    writer = _writer()

    for index, page in enumerate(reader.pages):
        if index in rotate_indices:
            page.rotate(angle)
        writer.add_page(page)

    _write_pdf(writer, output)
    return {
        "ok": True,
        "operation": "rotate_pages",
        "input_path": str(source),
        "output_path": str(output),
        "pages": sorted(set(pages)),
        "angle": angle,
        "page_count": page_count,
    }


def reorder_pages(
    input_path: str,
    order: Sequence[int],
    output_path: str,
    password: Optional[str] = None,
) -> Dict[str, Any]:
    source = _existing_pdf(input_path)
    reader = _reader(source, password)
    page_count = _page_count(reader)
    indices = _parse_page_numbers(order, page_count, field="order")
    if len(indices) != page_count or sorted(indices) != list(range(page_count)):
        raise PDFToolError("order must contain every page exactly once")

    output = _prepare_output(output_path, "output_path", [source])
    writer = _writer()
    _add_pages(writer, reader, indices)
    _write_pdf(writer, output)
    return {
        "ok": True,
        "operation": "reorder_pages",
        "input_path": str(source),
        "output_path": str(output),
        "order": list(order),
        "page_count": page_count,
    }


def split_pdf(
    input_path: str,
    ranges: Sequence[Any],
    output_dir: Optional[str] = None,
    output_paths: Optional[Sequence[str]] = None,
    prefix: Optional[str] = None,
    password: Optional[str] = None,
) -> Dict[str, Any]:
    source = _existing_pdf(input_path)
    reader = _reader(source, password)
    parsed_ranges = _parse_ranges(ranges, _page_count(reader))

    if output_paths is not None:
        if not isinstance(output_paths, Sequence) or isinstance(output_paths, (str, bytes)):
            raise PDFToolError("output_paths must be an array of file paths")
        if len(output_paths) != len(parsed_ranges):
            raise PDFToolError("output_paths length must match ranges length")
        outputs = [_prepare_output(path, "output_paths", [source]) for path in output_paths]
    else:
        base_dir = _path(output_dir, "output_dir") if output_dir else source.parent
        base_dir.mkdir(parents=True, exist_ok=True)
        clean_prefix = prefix.strip() if isinstance(prefix, str) and prefix.strip() else source.stem
        outputs = [
            _prepare_output(str(base_dir / f"{clean_prefix}-part-{index}.pdf"), "output_path", [source])
            for index in range(1, len(parsed_ranges) + 1)
        ]

    files = []
    for output, (start, end) in zip(outputs, parsed_ranges):
        writer = _writer()
        written = _add_pages(writer, reader, range(start, end + 1))
        _write_pdf(writer, output)
        files.append(
            {
                "output_path": str(output),
                "start": start + 1,
                "end": end + 1,
                "page_count": written,
            }
        )

    return {
        "ok": True,
        "operation": "split",
        "input_path": str(source),
        "files": files,
    }


def encrypt_pdf(
    input_path: str,
    output_path: str,
    password: str,
    owner_password: Optional[str] = None,
    source_password: Optional[str] = None,
) -> Dict[str, Any]:
    if not isinstance(password, str) or not password:
        raise PDFToolError("password must be a non-empty string")

    source = _existing_pdf(input_path)
    reader = _reader(source, source_password)
    output = _prepare_output(output_path, "output_path", [source])
    writer = _writer()
    page_count = _add_pages(writer, reader, range(_page_count(reader)))

    metadata = _metadata(reader)
    if metadata:
        writer.add_metadata({f"/{key}": value for key, value in metadata.items()})

    writer.encrypt(user_password=password, owner_password=owner_password or password)
    _write_pdf(writer, output)
    return {
        "ok": True,
        "operation": "encrypt",
        "input_path": str(source),
        "output_path": str(output),
        "is_encrypted": True,
        "page_count": page_count,
    }
