<a id="中文"></a>

<p align="left">
  <a href="#中文"><strong>中文</strong></a>
  |
  <a href="#english">English</a>
</p>

# PDF Tools MCP

轻量级本地 PDF 操作工具，作为 stdio MCP server 暴露给 AI 编程助手。

## 工具

- `pdf_inspect`: 页数、加密状态、元数据、页面尺寸和旋转角度
- `pdf_merge`: 合并多个 PDF
- `pdf_extract_pages`: 提取指定页面
- `pdf_delete_pages`: 删除指定页面
- `pdf_rotate_pages`: 按 90、180 或 270 度旋转页面
- `pdf_reorder_pages`: 重排所有页面
- `pdf_split`: 按 1-based 闭区间页码范围拆分 PDF
- `pdf_encrypt`: 写出加密副本

所有工具都会写入新的输出文件，并拒绝把 `output_path` 设置成输入文件路径。

## 安装

### Claude Code

```bash
claude mcp add --scope user pdf-tools-mcp -- python3 "/absolute/path/to/plugins/pdf-tools-mcp/scripts/run_mcp.py"
```

## 本地测试

```bash
python3 -m venv .venv && . .venv/bin/activate && python -m pip install -r requirements.txt && python -m unittest discover -s tests
```

## MCP 测试

```bash
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}\n{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}\n' | python3 scripts/run_mcp.py
```

---

<a id="english"></a>

<p align="left">
  <a href="#中文">中文</a>
  |
  <a href="#english"><strong>English</strong></a>
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
