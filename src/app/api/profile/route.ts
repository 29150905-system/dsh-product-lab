import { NextResponse } from "next/server";

export const maxDuration = 60;

interface ProfileRequest {
  examName: string;
  score: number;
  fullScore: number;
  classAverage: number;
  studentCount: number;
  previousScore?: number | null;
}

const SYSTEM_PROMPT = `你是一位经验丰富的高中班主任，擅长把冷冰冰的成绩数据，翻译成家长听得懂、老师用得上的学情反馈。

硬性要求：
1. 只根据我提供的数据说话，不编造事实，不编造具体知识点、名次或学生姓名。
2. 不排名、不贴标签、不比较其他学生；语气温和、具体、可执行。
3. 学生只有「总分」这一个数据，所以分析要从学习习惯、答题策略、时间分配、心态等角度展开，不要假装知道哪道题错了。
4. 用「孩子」「该生」指代学生，绝不出现真实姓名。
5. 只输出 JSON，不要输出 Markdown 代码块或任何解释。

输出 JSON 格式：
{"profile":"...","message":"..."}

profile 要求：
- 四段，用换行分隔，每段以「本次表现：」「优势：」「薄弱点：」「下一步：」开头
- 每段 1-2 句，全文 150-250 字
- 「下一步」给 1-2 条具体、今天就能开始做的动作

message 要求：
- 开头「家长您好，」
- 100-200 字，口语化，像一个负责任的班主任在微信上说话
- 说清本次成绩的大致位置（不说名次）、一个亮点、一个需要关注的点、一条家庭配合建议
- 不制造焦虑，结尾留一句「有情况随时联系我」`;

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

function normalize(body: Partial<ProfileRequest>): ProfileRequest | null {
  const examName = typeof body.examName === "string" ? body.examName.trim() : "";
  const score = Number(body.score);
  const fullScore = Number(body.fullScore);
  const classAverage = Number(body.classAverage);
  const studentCount = Number(body.studentCount);
  const previousScore =
    body.previousScore === null || body.previousScore === undefined
      ? null
      : Number(body.previousScore);

  if (!examName || examName.length > 40) return null;
  if (!Number.isFinite(score) || score < 0) return null;
  if (!Number.isFinite(fullScore) || fullScore <= 0) return null;
  if (!Number.isFinite(classAverage) || classAverage < 0) return null;
  if (!Number.isFinite(studentCount) || studentCount <= 0) return null;
  if (score > fullScore * 1.5) return null;
  if (previousScore !== null && !Number.isFinite(previousScore)) return null;

  return {
    examName,
    score,
    fullScore,
    classAverage,
    studentCount,
    previousScore,
  };
}

function parseModelJson(content: string): { profile: string; message: string } | null {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(content.slice(start, end + 1)) as {
      profile?: unknown;
      message?: unknown;
    };
    if (typeof parsed.profile !== "string" || typeof parsed.message !== "string") {
      return null;
    }
    const profile = parsed.profile.trim();
    const message = parsed.message.trim();
    if (profile.length < 20 || message.length < 20) return null;
    return { profile, message };
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
        message:
          "还没有配置 DEEPSEEK_API_KEY。本地请写到项目根目录的 .env.local，线上请加到 Vercel 的环境变量。",
      },
      { status: 500 },
    );
  }

  if (isRateLimited(clientKey(request))) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: "请求太频繁了，请过几分钟再试。",
      },
      { status: 429 },
    );
  }

  let body: Partial<ProfileRequest>;
  try {
    body = (await request.json()) as Partial<ProfileRequest>;
  } catch {
    return badRequest("请求体不是合法 JSON");
  }

  const input = normalize(body);
  if (!input) return badRequest("学情参数不完整或超出范围");

  const vsAverage = Math.round((input.score - input.classAverage) * 10) / 10;
  const payload = {
    exam: input.examName,
    score: input.score,
    fullScore: input.fullScore,
    classAverage: input.classAverage,
    studentCount: input.studentCount,
    vsAverage,
    previousScore: input.previousScore,
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
            content: `请根据下面的数据，生成这个学生的学情档案和家长沟通话术：\n${JSON.stringify(payload)}`,
          },
        ],
        temperature: 0.6,
        max_tokens: 900,
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

    return NextResponse.json({
      ok: true,
      profile: parsed.profile,
      message: parsed.message,
    });
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
