# PDF Tools MCP

轻量级本地 PDF 操作工具，作为 stdio MCP server 暴露给 AI 编程助手。

Lightweight local PDF operations exposed as a stdio MCP server for AI coding agents.

## 工具 / Tools

- `pdf_inspect`: page count, encryption status, metadata, page sizes, rotations
- `pdf_merge`: merge multiple PDFs
- `pdf_extract_pages`: extract selected 1-based pages
- `pdf_delete_pages`: delete selected 1-based pages
- `pdf_rotate_pages`: rotate selected pages by 90, 180, or 270 degrees
- `pdf_reorder_pages`: reorder all pages
- `pdf_split`: split by 1-based inclusive page ranges
- `pdf_encrypt`: write an encrypted copy

所有工具都会写入新的输出文件，并拒绝把 `output_path` 设置成输入文件路径。

All tools write new output files and reject an `output_path` that is the same as the input path.

## 本地测试 / Local Test

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
python -m unittest discover -s tests
```

## MCP 测试 / MCP Smoke Test

```bash
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}\n{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}\n' \
  | python3 scripts/run_mcp.py
```

## Claude Code

```bash
claude mcp add pdf-tools-mcp -- python3 "/absolute/path/to/plugins/pdf-tools-mcp/scripts/run_mcp.py"
```

Use an absolute path so Claude Code can start the server from any working directory.
