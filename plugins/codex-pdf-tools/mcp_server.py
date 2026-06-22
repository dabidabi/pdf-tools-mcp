#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from typing import Any, Callable, Dict, Optional

from pdf_tools import (
    PDFToolError,
    delete_pages,
    encrypt_pdf,
    extract_pages,
    inspect_pdf,
    merge_pdfs,
    reorder_pages,
    rotate_pages,
    split_pdf,
)


SERVER_NAME = "codex-pdf-tools"
SERVER_VERSION = "0.1.0"

TOOL_HANDLERS: Dict[str, Callable[..., Dict[str, Any]]] = {
    "pdf_inspect": inspect_pdf,
    "pdf_merge": merge_pdfs,
    "pdf_extract_pages": extract_pages,
    "pdf_delete_pages": delete_pages,
    "pdf_rotate_pages": rotate_pages,
    "pdf_reorder_pages": reorder_pages,
    "pdf_split": split_pdf,
    "pdf_encrypt": encrypt_pdf,
}


def _string_schema(description: str) -> Dict[str, Any]:
    return {"type": "string", "description": description}


def _path_schema(description: str) -> Dict[str, Any]:
    return _string_schema(description)


def _pages_schema(description: str) -> Dict[str, Any]:
    return {
        "type": "array",
        "description": description,
        "items": {"type": "integer", "minimum": 1},
        "minItems": 1,
    }


def tool_definitions() -> list[Dict[str, Any]]:
    return [
        {
            "name": "pdf_inspect",
            "title": "Inspect PDF",
            "description": "Inspect a local PDF. Returns page count, encryption status, metadata, page sizes, and rotations.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "input_path": _path_schema("Path to the PDF file."),
                    "password": _string_schema("Password for encrypted PDFs."),
                },
                "required": ["input_path"],
                "additionalProperties": False,
            },
        },
        {
            "name": "pdf_merge",
            "title": "Merge PDFs",
            "description": "Merge two or more local PDFs into a new output PDF.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "input_paths": {
                        "type": "array",
                        "description": "PDF paths in merge order.",
                        "items": {"type": "string"},
                        "minItems": 2,
                    },
                    "output_path": _path_schema("Output PDF path. Must differ from inputs."),
                    "password": _string_schema("Shared password if all encrypted inputs use the same password."),
                },
                "required": ["input_paths", "output_path"],
                "additionalProperties": False,
            },
        },
        {
            "name": "pdf_extract_pages",
            "title": "Extract Pages",
            "description": "Extract selected 1-based pages from a PDF into a new PDF.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "input_path": _path_schema("Path to the input PDF."),
                    "pages": _pages_schema("1-based page numbers to extract, in output order."),
                    "output_path": _path_schema("Output PDF path. Must differ from the input."),
                    "password": _string_schema("Password for encrypted PDFs."),
                },
                "required": ["input_path", "pages", "output_path"],
                "additionalProperties": False,
            },
        },
        {
            "name": "pdf_delete_pages",
            "title": "Delete Pages",
            "description": "Delete selected 1-based pages from a PDF and write a new PDF.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "input_path": _path_schema("Path to the input PDF."),
                    "pages": _pages_schema("1-based page numbers to delete."),
                    "output_path": _path_schema("Output PDF path. Must differ from the input."),
                    "password": _string_schema("Password for encrypted PDFs."),
                },
                "required": ["input_path", "pages", "output_path"],
                "additionalProperties": False,
            },
        },
        {
            "name": "pdf_rotate_pages",
            "title": "Rotate Pages",
            "description": "Rotate selected 1-based pages and write a new PDF.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "input_path": _path_schema("Path to the input PDF."),
                    "pages": _pages_schema("1-based page numbers to rotate."),
                    "angle": {
                        "type": "integer",
                        "description": "Clockwise rotation angle.",
                        "enum": [90, 180, 270],
                    },
                    "output_path": _path_schema("Output PDF path. Must differ from the input."),
                    "password": _string_schema("Password for encrypted PDFs."),
                },
                "required": ["input_path", "pages", "angle", "output_path"],
                "additionalProperties": False,
            },
        },
        {
            "name": "pdf_reorder_pages",
            "title": "Reorder Pages",
            "description": "Reorder all pages of a PDF. The order array is 1-based and must contain every page exactly once.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "input_path": _path_schema("Path to the input PDF."),
                    "order": _pages_schema("Complete 1-based page order, for example [3, 1, 2]."),
                    "output_path": _path_schema("Output PDF path. Must differ from the input."),
                    "password": _string_schema("Password for encrypted PDFs."),
                },
                "required": ["input_path", "order", "output_path"],
                "additionalProperties": False,
            },
        },
        {
            "name": "pdf_split",
            "title": "Split PDF",
            "description": "Split a PDF into multiple files from 1-based inclusive page ranges.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "input_path": _path_schema("Path to the input PDF."),
                    "ranges": {
                        "type": "array",
                        "description": "1-based inclusive ranges. Use objects like {\"start\": 1, \"end\": 3}.",
                        "items": {
                            "type": "object",
                            "properties": {
                                "start": {"type": "integer", "minimum": 1},
                                "end": {"type": "integer", "minimum": 1},
                            },
                            "required": ["start", "end"],
                            "additionalProperties": False,
                        },
                        "minItems": 1,
                    },
                    "output_dir": _path_schema("Directory for generated files. Defaults to the input PDF directory."),
                    "output_paths": {
                        "type": "array",
                        "description": "Optional explicit output paths, one per range.",
                        "items": {"type": "string"},
                        "minItems": 1,
                    },
                    "prefix": _string_schema("Optional output filename prefix when output_paths is omitted."),
                    "password": _string_schema("Password for encrypted PDFs."),
                },
                "required": ["input_path", "ranges"],
                "additionalProperties": False,
            },
        },
        {
            "name": "pdf_encrypt",
            "title": "Encrypt PDF",
            "description": "Encrypt a PDF with a user password and write a new PDF.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "input_path": _path_schema("Path to the input PDF."),
                    "output_path": _path_schema("Output PDF path. Must differ from the input."),
                    "password": _string_schema("User password for the encrypted output PDF."),
                    "owner_password": _string_schema("Optional owner password. Defaults to password."),
                    "source_password": _string_schema("Password if the input PDF is already encrypted."),
                },
                "required": ["input_path", "output_path", "password"],
                "additionalProperties": False,
            },
        },
    ]


def rpc_response(message_id: Any, result: Any) -> Dict[str, Any]:
    return {"jsonrpc": "2.0", "id": message_id, "result": result}


def rpc_error(message_id: Any, code: int, message: str) -> Dict[str, Any]:
    return {"jsonrpc": "2.0", "id": message_id, "error": {"code": code, "message": message}}


def tool_result(payload: Dict[str, Any], is_error: bool = False) -> Dict[str, Any]:
    return {
        "content": [{"type": "text", "text": json.dumps(payload, ensure_ascii=False)}],
        "structuredContent": payload,
        "isError": is_error,
    }


def tool_error(message: str) -> Dict[str, Any]:
    return tool_result({"ok": False, "error": message}, is_error=True)


def call_tool(name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    handler = TOOL_HANDLERS.get(name)
    if handler is None:
        raise PDFToolError(f"Unknown PDF tool: {name}")
    return handler(**arguments)


def handle_rpc(message: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(message, dict):
        return rpc_error(None, -32600, "Invalid Request")

    message_id = message.get("id")
    method = message.get("method")
    params = message.get("params") if isinstance(message.get("params"), dict) else {}

    if not isinstance(method, str):
        if message_id is None:
            return None
        return rpc_error(message_id, -32600, "Invalid Request")
    if method.startswith("notifications/") or method == "$/cancelRequest":
        return None

    try:
        if method == "initialize":
            return rpc_response(
                message_id,
                {
                    "protocolVersion": params.get("protocolVersion", "2024-11-05"),
                    "capabilities": {"tools": {"listChanged": False}},
                    "serverInfo": {
                        "name": SERVER_NAME,
                        "title": "Codex PDF Tools",
                        "version": SERVER_VERSION,
                        "description": "Lightweight local PDF operations powered by pypdf.",
                    },
                    "instructions": (
                        "Use these tools for local PDF file operations. Page numbers are 1-based. "
                        "Tools always write a new output file and never overwrite the input path."
                    ),
                },
            )
        if method == "ping":
            return rpc_response(message_id, {})
        if method == "tools/list":
            return rpc_response(message_id, {"tools": tool_definitions()})
        if method == "tools/call":
            name = params.get("name")
            arguments = params.get("arguments", {})
            if not isinstance(name, str):
                return rpc_error(message_id, -32602, "tools/call requires a tool name")
            if not isinstance(arguments, dict):
                return rpc_error(message_id, -32602, "tools/call arguments must be an object")
            try:
                return rpc_response(message_id, tool_result(call_tool(name, arguments)))
            except Exception as exc:
                return rpc_response(message_id, tool_error(str(exc)))
        if method == "resources/list":
            return rpc_response(message_id, {"resources": []})
        if method == "resources/templates/list":
            return rpc_response(message_id, {"resourceTemplates": []})
        if method == "prompts/list":
            return rpc_response(message_id, {"prompts": []})
    except Exception as exc:
        return rpc_error(message_id, -32000, str(exc))

    return rpc_error(message_id, -32601, f"Method not found: {method}")


def write_rpc(message: Any) -> None:
    sys.stdout.write(json.dumps(message, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def run_stdio() -> None:
    for line in sys.stdin:
        text = line.strip()
        if not text:
            continue
        try:
            decoded = json.loads(text)
        except json.JSONDecodeError as exc:
            write_rpc(rpc_error(None, -32700, f"Parse error: {exc}"))
            continue

        if isinstance(decoded, list):
            responses = []
            for item in decoded:
                response = handle_rpc(item)
                if response is not None:
                    responses.append(response)
            if responses:
                write_rpc(responses)
            continue

        response = handle_rpc(decoded)
        if response is not None:
            write_rpc(response)


if __name__ == "__main__":
    run_stdio()
