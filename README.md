<a id="中文"></a>

<p align="left">
  <a href="#中文"><strong>中文</strong></a>
  |
  <a href="#english">English</a>
</p>

# PDF Tools MCP

PDF Tools MCP 是一个轻量级本地 PDF 工具服务器，通过 MCP 暴露常用 PDF 操作，适合 Claude Code、Codex 以及其他支持 MCP 的 AI 编程助手调用。

它专注于最常见、最稳定的 PDF 页级操作，不做厚重 GUI，也不绑定某一个 AI 客户端。

## 功能

- `pdf_inspect`: 查看页数、加密状态、元数据、页面尺寸和旋转角度
- `pdf_merge`: 合并多个 PDF
- `pdf_extract_pages`: 提取指定页面
- `pdf_delete_pages`: 删除指定页面
- `pdf_rotate_pages`: 旋转页面
- `pdf_reorder_pages`: 重排页面
- `pdf_split`: 按页码范围拆分 PDF
- `pdf_encrypt`: 生成加密 PDF

所有页码参数都使用 1-based 页码，也就是第 1 页传 `1`。

## 网页体验

[打开网页体验](https://pdf-tools-web-9ik.pages.dev)。这个仓库也包含一个 Cloudflare Pages 版网页 demo，代码在 `web/`。

- PDF 预览和处理全部在浏览器本地完成
- 后端只负责把自然语言指令解析成 JSON 操作
- 匿名用户每天最多 10 次免费 AI 解析
- 部署前只需要在 Cloudflare 配置 Workers AI 和 KV binding

## 安装

### Claude Code

```bash
git clone https://github.com/dabidabi/pdf-tools-mcp.git ~/.pdf-tools-mcp && claude mcp add --transport stdio --scope user pdf-tools-mcp -- python3 "$HOME/.pdf-tools-mcp/plugins/pdf-tools-mcp/scripts/run_mcp.py"
```

### Codex

```bash
codex plugin marketplace add dabidabi/pdf-tools-mcp --ref main && codex plugin add pdf-tools-mcp@pdf-tools-mcp-marketplace
```

## 直接测试

```bash
cd plugins/pdf-tools-mcp && printf '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}\n' | python3 scripts/run_mcp.py
```

## 项目结构

```text
.agents/plugins/marketplace.json
plugins/pdf-tools-mcp/
```

---

<a id="english"></a>

<p align="left">
  <a href="#中文">中文</a>
  |
  <a href="#english"><strong>English</strong></a>
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

## Web Demo

[Open the web demo](https://pdf-tools-web-9ik.pages.dev). This repo also includes a Cloudflare Pages web demo in `web/`.

- PDF preview and edits run locally in the browser
- The backend only parses natural language commands into JSON operations
- Anonymous visitors get 10 free AI parses per day
- Deployment only needs Cloudflare Workers AI and KV bindings

## Installation

### Claude Code

```bash
git clone https://github.com/dabidabi/pdf-tools-mcp.git ~/.pdf-tools-mcp && claude mcp add --transport stdio --scope user pdf-tools-mcp -- python3 "$HOME/.pdf-tools-mcp/plugins/pdf-tools-mcp/scripts/run_mcp.py"
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
