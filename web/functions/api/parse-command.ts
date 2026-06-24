import type { PdfOperation } from "../../src/lib/types";

type WorkersAI = {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
};

type Env = {
  AI?: WorkersAI;
  PDF_TOOLS_QUOTA?: KVNamespace;
  PDF_TOOLS_DAILY_LIMIT?: string;
  PDF_TOOLS_MODEL?: string;
  PDF_TOOLS_FALLBACK_MODEL?: string;
};

type IncomingDocument = {
  id?: string;
  name?: string;
  pageCount?: number;
  pages?: Array<{ page: number; width: number; height: number; rotation: number }>;
};

type IncomingBody = {
  message?: string;
  documents?: IncomingDocument[];
};

const DEFAULT_LIMIT = 10;
const DEFAULT_MODEL = "@cf/ibm-granite/granite-4.0-h-micro";
const DEFAULT_FALLBACK_MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";
const COOKIE_NAME = "pdf_tools_visitor";
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 14;

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: corsHeaders() });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const visitor = getOrCreateVisitor(request);
  const headers = responseHeaders(visitor.setCookie);

  if (!env.PDF_TOOLS_QUOTA) {
    return json(
      {
        ok: false,
        code: "missing_quota_binding",
        error: "Cloudflare KV binding PDF_TOOLS_QUOTA 尚未配置。"
      },
      503,
      headers
    );
  }

  const body = await readBody(request);
  if (!body.ok) return json(body.response, 400, headers);

  const message = body.value.message?.trim() ?? "";
  const documents = Array.isArray(body.value.documents) ? body.value.documents : [];
  if (!message) {
    return json({ ok: false, code: "missing_message", error: "缺少文本指令。" }, 400, headers);
  }
  if (documents.length < 1 || !Number.isInteger(documents[0].pageCount) || Number(documents[0].pageCount) < 1) {
    return json({ ok: false, code: "missing_pdf_context", error: "缺少 PDF 页数信息。" }, 400, headers);
  }

  const limit = parseLimit(env.PDF_TOOLS_DAILY_LIMIT);
  const quotaKeys = await getQuotaKeys(request, visitor.id);
  const usage = await readUsage(env.PDF_TOOLS_QUOTA, quotaKeys);
  if (usage.current >= limit) {
    return json(
      {
        ok: false,
        code: "daily_limit_reached",
        error: "今天的免费 AI 解析次数已用完。",
        remaining: 0,
        limit
      },
      429,
      headers
    );
  }

  const cacheKey = `parse-cache:${await sha256(JSON.stringify({ message, documents: documentFacts(documents) }))}`;
  const cached = await env.PDF_TOOLS_QUOTA.get<PdfOperation>(cacheKey, "json");
  if (cached) {
    return json(
      {
        ok: true,
        operation: cached,
        source: "ai-cache",
        remaining: Math.max(0, limit - usage.current),
        limit
      },
      200,
      headers
    );
  }

  if (!env.AI) {
    return json(
      {
        ok: false,
        code: "missing_ai_binding",
        error: "Cloudflare Workers AI binding AI 尚未配置。"
      },
      503,
      headers
    );
  }

  const reservedCount = usage.current + 1;
  await writeUsage(env.PDF_TOOLS_QUOTA, quotaKeys, reservedCount);
  const remaining = Math.max(0, limit - reservedCount);

  try {
    const operation = await parseWithAi(env.AI, message, documents, {
      model: env.PDF_TOOLS_MODEL || DEFAULT_MODEL,
      fallbackModel: env.PDF_TOOLS_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL
    });
    await env.PDF_TOOLS_QUOTA.put(cacheKey, JSON.stringify(operation), {
      expirationTtl: CACHE_TTL_SECONDS
    });

    return json(
      {
        ok: true,
        operation,
        source: "ai",
        remaining,
        limit
      },
      200,
      headers
    );
  } catch (error) {
    return json(
      {
        ok: false,
        code: "ai_parse_failed",
        error: error instanceof Error ? error.message : "AI 解析失败。",
        remaining,
        limit
      },
      502,
      headers
    );
  }
};

async function parseWithAi(
  ai: WorkersAI,
  message: string,
  documents: IncomingDocument[],
  options: { model: string; fallbackModel: string }
): Promise<PdfOperation> {
  const models = Array.from(new Set([options.model, options.fallbackModel].filter(Boolean)));
  let lastError: unknown = null;
  for (const model of models) {
    try {
      const raw = await ai.run(model, {
        messages: [
          {
            role: "system",
            content: systemPrompt()
          },
          {
            role: "user",
            content: JSON.stringify({
              message,
              documents: documentFacts(documents),
              currentDocument: documentFacts(documents)[0]
            })
          }
        ],
        temperature: 0,
        max_tokens: 500
      });
      return normalizeOperation(extractJson(raw), documents);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("模型没有返回可用 JSON。");
}

function systemPrompt(): string {
  return [
    "You convert natural language PDF editing commands into strict JSON.",
    "The PDF bytes are never available. Use only the provided page count and document names.",
    "Return exactly one JSON object. No markdown. No prose.",
    "Supported tools:",
    '{"tool":"inspect"}',
    '{"tool":"merge"}',
    '{"tool":"extract_pages","pages":[1,2]}',
    '{"tool":"delete_pages","pages":[2]}',
    '{"tool":"rotate_pages","pages":[1],"angle":90}',
    '{"tool":"reorder_pages","order":[3,1,2]}',
    '{"tool":"split","ranges":[{"start":1,"end":3}]}',
    '{"tool":"unsupported","reason":"short reason"}',
    "Rules:",
    "Pages are 1-based.",
    "Do not invent page numbers outside the current document pageCount.",
    "For 'last page', use pageCount.",
    "For 'all pages', use every page number from 1 to pageCount.",
    "If the user asks to summarize, OCR, translate, compress, sign, redact, edit text, or encrypt, return unsupported.",
    "For delete_pages, never delete every page."
  ].join("\n");
}

function normalizeOperation(value: unknown, documents: IncomingDocument[]): PdfOperation {
  if (!isRecord(value)) throw new Error("AI 返回的不是 JSON object。");
  const rawTool = String(value.tool ?? value.operation ?? "").replace(/^pdf_/, "");
  const pageCount = Number(documents[0]?.pageCount ?? 0);

  if (rawTool === "inspect") return { tool: "inspect" };
  if (rawTool === "merge") {
    return documents.length >= 2 ? { tool: "merge" } : { tool: "unsupported", reason: "需要至少两个 PDF 才能合并。" };
  }
  if (rawTool === "extract_pages") {
    return { tool: "extract_pages", pages: normalizePages(value.pages, pageCount) };
  }
  if (rawTool === "delete_pages") {
    const pages = normalizePages(value.pages, pageCount);
    if (new Set(pages).size >= pageCount) return { tool: "unsupported", reason: "不能删除所有页面。" };
    return { tool: "delete_pages", pages };
  }
  if (rawTool === "rotate_pages") {
    const angle = Number(value.angle);
    if (angle !== 90 && angle !== 180 && angle !== 270) throw new Error("旋转角度必须是 90、180 或 270。");
    return { tool: "rotate_pages", pages: normalizePages(value.pages, pageCount), angle };
  }
  if (rawTool === "reorder_pages") {
    const order = normalizePages(value.order, pageCount);
    if (order.length !== pageCount || new Set(order).size !== pageCount) {
      throw new Error("重排页面必须包含每一页且不能重复。");
    }
    return { tool: "reorder_pages", order };
  }
  if (rawTool === "split") {
    return { tool: "split", ranges: normalizeRanges(value.ranges, pageCount) };
  }
  if (rawTool === "unsupported") {
    return { tool: "unsupported", reason: String(value.reason || "暂不支持这个操作。") };
  }

  return { tool: "unsupported", reason: "暂不支持这个操作。" };
}

function normalizePages(value: unknown, pageCount: number): number[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error("缺少页码。");
  const pages = Array.from(new Set(value.map((item) => Number(item))));
  for (const page of pages) {
    if (!Number.isInteger(page) || page < 1 || page > pageCount) {
      throw new Error(`页码 ${page} 超出范围，当前 PDF 共 ${pageCount} 页。`);
    }
  }
  return pages;
}

function normalizeRanges(value: unknown, pageCount: number): Array<{ start: number; end: number }> {
  if (!Array.isArray(value) || value.length === 0) throw new Error("缺少拆分范围。");
  return value.map((item) => {
    if (!isRecord(item)) throw new Error("拆分范围格式错误。");
    const start = Number(item.start);
    const end = Number(item.end);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > pageCount) {
      throw new Error(`拆分范围 ${start}-${end} 超出范围，当前 PDF 共 ${pageCount} 页。`);
    }
    return { start, end };
  });
}

function extractJson(raw: unknown): unknown {
  if (isRecord(raw) && isRecord(raw.response) && isRecord(raw.response.tool_calls)) {
    return raw.response;
  }
  if (isRecord(raw) && isRecord(raw.tool)) return raw;

  const text = extractText(raw);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("模型没有返回 JSON。");
  }
  return JSON.parse(text.slice(start, end + 1));
}

function extractText(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (!isRecord(raw)) return "";
  const candidates = [raw.response, raw.result, raw.text, raw.content];
  for (const candidate of candidates) {
    if (typeof candidate === "string") return candidate;
  }
  if (Array.isArray(raw.choices) && raw.choices[0]) {
    const choice = raw.choices[0] as unknown;
    if (isRecord(choice)) {
      if (typeof choice.text === "string") return choice.text;
      if (isRecord(choice.message) && typeof choice.message.content === "string") return choice.message.content;
    }
  }
  return JSON.stringify(raw);
}

async function readBody(request: Request): Promise<{ ok: true; value: IncomingBody } | { ok: false; response: unknown }> {
  try {
    return { ok: true, value: (await request.json()) as IncomingBody };
  } catch {
    return {
      ok: false,
      response: { ok: false, code: "invalid_json", error: "请求体不是有效 JSON。" }
    };
  }
}

async function getQuotaKeys(request: Request, visitorId: string): Promise<string[]> {
  const today = new Date().toISOString().slice(0, 10);
  const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for") || "local";
  const userAgent = request.headers.get("user-agent") || "unknown";
  const visitorHash = await sha256(visitorId);
  const networkHash = await sha256(`${ip}|${userAgent.slice(0, 120)}`);
  return [`quota:${today}:visitor:${visitorHash}`, `quota:${today}:network:${networkHash}`];
}

async function readUsage(kv: KVNamespace, keys: string[]): Promise<{ current: number }> {
  const values = await Promise.all(keys.map((key) => kv.get(key)));
  const current = Math.max(0, ...values.map((value) => Number(value || 0)).filter((value) => Number.isFinite(value)));
  return { current };
}

async function writeUsage(kv: KVNamespace, keys: string[], value: number): Promise<void> {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 2);
  await Promise.all(keys.map((key) => kv.put(key, String(value), { expiration: Math.floor(tomorrow.getTime() / 1000) })));
}

function documentFacts(documents: IncomingDocument[]) {
  return documents.map((document) => ({
    id: String(document.id || ""),
    name: String(document.name || "PDF"),
    pageCount: Number(document.pageCount || 0),
    pages: Array.isArray(document.pages)
      ? document.pages.map((page) => ({
          page: page.page,
          width: page.width,
          height: page.height,
          rotation: page.rotation
        }))
      : []
  }));
}

function getOrCreateVisitor(request: Request): { id: string; setCookie?: string } {
  const cookie = request.headers.get("cookie") || "";
  const existing = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.split("=")[1];

  if (existing && /^[a-zA-Z0-9-]{16,80}$/.test(existing)) {
    return { id: existing };
  }

  const id = crypto.randomUUID();
  return {
    id,
    setCookie: `${COOKIE_NAME}=${id}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`
  };
}

async function sha256(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function parseLimit(value: string | undefined): number {
  const parsed = Number(value || DEFAULT_LIMIT);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_LIMIT;
}

function json(value: unknown, status: number, headers: HeadersInit): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers
  });
}

function responseHeaders(setCookie?: string): HeadersInit {
  const headers = corsHeaders();
  if (setCookie) headers["Set-Cookie"] = setCookie;
  return headers;
}

function corsHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
