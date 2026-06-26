export type PdfToolName =
  | "inspect"
  | "merge"
  | "extract_pages"
  | "delete_pages"
  | "rotate_pages"
  | "reorder_pages"
  | "split"
  | "unsupported";

export type PageRange = {
  start: number;
  end: number;
};

export type PdfOperation =
  | { tool: "inspect"; reason?: string }
  | { tool: "merge"; reason?: string }
  | { tool: "extract_pages"; pages: number[]; reason?: string }
  | { tool: "delete_pages"; pages: number[]; reason?: string }
  | { tool: "rotate_pages"; pages: number[]; angle: 90 | 180 | 270; reason?: string }
  | { tool: "reorder_pages"; order: number[]; reason?: string }
  | { tool: "split"; ranges: PageRange[]; reason?: string }
  | { tool: "unsupported"; reason: string };

export type PdfPageSummary = {
  page: number;
  width: number;
  height: number;
  rotation: number;
};

export type LocalPdfDocument = {
  id: string;
  name: string;
  bytes: Uint8Array;
  pageCount: number;
  pages: PdfPageSummary[];
};

export type PdfOutput = {
  id: string;
  name: string;
  bytes: Uint8Array;
  blob: Blob;
  operation: Exclude<PdfToolName, "inspect" | "unsupported">;
};

export type OperationResult = {
  message: string;
  outputs: PdfOutput[];
};

export type ParseSource = "local" | "ai" | "ai-cache";

export type ParsedCommand = {
  operation: PdfOperation;
  source: ParseSource;
  remaining?: number;
  limit?: number;
};

export type ChatAttachment =
  | {
      type: "pdf";
      documentId: string;
      name: string;
      pageCount: number;
    }
  | {
      type: "result";
      documentId: string;
      outputId: string;
      name: string;
      pageCount: number;
    };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  attachments?: ChatAttachment[];
  variant?: "error";
};

export type ApiParseResponse =
  | {
      ok: true;
      operation: PdfOperation;
      source: "ai" | "ai-cache";
      remaining: number;
      limit: number;
    }
  | {
      ok: false;
      error: string;
      code?: string;
      remaining?: number;
      limit?: number;
    };
