<p align="left">
  <a href="./README.md"><strong>中文</strong></a>
  |
  <a href="./README.en.md">English</a>
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

## 安装

### Claude Code

```bash
git clone https://github.com/dabidabi/pdf-tools-mcp.git ~/.pdf-tools-mcp && claude mcp add --scope user pdf-tools-mcp -- python3 "$HOME/.pdf-tools-mcp/plugins/pdf-tools-mcp/scripts/run_mcp.py"
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
