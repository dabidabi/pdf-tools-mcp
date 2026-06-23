# Publishing And Install Test

这个仓库同时支持两种使用方式：

This repository supports two usage modes:

- Codex plugin marketplace
- Direct stdio MCP server for Claude Code and other MCP clients

## Repository Layout

```text
.agents/plugins/marketplace.json
plugins/pdf-tools-mcp/
```

## Publish

```bash
git add .
git commit -m "Rename project to PDF Tools MCP"
gh repo rename pdf-tools-mcp --yes
git push
```

## Codex Install Test

```bash
codex plugin marketplace add dabidabi/pdf-tools-mcp --ref main
codex plugin add pdf-tools-mcp@pdf-tools-mcp-marketplace
```

Then start a new Codex thread so the plugin tools are loaded.

## Claude Code Install Test

```bash
git clone https://github.com/dabidabi/pdf-tools-mcp.git
cd pdf-tools-mcp
claude mcp add --scope user pdf-tools-mcp -- python3 "$PWD/plugins/pdf-tools-mcp/scripts/run_mcp.py"
```

## Smoke Test Prompt

```text
Inspect /absolute/path/to/file.pdf with PDF Tools MCP.
使用 PDF Tools MCP 检查 /absolute/path/to/file.pdf。
```
