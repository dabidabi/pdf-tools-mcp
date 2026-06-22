# Publishing And Install Test

This folder is intended to be pushed as its own GitHub repository.

## Repository Layout

```text
.agents/plugins/marketplace.json
plugins/codex-pdf-tools/
```

## Publish

```bash
cd codex-pdf-tools-marketplace
git init
git add .
git commit -m "Initial Codex PDF tools marketplace"
git branch -M main
git remote add origin https://github.com/OWNER/REPO.git
git push -u origin main
```

## Simulate A User Install

In a clean Codex environment:

```bash
codex plugin marketplace add OWNER/REPO --ref main
codex plugin add codex-pdf-tools@codex-pdf-tools-marketplace
```

Then start a new Codex thread so the plugin tools are loaded.

## Smoke Test Prompt

```text
Use the Codex PDF Tools plugin to inspect /absolute/path/to/file.pdf.
```
