import { PDFDocument, degrees } from "pdf-lib";
import type { LocalPdfDocument, OperationResult, PdfOperation, PdfOutput, PdfPageSummary } from "./types";

export async function loadPdfFile(file: File): Promise<LocalPdfDocument> {
  if (file.type && file.type !== "application/pdf") {
    throw new Error(`${file.name} is not a PDF.`);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  return createDocumentFromBytes(file.name, bytes);
}

export async function createDocumentFromBytes(name: string, bytes: Uint8Array): Promise<LocalPdfDocument> {
  const pdf = await loadPdf(bytes);
  const pages: PdfPageSummary[] = pdf.getPages().map((page, index) => {
    const size = page.getSize();
    return {
      page: index + 1,
      width: Math.round(size.width * 100) / 100,
      height: Math.round(size.height * 100) / 100,
      rotation: page.getRotation().angle
    };
  });

  return {
    id: crypto.randomUUID(),
    name,
    bytes,
    pageCount: pages.length,
    pages
  };
}

export async function runPdfOperation(
  operation: PdfOperation,
  activeDocument: LocalPdfDocument,
  documents: LocalPdfDocument[]
): Promise<OperationResult> {
  switch (operation.tool) {
    case "inspect":
      return inspect(activeDocument);
    case "merge":
      return merge(documents);
    case "extract_pages":
      return extractPages(activeDocument, operation.pages);
    case "delete_pages":
      return deletePages(activeDocument, operation.pages);
    case "rotate_pages":
      return rotatePages(activeDocument, operation.pages, operation.angle);
    case "reorder_pages":
      return reorderPages(activeDocument, operation.order);
    case "split":
      return splitPdf(activeDocument, operation.ranges);
    case "unsupported":
      throw new Error(operation.reason);
    default:
      assertNever(operation);
  }
}

function inspect(document: LocalPdfDocument): OperationResult {
  const rotations = Array.from(new Set(document.pages.map((page) => page.rotation))).join(", ");
  const firstPage = document.pages[0];
  return {
    message: `${document.name} · ${document.pageCount} pages · ${formatSize(firstPage.width, firstPage.height)} · ${rotations || 0}°`,
    outputs: []
  };
}

async function merge(documents: LocalPdfDocument[]): Promise<OperationResult> {
  if (documents.length < 2) {
    throw new Error("Add at least 2 PDFs.");
  }

  const output = await PDFDocument.create();
  let total = 0;
  for (const document of documents) {
    const source = await loadPdf(document.bytes);
    const copied = await output.copyPages(source, source.getPageIndices());
    copied.forEach((page) => output.addPage(page));
    total += copied.length;
  }

  const name = uniqueOutputName("merged.pdf");
  const pdf = await makeOutput(name, await output.save(), "merge");
  return {
    message: `Merged ${documents.length} PDFs · ${total} pages`,
    outputs: [pdf]
  };
}

async function extractPages(document: LocalPdfDocument, pages: number[]): Promise<OperationResult> {
  const source = await loadPdf(document.bytes);
  const indices = normalizePages(pages, document.pageCount);
  const output = await PDFDocument.create();
  const copied = await output.copyPages(source, indices.map((page) => page - 1));
  copied.forEach((page) => output.addPage(page));

  const name = uniqueOutputName(withSuffix(document.name, "extracted"));
  return {
    message: `Extracted ${pagesLabel(indices)}`,
    outputs: [await makeOutput(name, await output.save(), "extract_pages")]
  };
}

async function deletePages(document: LocalPdfDocument, pages: number[]): Promise<OperationResult> {
  const source = await loadPdf(document.bytes);
  const deleteSet = new Set(normalizePages(pages, document.pageCount));
  if (deleteSet.size >= document.pageCount) {
    throw new Error("Keep at least 1 page.");
  }

  const keepIndices = source.getPageIndices().filter((index) => !deleteSet.has(index + 1));
  const output = await PDFDocument.create();
  const copied = await output.copyPages(source, keepIndices);
  copied.forEach((page) => output.addPage(page));

  const name = uniqueOutputName(withSuffix(document.name, "deleted"));
  return {
    message: `Deleted ${pagesLabel(Array.from(deleteSet))} · ${keepIndices.length} left`,
    outputs: [await makeOutput(name, await output.save(), "delete_pages")]
  };
}

async function rotatePages(
  document: LocalPdfDocument,
  pages: number[],
  angle: 90 | 180 | 270
): Promise<OperationResult> {
  const source = await loadPdf(document.bytes);
  const rotateSet = new Set(normalizePages(pages, document.pageCount));
  const output = await PDFDocument.create();
  const copied = await output.copyPages(source, source.getPageIndices());
  copied.forEach((page, index) => {
    if (rotateSet.has(index + 1)) {
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + angle) % 360));
    }
    output.addPage(page);
  });

  const name = uniqueOutputName(withSuffix(document.name, "rotated"));
  return {
    message: `Rotated ${pagesLabel(Array.from(rotateSet))} · ${angle}°`,
    outputs: [await makeOutput(name, await output.save(), "rotate_pages")]
  };
}

async function reorderPages(document: LocalPdfDocument, order: number[]): Promise<OperationResult> {
  const source = await loadPdf(document.bytes);
  const normalized = normalizePages(order, document.pageCount);
  if (normalized.length !== document.pageCount || new Set(normalized).size !== document.pageCount) {
    throw new Error("Use every page once.");
  }

  const output = await PDFDocument.create();
  const copied = await output.copyPages(source, normalized.map((page) => page - 1));
  copied.forEach((page) => output.addPage(page));

  const name = uniqueOutputName(withSuffix(document.name, "reordered"));
  return {
    message: `Reordered · ${normalized.join(", ")}`,
    outputs: [await makeOutput(name, await output.save(), "reorder_pages")]
  };
}

async function splitPdf(document: LocalPdfDocument, ranges: { start: number; end: number }[]): Promise<OperationResult> {
  const source = await loadPdf(document.bytes);
  const outputs: PdfOutput[] = [];

  for (const [index, range] of ranges.entries()) {
    if (range.start < 1 || range.end < range.start || range.end > document.pageCount) {
      throw new Error(`Range ${range.start}-${range.end} is out of bounds.`);
    }
    const output = await PDFDocument.create();
    const pageIndices = Array.from({ length: range.end - range.start + 1 }, (_, offset) => range.start - 1 + offset);
    const copied = await output.copyPages(source, pageIndices);
    copied.forEach((page) => output.addPage(page));
    outputs.push(
      await makeOutput(
        uniqueOutputName(withSuffix(document.name, `part-${index + 1}-${range.start}-${range.end}`)),
        await output.save(),
        "split"
      )
    );
  }

  return {
    message: `Split into ${outputs.length} PDFs`,
    outputs
  };
}

function normalizePages(pages: number[], pageCount: number): number[] {
  const unique = Array.from(new Set(pages));
  for (const page of unique) {
    if (!Number.isInteger(page) || page < 1 || page > pageCount) {
      throw new Error(`Page ${page} is out of bounds. This PDF has ${pageCount} pages.`);
    }
  }
  return unique;
}

async function loadPdf(bytes: Uint8Array): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes);
  } catch (error) {
    throw new Error(`Could not read this PDF. Encrypted PDFs are not supported yet.${error instanceof Error ? ` ${error.message}` : ""}`);
  }
}

async function makeOutput(
  name: string,
  bytes: Uint8Array,
  operation: Exclude<PdfOutput["operation"], "inspect" | "unsupported">
): Promise<PdfOutput> {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([buffer], { type: "application/pdf" });
  return {
    id: crypto.randomUUID(),
    name,
    bytes,
    blob,
    operation
  };
}

function formatSize(width: number, height: number): string {
  return `${Math.round(width)} x ${Math.round(height)}`;
}

function pagesLabel(pages: number[]): string {
  return `p. ${[...pages].sort((a, b) => a - b).join(", ")}`;
}

function withSuffix(name: string, suffix: string): string {
  const base = name.replace(/\.pdf$/i, "");
  return `${base}-${suffix}.pdf`;
}

function uniqueOutputName(name: string): string {
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
  return name.replace(/\.pdf$/i, `-${stamp}.pdf`);
}

function assertNever(value: never): never {
  throw new Error(`Unsupported operation: ${JSON.stringify(value)}`);
}
