<p align="left">
  <a href="./README.md">中文</a>
  |
  <a href="./README.en.md"><strong>English</strong></a>
</p>

# PDF Tools MCP

PDF Tools MCP is a lightweight local PDF tool server that exposes common PDF operations through MCP for Claude Code, Codex, and other MCP-compatible AI coding agents.

It focuses on common, stable page-level PDF operations without a heavy GUI and without being tied to one AI client.

## Features

- `pdf_inspect`: inspect page count, encryption status, metadata, page sizes, and rotations
- `pdf_merge`: merge multiple PDFs
- `pdf_extract_pages`: extract selected pages
- `pdf_delete_pages`: delete selected pages
- `pdf_rotate_pages`: rotate pages
- `pdf_reorder_pages`: reorder pages
- `pdf_split`: split a PDF by page ranges
- `pdf_encrypt`: create an encrypted PDF

All page arguments are 1-based, so page 1 is passed as `1`.

## Installation

### Claude Code

```bash
git clone https://github.com/dabidabi/pdf-tools-mcp.git ~/.pdf-tools-mcp && claude mcp add --scope user pdf-tools-mcp -- python3 "$HOME/.pdf-tools-mcp/plugins/pdf-tools-mcp/scripts/run_mcp.py"
```

### Codex

```bash
codex plugin marketplace add dabidabi/pdf-tools-mcp --ref main && codex plugin add pdf-tools-mcp@pdf-tools-mcp-marketplace
```

## Direct Smoke Test

```bash
cd plugins/pdf-tools-mcp && printf '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}\n' | python3 scripts/run_mcp.py
```

## Repository Layout

```text
.agents/plugins/marketplace.json
plugins/pdf-tools-mcp/
```
