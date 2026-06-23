# PDF Tools MCP

轻量级 PDF 工具 MCP 服务器，可供 Codex、Claude Code 以及其他支持 MCP 的 AI 编程助手调用。

A lightweight PDF tools MCP server for Codex, Claude Code, and other MCP-compatible AI coding agents.

## 功能 / Features

- `pdf_inspect`: 查看页数、加密状态、元数据、页面尺寸和旋转角度
- `pdf_merge`: 合并多个 PDF
- `pdf_extract_pages`: 提取指定页面
- `pdf_delete_pages`: 删除指定页面
- `pdf_rotate_pages`: 旋转页面
- `pdf_reorder_pages`: 重排页面
- `pdf_split`: 按页码范围拆分 PDF
- `pdf_encrypt`: 生成加密 PDF

所有页码参数都使用 1-based 页码，也就是第 1 页传 `1`。

All page arguments are 1-based, so page 1 is passed as `1`.

## Codex 安装 / Codex Install

```bash
codex plugin marketplace add dabidabi/pdf-tools-mcp --ref main
codex plugin add pdf-tools-mcp@pdf-tools-mcp-marketplace
```

安装后请新开一个 Codex 线程，让插件工具重新加载。

After installation, start a new Codex thread so the plugin tools are loaded.

## Claude Code 使用 / Claude Code Usage

Claude Code 不使用 Codex marketplace 外壳，但可以直接连接这个仓库里的 stdio MCP server。

Claude Code does not use the Codex marketplace wrapper, but it can connect directly to the stdio MCP server in this repository.

```bash
git clone https://github.com/dabidabi/pdf-tools-mcp.git
cd pdf-tools-mcp
claude mcp add --scope user pdf-tools-mcp -- python3 "$PWD/plugins/pdf-tools-mcp/scripts/run_mcp.py"
```

第一次运行时，启动脚本会在插件目录下创建本地 `.venv` 并安装 `pypdf`。

On first run, the launcher creates a local `.venv` inside the plugin directory and installs `pypdf`.

## 直接测试 / Direct Smoke Test

```bash
cd plugins/pdf-tools-mcp
printf '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}\n' | python3 scripts/run_mcp.py
```

## 项目结构 / Repository Layout

```text
.agents/plugins/marketplace.json
plugins/pdf-tools-mcp/
```
