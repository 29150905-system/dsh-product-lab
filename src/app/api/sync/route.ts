import { createHash } from "node:crypto";
import Redis from "ioredis";
import { NextResponse } from "next/server";

export const maxDuration = 30;

const MAX_BYTES = 300 * 1024;
const CODE_RE = /^[A-Z0-9]{6,40}$/;

interface SyncStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

let redisClient: Redis | null = null;

function getRedisClient(url: string): Redis {
  if (!redisClient) {
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 2,
      connectTimeout: 8_000,
      commandTimeout: 8_000,
      lazyConnect: false,
    });
    redisClient.on("error", () => {
      // 连接错误交给上层 catch，避免未处理事件导致进程退出
    });
  }
  return redisClient;
}

function restConfig(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "";
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

async function restCommand(
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

function resolveStore(): SyncStore | null {
  const rest = restConfig();
  if (rest) {
    return {
      async get(key) {
        const value = await restCommand(rest, ["GET", key]);
        return typeof value === "string" ? value : null;
      },
      async set(key, value) {
        await restCommand(rest, ["SET", key, value]);
      },
    };
  }

  const redisUrl = process.env.REDIS_URL ?? process.env.KV_URL ?? "";
  if (redisUrl) {
    const client = getRedisClient(redisUrl);
    return {
      get: (key) => client.get(key),
      set: async (key, value) => {
        await client.set(key, value);
      },
    };
  }

  return null;
}

function keyFor(code: string): string {
  const hash = createHash("sha256").update("jingming-sync:" + code).digest("hex");
  return "jm:sync:" + hash.slice(0, 40);
}

const NOT_CONFIGURED = NextResponse.json(
  { ok: false, error: "sync_not_configured", message: "同步服务还没配置" },
  { status: 503 },
);

export async function GET(request: Request) {
  const store = resolveStore();
  if (!store) return NOT_CONFIGURED;

  const code = new URL(request.url).searchParams.get("code") ?? "";
  if (!CODE_RE.test(code)) {
    return NextResponse.json({ ok: false, error: "bad_code" }, { status: 400 });
  }

  try {
    const raw = await store.get(keyFor(code));
    if (!raw) return NextResponse.json({ ok: true, doc: null });
    return NextResponse.json({ ok: true, doc: JSON.parse(raw) });
  } catch {
    return NextResponse.json({ ok: false, error: "sync_read_failed" }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  const store = resolveStore();
  if (!store) return NOT_CONFIGURED;

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
    await store.set(keyFor(code), JSON.stringify(doc));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "sync_write_failed" }, { status: 502 });
  }
}
