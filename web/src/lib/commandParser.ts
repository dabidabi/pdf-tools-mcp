import type { LocalPdfDocument, PageRange, PdfOperation } from "./types";

const CHINESE_DIGITS: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9
};

export function parseLocalCommand(input: string, documents: LocalPdfDocument[]): PdfOperation | null {
  const pageCount = documents[0]?.pageCount ?? 0;
  const text = normalize(input);
  if (!text || pageCount < 1) return null;

  if (/(检查|查看|信息|页数|inspect|info|metadata)/i.test(text)) {
    return { tool: "inspect" };
  }

  if (/(合并|merge|combine)/i.test(text)) {
    if (documents.length < 2) {
      return { tool: "unsupported", reason: "需要至少上传两个 PDF 才能合并。" };
    }
    return { tool: "merge" };
  }

  const rotation = extractRotation(text);
  if (rotation && /(旋转|转向|rotate)/i.test(text)) {
    const withoutAngle = text.replace(/\b(90|180|270)\b/g, " ");
    const pages = extractPages(withoutAngle, pageCount);
    return pages.length > 0
      ? { tool: "rotate_pages", pages, angle: rotation }
      : { tool: "unsupported", reason: "没有识别到要旋转的页面。" };
  }

  if (/(删除|移除|去掉|delete|remove)/i.test(text)) {
    const pages = extractPages(text, pageCount);
    return pages.length > 0
      ? { tool: "delete_pages", pages }
      : { tool: "unsupported", reason: "没有识别到要删除的页面。" };
  }

  if (/(提取|抽取|导出|保留|extract|export|keep)/i.test(text)) {
    const pages = extractPages(text, pageCount);
    return pages.length > 0
      ? { tool: "extract_pages", pages }
      : { tool: "unsupported", reason: "没有识别到要提取的页面。" };
  }

  if (/(拆分|分割|split)/i.test(text)) {
    const ranges = extractRanges(text, pageCount);
    return ranges.length > 0
      ? { tool: "split", ranges }
      : { tool: "unsupported", reason: "没有识别到拆分范围。" };
  }

  if (/(重排|重新排序|顺序|reorder|order)/i.test(text)) {
    const order = extractOrderedNumbers(text, pageCount);
    if (order.length === pageCount && isCompletePageSet(order, pageCount)) {
      return { tool: "reorder_pages", order };
    }
    return { tool: "unsupported", reason: "重排页面需要给出完整页码顺序。" };
  }

  return null;
}

export function extractPages(input: string, pageCount: number): number[] {
  const text = normalize(input);
  if (/(全部|所有|all pages|every page|all)/i.test(text)) {
    return range(1, pageCount);
  }

  const values = new Set<number>();
  const ranges = extractRanges(text, pageCount);
  for (const item of ranges) {
    for (const page of range(item.start, item.end)) values.add(page);
  }

  const rangeNumbers = new Set<number>();
  for (const item of ranges) {
    rangeNumbers.add(item.start);
    rangeNumbers.add(item.end);
  }

  const numberPattern = /(?:第\s*)?(\d{1,4})\s*(?:页|page|pages|p)?/gi;
  for (const match of text.matchAll(numberPattern)) {
    const value = Number(match[1]);
    if (value >= 1 && value <= pageCount) values.add(value);
  }

  return Array.from(values).sort((a, b) => a - b);
}

export function extractRanges(input: string, pageCount: number): PageRange[] {
  const text = normalize(input);
  const ranges: PageRange[] = [];
  const seen = new Set<string>();
  const patterns = [
    /(\d{1,4})\s*(?:-|~|至|到)\s*(\d{1,4})/g,
    /from\s+(\d{1,4})\s+to\s+(\d{1,4})/gi,
    /pages?\s+(\d{1,4})\s+through\s+(\d{1,4})/gi
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const start = Number(match[1]);
      const end = Number(match[2]);
      if (start < 1 || end < start || end > pageCount) continue;
      const key = `${start}:${end}`;
      if (!seen.has(key)) {
        ranges.push({ start, end });
        seen.add(key);
      }
    }
  }

  return ranges;
}

function extractRotation(input: string): 90 | 180 | 270 | null {
  const match = normalize(input).match(/\b(90|180|270)\b/);
  if (!match) return null;
  const angle = Number(match[1]);
  return angle === 90 || angle === 180 || angle === 270 ? angle : null;
}

function extractOrderedNumbers(input: string, pageCount: number): number[] {
  const text = normalize(input);
  const numbers = Array.from(text.matchAll(/\d{1,4}/g))
    .map((match) => Number(match[0]))
    .filter((value) => value >= 1 && value <= pageCount);
  return numbers;
}

function normalize(input: string): string {
  return replaceChineseNumbers(input)
    .replace(/[，、；;]/g, ",")
    .replace(/[（）]/g, " ")
    .trim();
}

function replaceChineseNumbers(input: string): string {
  return input.replace(/[零一二两三四五六七八九十]{1,3}/g, (value) => {
    const parsed = parseChineseNumber(value);
    return parsed === null ? value : String(parsed);
  });
}

function parseChineseNumber(value: string): number | null {
  if (value === "十") return 10;
  if (!value.includes("十")) return CHINESE_DIGITS[value] ?? null;
  const [head, tail] = value.split("十");
  const tens = head ? CHINESE_DIGITS[head] : 1;
  const ones = tail ? CHINESE_DIGITS[tail] : 0;
  if (tens === undefined || ones === undefined) return null;
  return tens * 10 + ones;
}

function isCompletePageSet(order: number[], pageCount: number): boolean {
  const sorted = [...order].sort((a, b) => a - b);
  return sorted.every((value, index) => value === index + 1) && sorted.length === pageCount;
}

function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}
