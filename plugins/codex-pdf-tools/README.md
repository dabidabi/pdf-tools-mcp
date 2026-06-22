# Codex PDF Tools

Lightweight local PDF tools for Codex. The plugin exposes a small stdio MCP server and uses
`pypdf` for page-level PDF operations.

## Tools

- `pdf_inspect`: page count, encryption status, metadata, page sizes, rotations
- `pdf_merge`: merge multiple PDFs
- `pdf_extract_pages`: extract selected 1-based pages
- `pdf_delete_pages`: delete selected 1-based pages
- `pdf_rotate_pages`: rotate selected pages by 90, 180, or 270 degrees
- `pdf_reorder_pages`: reorder all pages
- `pdf_split`: split by 1-based inclusive page ranges
- `pdf_encrypt`: write an encrypted copy

All tools write new output files. They reject an `output_path` that is the same as the input path.
Page numbers passed to tools are 1-based.

## Local Test

```bash
cd codex-pdf-tools
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
python -m unittest discover -s tests
```

## MCP Smoke Test

```bash
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}\n{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}\n' \
  | python3 scripts/run_mcp.py
```
