<p align="right">
  <a href="./README.md"><img alt="中文" src="https://img.shields.io/badge/%E8%AF%AD%E8%A8%80-%E4%B8%AD%E6%96%87-2563eb?style=for-the-badge"></a>
  <a href="./README.en.md"><img alt="English" src="https://img.shields.io/badge/Language-English-d1d5db?style=for-the-badge"></a>
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

## 本地测试

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
python -m unittest discover -s tests
```

## MCP 测试

```bash
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}\n{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}\n' \
  | python3 scripts/run_mcp.py
```

## Claude Code

```bash
claude mcp add --scope user pdf-tools-mcp -- python3 "/absolute/path/to/plugins/pdf-tools-mcp/scripts/run_mcp.py"
```

建议使用绝对路径，这样 Claude Code 可以从任意工作目录启动 MCP server。
