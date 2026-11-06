import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

export const maxDuration = 30;

const MAX_BYTES = 300 * 1024;
const CODE_RE = /^[A-Z0-9]{6,40}$/;

function redisConfig(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "";
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

function keyFor(code: string): string {
  const hash = createHash("sha256").update("jingming-sync:" + code).digest("hex");
  return "jm:sync:" + hash.slice(0, 40);
}

async function redisCommand(
  cfg: { url: string; token: string },
  command: (string | number)[],
): Promise<unknown> {
  const response = await fetch(cfg.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("redis_http_" + response.status);
  const data = (await response.json()) as { result?: unknown };
  return data.result ?? null;
}

export async function GET(request: Request) {
  const cfg = redisConfig();
  if (!cfg) {
    return NextResponse.json(
      { ok: false, error: "sync_not_configured", message: "同步服务还没配置" },
      { status: 503 },
    );
  }
  const code = new URL(request.url).searchParams.get("code") ?? "";
  if (!CODE_RE.test(code)) {
    return NextResponse.json({ ok: false, error: "bad_code" }, { status: 400 });
  }
  try {
    const raw = await redisCommand(cfg, ["GET", keyFor(code)]);
    if (typeof raw !== "string" || raw.length === 0) {
      return NextResponse.json({ ok: true, doc: null });
    }
    return NextResponse.json({ ok: true, doc: JSON.parse(raw) });
  } catch {
    return NextResponse.json({ ok: false, error: "sync_read_failed" }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  const cfg = redisConfig();
  if (!cfg) {
    return NextResponse.json(
      { ok: false, error: "sync_not_configured", message: "同步服务还没配置" },
      { status: 503 },
    );
  }

  const raw = await request.text();
  if (raw.length > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "too_large" }, { status: 413 });
  }

  let body: { code?: unknown; doc?: unknown };
  try {
    body = JSON.parse(raw) as { code?: unknown; doc?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!CODE_RE.test(code)) {
    return NextResponse.json({ ok: false, error: "bad_code" }, { status: 400 });
  }

  const doc = body.doc as
    | { updatedAt?: unknown; iv?: unknown; ct?: unknown; deviceId?: unknown }
    | undefined;
  if (
    !doc ||
    typeof doc.updatedAt !== "number" ||
    typeof doc.iv !== "string" ||
    typeof doc.ct !== "string" ||
    typeof doc.deviceId !== "string"
  ) {
    return NextResponse.json({ ok: false, error: "bad_doc" }, { status: 400 });
  }

  try {
    await redisCommand(cfg, ["SET", keyFor(code), JSON.stringify(doc)]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "sync_write_failed" }, { status: 502 });
  }
}
