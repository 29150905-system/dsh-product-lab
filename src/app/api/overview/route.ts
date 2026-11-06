import { NextResponse } from "next/server";

export const maxDuration = 60;

interface Bucket {
  label: string;
  count: number;
  ratio: number;
}

interface OverviewRequest {
  examName: string;
  fullScore: number;
  studentCount: number;
  average: number;
  median: number;
  max: number;
  min: number;
  passRate: number;
  excellentRate: number;
  lowRate: number;
  distribution: Bucket[];
  previousAverage: number | null;
  previousExamName: string | null;
}

const SYSTEM_PROMPT = `你是一位带过多届高三、常年做年级组长的资深班主任。你的判断以「稳、准、能落地」著称：给一个班级的考试数据，你能马上判断教学节奏该加快、维持还是减缓，并指出下一步具体该做什么。

现在请你为一位高中班主任写一份「班级总体学情」，用来决定接下来的教学节奏。

硬性要求：
1. 只根据我给你的一组班级汇总数据判断，不编造知识点、题型、名次、学生姓名或具体错题。
2. 不排名、不点名、不贴标签；讲的是「班级整体」，不是某个学生。
3. 结论必须明确：节奏只能从「加快 / 维持 / 减缓」里选一个，并给出数据依据。
4. 建议必须具体、明天就能做，不要空话和鸡汤。
5. 只输出 JSON，不要 Markdown 代码块、不要解释。

判断参考（不要机械套用，结合数据）：
- 及格率高、低分少、但优秀率低 → 基础过关、拔高不足 → 多为「维持」+ 拔高动作
- 及格率低或低分多 → 基础有漏洞 → 多为「减缓」+ 查漏补缺
- 平均分明显高于上次（+5 分以上）→ 可「加快」或「维持」
- 平均分明显低于上次（-5 分以上）→ 多为「减缓」，并提醒先复盘原因
- 高分段和低分段都偏多（两极分化）→ 明确建议分层布置任务
- 数据只有一次考试、没有上次对比时，不要编造「进步/退步」

输出 JSON 格式：
{"headline":"...","pace":"加快|维持|减缓","diagnosis":"...","actions":["...","...","..."]}

字段要求：
- headline：一句话结论，不超过 24 个字，要像班主任之间的口头判断
- pace：只能是「加快」「维持」「减缓」三者之一
- diagnosis：2–3 句，不超过 120 字，说清数据依据（平均分/及格率/优秀率/分布/与上次对比）
- actions：3–4 条，每条不超过 40 字；至少 1 条是「查漏补缺」类，至少 1 条是「分层/个体跟进」类`;

const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return "local";
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (bucket.count >= RATE_LIMIT_MAX) return true;
  bucket.count += 1;
  return false;
}

function badRequest(message: string) {
  return NextResponse.json({ error: "bad_request", message }, { status: 400 });
}

function normalizeDistribution(raw: unknown): Bucket[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Bucket => {
      if (!item || typeof item !== "object") return false;
      const bucket = item as Partial<Bucket>;
      return (
        typeof bucket.label === "string" &&
        Number.isFinite(bucket.count) &&
        Number.isFinite(bucket.ratio)
      );
    })
    .slice(0, 8)
    .map((bucket) => ({
      label: bucket.label.slice(0, 20),
      count: Math.max(0, Math.round(bucket.count)),
      ratio: Math.max(0, Math.min(100, Math.round(bucket.ratio))),
    }));
}

function normalize(body: Partial<OverviewRequest>): OverviewRequest | null {
  const examName = typeof body.examName === "string" ? body.examName.trim() : "";
  const nums = {
    fullScore: Number(body.fullScore),
    studentCount: Number(body.studentCount),
    average: Number(body.average),
    median: Number(body.median),
    max: Number(body.max),
    min: Number(body.min),
    passRate: Number(body.passRate),
    excellentRate: Number(body.excellentRate),
    lowRate: Number(body.lowRate),
  };
  if (!examName || examName.length > 40) return null;
  if (!Number.isFinite(nums.fullScore) || nums.fullScore <= 0) return null;
  if (!Number.isFinite(nums.studentCount) || nums.studentCount <= 0) return null;
  if (!Number.isFinite(nums.average) || nums.average < 0) return null;

  const previousAverage =
    body.previousAverage === null || body.previousAverage === undefined
      ? null
      : Number(body.previousAverage);

  return {
    examName,
    ...nums,
    distribution: normalizeDistribution(body.distribution),
    previousAverage: Number.isFinite(previousAverage) ? previousAverage : null,
    previousExamName:
      typeof body.previousExamName === "string" && body.previousExamName.trim()
        ? body.previousExamName.trim().slice(0, 40)
        : null,
  };
}

const PACES = ["加快", "维持", "减缓"] as const;
type Pace = (typeof PACES)[number];

interface ModelReport {
  headline: string;
  pace: Pace;
  diagnosis: string;
  actions: string[];
}

function parseModelJson(content: string): ModelReport | null {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(content.slice(start, end + 1)) as {
      headline?: unknown;
      pace?: unknown;
      diagnosis?: unknown;
      actions?: unknown;
    };
    if (typeof parsed.headline !== "string" || typeof parsed.diagnosis !== "string") {
      return null;
    }
    const pace = typeof parsed.pace === "string" ? parsed.pace.trim() : "";
    if (!PACES.includes(pace as Pace)) return null;
    const actions = Array.isArray(parsed.actions)
      ? parsed.actions
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          .map((item) => item.trim().slice(0, 60))
          .slice(0, 5)
      : [];
    const headline = parsed.headline.trim().slice(0, 60);
    const diagnosis = parsed.diagnosis.trim().slice(0, 300);
    if (headline.length < 4 || diagnosis.length < 10 || actions.length === 0) return null;
    return { headline, pace: pace as Pace, diagnosis, actions };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        error: "missing_key",
        message: "还没有配置 DEEPSEEK_API_KEY，请先配置后再试。",
      },
      { status: 500 },
    );
  }

  if (isRateLimited(clientKey(request))) {
    return NextResponse.json(
      { error: "rate_limited", message: "请求太频繁了，请过几分钟再试。" },
      { status: 429 },
    );
  }

  let body: Partial<OverviewRequest>;
  try {
    body = (await request.json()) as Partial<OverviewRequest>;
  } catch {
    return badRequest("请求体不是合法 JSON");
  }

  const input = normalize(body);
  if (!input) return badRequest("班级学情参数不完整或超出范围");

  const payload = {
    exam: input.examName,
    studentCount: input.studentCount,
    fullScore: input.fullScore,
    average: input.average,
    median: input.median,
    max: input.max,
    min: input.min,
    passRatePercent: input.passRate,
    excellentRatePercent: input.excellentRate,
    lowRatePercent: input.lowRate,
    distribution: input.distribution,
    previousExam: input.previousExamName,
    previousAverage: input.previousAverage,
    trend: input.previousAverage === null ? null : Math.round((input.average - input.previousAverage) * 10) / 10,
  };

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `这是我班这次考试的汇总数据，请生成班级总体学情：\n${JSON.stringify(payload)}`,
          },
        ],
        temperature: 0.5,
        max_tokens: 700,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(55_000),
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "upstream_error",
          message: `模型服务返回异常（HTTP ${response.status}），请稍后重试。`,
        },
        { status: 502 },
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = parseModelJson(content);
    if (!parsed) {
      return NextResponse.json(
        { error: "parse_error", message: "模型返回格式不对，请重新生成一次。" },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, report: parsed });
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    return NextResponse.json(
      {
        error: isTimeout ? "timeout" : "network_error",
        message: isTimeout
          ? "生成超时了，请重试一次。"
          : "连接模型服务失败，请检查网络后重试。",
      },
      { status: isTimeout ? 504 : 502 },
    );
  }
}
