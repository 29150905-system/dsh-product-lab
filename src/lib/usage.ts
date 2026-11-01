const USAGE_KEY = "jingming:usage:v1";

export const DAILY_LIMIT = 50;

interface Usage {
  date: string;
  count: number;
}

function todayKey(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function readUsage(): Usage {
  if (typeof window === "undefined") return { date: todayKey(), count: 0 };
  try {
    const raw = window.localStorage.getItem(USAGE_KEY);
    if (!raw) return { date: todayKey(), count: 0 };
    const parsed = JSON.parse(raw) as Partial<Usage>;
    if (parsed.date !== todayKey() || typeof parsed.count !== "number") {
      return { date: todayKey(), count: 0 };
    }
    return { date: parsed.date, count: parsed.count };
  } catch {
    return { date: todayKey(), count: 0 };
  }
}

function writeUsage(usage: Usage): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
}

export function remainingGenerations(): number {
  return Math.max(0, DAILY_LIMIT - readUsage().count);
}

/** 每次真正调用模型前扣一次；返回 false 表示今天额度用完了 */
export function consumeGeneration(count = 1): boolean {
  const usage = readUsage();
  if (usage.count + count > DAILY_LIMIT) return false;
  writeUsage({ date: usage.date, count: usage.count + count });
  return true;
}
