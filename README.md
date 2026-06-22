# Codex PDF Tools Marketplace

This repository is a Codex plugin marketplace containing one lightweight plugin:

- `codex-pdf-tools`: local PDF inspection and page-level operations powered by `pypdf`

## Install From GitHub

After this repository is pushed to GitHub, users can install it with:

```bash
codex plugin marketplace add owner/repo --ref main
codex plugin add codex-pdf-tools@codex-pdf-tools-marketplace
```

Replace `owner/repo` with the GitHub repository name.

## Try The MCP Server Directly

```bash
cd plugins/codex-pdf-tools
python3 scripts/run_mcp.py
```

The first run creates a local virtual environment and installs `pypdf`.
