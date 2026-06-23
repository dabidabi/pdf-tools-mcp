<p align="right">
  <a href="./README.md"><img alt="中文" src="https://img.shields.io/badge/%E8%AF%AD%E8%A8%80-%E4%B8%AD%E6%96%87-d1d5db?style=for-the-badge"></a>
  <a href="./README.en.md"><img alt="English" src="https://img.shields.io/badge/Language-English-2563eb?style=for-the-badge"></a>
</p>

# PDF Tools MCP

PDF Tools MCP is a lightweight local PDF tool server. It exposes common PDF operations through MCP for Claude Code, Codex, and other MCP-compatible AI coding agents.

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
git clone https://github.com/dabidabi/pdf-tools-mcp.git
cd pdf-tools-mcp
claude mcp add --scope user pdf-tools-mcp -- python3 "$PWD/plugins/pdf-tools-mcp/scripts/run_mcp.py"
```

On first run, the launcher creates a local `.venv` inside the plugin directory and installs `pypdf`.

### Codex

```bash
codex plugin marketplace add dabidabi/pdf-tools-mcp --ref main
codex plugin add pdf-tools-mcp@pdf-tools-mcp-marketplace
```

After installation, start a new Codex thread so the tools are reloaded.

## Direct Smoke Test

```bash
cd plugins/pdf-tools-mcp
printf '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}\n' | python3 scripts/run_mcp.py
```

## Repository Layout

```text
.agents/plugins/marketplace.json
plugins/pdf-tools-mcp/
```
