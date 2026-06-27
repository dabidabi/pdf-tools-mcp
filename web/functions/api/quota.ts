type Env = {
  PDF_TOOLS_QUOTA?: KVNamespace;
  PDF_TOOLS_DAILY_LIMIT?: string;
};

const DEFAULT_LIMIT = 10;
const COOKIE_NAME = "pdf_tools_visitor";

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: corsHeaders() });
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const visitor = getOrCreateVisitor(request);
  const headers = responseHeaders(visitor.setCookie);
  const limit = parseLimit(env.PDF_TOOLS_DAILY_LIMIT);

  if (!env.PDF_TOOLS_QUOTA) {
    return json(
      {
        ok: false,
        code: "missing_quota_binding",
        error: "Quota storage is not configured.",
        remaining: limit,
        limit
      },
      503,
      headers
    );
  }

  const quotaKeys = await getQuotaKeys(request, visitor.id);
  const usage = await readUsage(env.PDF_TOOLS_QUOTA, quotaKeys);

  return json(
    {
      ok: true,
      remaining: Math.max(0, limit - usage.current),
      limit
    },
    200,
    headers
  );
};

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
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
