import { NextResponse } from "next/server";

export const maxDuration = 90;

interface PaperQuestion {
  no: string;
  type: string;
  studentAnswer: string;
  isCorrect: boolean | null;
  errorReason: string;
  knowledgePoint: string;
}

interface PaperAnalysis {
  summary: string;
  questions: PaperQuestion[];
  weakPoints: string[];
  suggestions: string[];
}

interface PaperRequest {
  examName: string;
  fullScore?: number;
  subject?: string;
  studentLabel?: string;
  imageDataUrl: string;
  ocrText?: string;
}

const MAX_IMAGE_CHARS = 6 * 1024 * 1024;

const SYSTEM_PROMPT = `你是一位带过多届高三、常年做教研组长的高中老师。你可以看学生的试卷/答题卡照片，判断每道题的作答情况、失分原因，并给出老师下一步能直接用的建议。

硬性要求：
1. 只依据图片里看得见的内容判断；看不清的题就写「看不清」，绝不编造题目、分数、学生姓名。
2. 不做人身评价，只分析知识漏洞、方法问题、答题规范（如跳步、漏单位、审题偏差）。
3. 学生答案和错因要短，用老师之间说话的语气。
4. 只输出 JSON，不要 Markdown 代码块、不要解释。

输出 JSON 格式：
{"summary":"...","questions":[{"no":"1","type":"选择|填空|解答|其他","studentAnswer":"...","isCorrect":true,"errorReason":"...","knowledgePoint":"..."}],"weakPoints":["..."],"suggestions":["...","..."]}

字段要求：
- summary：整体判断，不超过 120 字
- questions：最多 15 条；题目多时优先列「答错 / 空白 / 得分低」的题；isCorrect 用 true/false，看不清就 null
- weakPoints：2–4 个知识或能力薄弱点
- suggestions：3–4 条具体到「下一节课怎么讲 / 作业怎么调」，每条不超过 40 字`;

const RATE_LIMIT_MAX = 30;
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

function normalize(body: Partial<PaperRequest>): PaperRequest | null {
  const examName = typeof body.examName === "string" ? body.examName.trim() : "";
  const imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl : "";
  if (!examName || examName.length > 40) return null;
  if (!/^data:image\/(jpeg|png|webp|gif);base64,/.test(imageDataUrl)) return null;
  if (imageDataUrl.length > MAX_IMAGE_CHARS) return null;

  const fullScore = Number(body.fullScore);
  const ocrText = typeof body.ocrText === "string" ? body.ocrText.trim().slice(0, 4000) : "";
  const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 20) : "";
  const studentLabel =
    typeof body.studentLabel === "string" ? body.studentLabel.trim().slice(0, 20) : "";

  return {
    examName,
    imageDataUrl,
    fullScore: Number.isFinite(fullScore) && fullScore > 0 ? fullScore : undefined,
    subject: subject || undefined,
    studentLabel: studentLabel || undefined,
    ocrText: ocrText || undefined,
  };
}

function parseModelJson(content: string): PaperAnalysis | null {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(content.slice(start, end + 1)) as {
      summary?: unknown;
      questions?: unknown;
      weakPoints?: unknown;
      suggestions?: unknown;
    };
    const summary = typeof parsed.summary === "string" ? parsed.summary.trim().slice(0, 300) : "";
    if (!summary) return null;

    const questions: PaperQuestion[] = Array.isArray(parsed.questions)
      ? parsed.questions
          .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
          .slice(0, 15)
          .map((item, index) => ({
            no: String(item.no ?? index + 1).slice(0, 12),
            type: String(item.type ?? "其他").slice(0, 12),
            studentAnswer: String(item.studentAnswer ?? "").slice(0, 200),
            isCorrect:
              item.isCorrect === true || item.isCorrect === false ? item.isCorrect : null,
            errorReason: String(item.errorReason ?? "").slice(0, 200),
            knowledgePoint: String(item.knowledgePoint ?? "").slice(0, 60),
          }))
      : [];

    const toList = (value: unknown, max: number, len: number): string[] =>
      Array.isArray(value)
        ? value
            .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            .map((item) => item.trim().slice(0, len))
            .slice(0, max)
        : [];

    return {
      summary,
      questions,
      weakPoints: toList(parsed.weakPoints, 5, 60),
      suggestions: toList(parsed.suggestions, 5, 80),
    };
  } catch {
    return null;
  }
}

/** 粗略估算费用：按 DeepSeek 官方价（缓存未命中），高峰/空闲各半 */
function estimateCost(promptTokens: number, completionTokens: number): number {
  const now = new Date();
  const shanghai = new Date(now.getTime() + 8 * 3600_000);
  const day = shanghai.getUTCDay();
  const hour = shanghai.getUTCHours();
  const isWeekday = day >= 1 && day <= 5;
  const peak =
    isWeekday && ((hour >= 9 && hour < 12) || (hour >= 14 && hour < 18));
  const inputPrice = peak ? 2 : 1; // 元 / 百万 tokens
  const outputPrice = peak ? 8 : 4;
  return Math.round(((promptTokens * inputPrice + completionTokens * outputPrice) / 1_000_000) * 10000) / 10000;
}

export async function POST(request: Request) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "missing_key", message: "还没有配置 DEEPSEEK_API_KEY。" },
      { status: 500 },
    );
  }

  if (isRateLimited(clientKey(request))) {
    return NextResponse.json(
      { error: "rate_limited", message: "请求太频繁了，请过几分钟再试。" },
      { status: 429 },
    );
  }

  let body: Partial<PaperRequest>;
  try {
    body = (await request.json()) as Partial<PaperRequest>;
  } catch {
    return badRequest("请求体不是合法 JSON");
  }

  const input = normalize(body);
  if (!input) return badRequest("参数不完整，或图片格式/大小不支持");
  const paperInput = input;

  const context = [
    `考试：${input.examName}`,
    input.subject ? `科目：${input.subject}` : "",
    input.fullScore ? `满分：${input.fullScore}` : "",
    input.studentLabel ? `学生：${input.studentLabel}` : "",
    input.ocrText ? `本机 OCR 文字（仅供参考，可能有错字）：\n${input.ocrText}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  async function requestModel() {
    return fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "deepseek-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: `请分析这张卷面：\n${context}` },
              { type: "image_url", image_url: { url: paperInput.imageDataUrl, detail: "original" } },
            ],
          },
        ],
        thinking: { type: "enabled" },
        reasoning_effort: "low",
        max_tokens: 3000,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(80_000),
    });
  }

  try {
    let lastFailure = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await requestModel();

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        const tooLarge = response.status === 413 || detail.includes("too large");
        return NextResponse.json(
          {
            error: "upstream_error",
            message: tooLarge
              ? "图片太大了，压缩后重试（建议长边 1600px 以内）。"
              : `模型服务返回异常（HTTP ${response.status}），请稍后重试。`,
          },
          { status: 502 },
        );
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };
      const content = data.choices?.[0]?.message?.content ?? "";
      const analysis = parseModelJson(content);
      if (!analysis) {
        lastFailure = content.slice(0, 120);
        continue;
      }

      const promptTokens = data.usage?.prompt_tokens ?? 0;
      const completionTokens = data.usage?.completion_tokens ?? 0;

      return NextResponse.json({
        ok: true,
        analysis,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: data.usage?.total_tokens ?? promptTokens + completionTokens,
          costCny: estimateCost(promptTokens, completionTokens),
        },
      });
    }

    return NextResponse.json(
      {
        error: "parse_error",
        message: "模型返回格式不对，请重新分析一次。",
        debug: process.env.NODE_ENV === "development" ? lastFailure : undefined,
      },
      { status: 502 },
    );
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    return NextResponse.json(
      {
        error: isTimeout ? "timeout" : "network_error",
        message: isTimeout ? "分析超时了，请重试一次。" : "连接模型服务失败，请检查网络后重试。",
      },
      { status: isTimeout ? 504 : 502 },
    );
  }
}
