import { describe, expect, it } from "vitest";
import { parseLocalCommand } from "./commandParser";
import type { LocalPdfDocument } from "./types";

const docs: LocalPdfDocument[] = [
  {
    id: "a",
    name: "demo.pdf",
    bytes: new Uint8Array(),
    pageCount: 8,
    pages: []
  }
];

describe("parseLocalCommand", () => {
  it("parses Chinese delete commands", () => {
    expect(parseLocalCommand("删除第2页和第5页", docs)).toEqual({
      tool: "delete_pages",
      pages: [2, 5]
    });
  });

  it("parses extraction ranges", () => {
    expect(parseLocalCommand("提取 1-3 页", docs)).toEqual({
      tool: "extract_pages",
      pages: [1, 2, 3]
    });
  });

  it("parses rotate commands", () => {
    expect(parseLocalCommand("把第 4 页旋转 90 度", docs)).toEqual({
      tool: "rotate_pages",
      pages: [4],
      angle: 90
    });
  });

  it("parses split ranges", () => {
    expect(parseLocalCommand("拆分 1-2, 3-5", docs)).toEqual({
      tool: "split",
      ranges: [
        { start: 1, end: 2 },
        { start: 3, end: 5 }
      ]
    });
  });
});
