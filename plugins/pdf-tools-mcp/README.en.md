<p align="left">
  <a href="./README.md">中文</a>
  |
  <a href="./README.en.md"><strong>English</strong></a>
</p>

# PDF Tools MCP

Lightweight local PDF operations exposed as a stdio MCP server for AI coding agents.

## Tools

- `pdf_inspect`: page count, encryption status, metadata, page sizes, rotations
- `pdf_merge`: merge multiple PDFs
- `pdf_extract_pages`: extract selected 1-based pages
- `pdf_delete_pages`: delete selected 1-based pages
- `pdf_rotate_pages`: rotate selected pages by 90, 180, or 270 degrees
- `pdf_reorder_pages`: reorder all pages
- `pdf_split`: split by 1-based inclusive page ranges
- `pdf_encrypt`: write an encrypted copy

All tools write new output files and reject an `output_path` that is the same as the input path.

## Installation

### Claude Code

```bash
claude mcp add --scope user pdf-tools-mcp -- python3 "/absolute/path/to/plugins/pdf-tools-mcp/scripts/run_mcp.py"
```

## Local Test

```bash
python3 -m venv .venv && . .venv/bin/activate && python -m pip install -r requirements.txt && python -m unittest discover -s tests
```

## MCP Smoke Test

```bash
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}\n{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}\n' | python3 scripts/run_mcp.py
```
