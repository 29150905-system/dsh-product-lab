"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAppStore } from "@/lib/use-app-store";
import { average, classStudents, latestScores, overviewStats, profileKey, reportKey } from "@/lib/store";
import { DAILY_LIMIT, consumeGeneration, remainingGenerations } from "@/lib/usage";
import type { Student } from "@/lib/types";

type GenerateResult = { ok: true } | { ok: false; message: string };

export default function AssessmentPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AssessmentContent />
    </Suspense>
  );
}

function AssessmentContent() {
  const params = useParams<{ classId: string; assessmentId: string }>();
  const classId = params?.classId ?? "";
  const assessmentId = params?.assessmentId ?? "";
  const { data, saveProfile, saveReport } = useAppStore();

  const [open, setOpen] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"" | "one" | "all">("");
  const [draftMessage, setDraftMessage] = useState("");
  const [remaining, setRemaining] = useState(0);
  const [batch, setBatch] = useState({
    running: false,
    done: 0,
    total: 0,
    failed: 0,
  });
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [overviewCopied, setOverviewCopied] = useState(false);

  const currentProfile =
    data && open ? data.profiles[profileKey(assessmentId, open.id)] : undefined;

  useEffect(() => {
    setRemaining(remainingGenerations());
  }, []);

  useEffect(() => {
    setDraftMessage(currentProfile?.message ?? "");
  }, [open?.id, currentProfile?.updatedAt]);

  if (!data) return <PageSkeleton />;

  const store = data;
  const klass = store.classes.find((item) => item.id === classId);
  const assessment = store.assessments.find((item) => item.id === assessmentId);
  if (!klass || !assessment) {
    return (
      <div className="px-5 pt-8">
        <Link href="/app" className="text-sm text-zinc-500">
          ← 返回学情
        </Link>
        <div className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
          没有找到这次考试。
        </div>
      </div>
    );
  }

  const exam = assessment;
  const students = classStudents(store, classId);
  const scores = latestScores(store, assessmentId);
  const values = Object.values(scores);
  const avg = average(values);
  const generatedCount = students.filter((student) =>
    Boolean(store.profiles[profileKey(assessmentId, student.id)]),
  ).length;
  const missingCount = students.filter(
    (student) =>
      scores[student.id] !== undefined &&
      !store.profiles[profileKey(assessmentId, student.id)],
  ).length;
  const stats = overviewStats(store, classId, assessmentId);
  const report = store.reports[reportKey(assessmentId)];

  async function requestProfile(student: Student): Promise<GenerateResult> {
    const score = scores[student.id];
    if (score === undefined) {
      return { ok: false, message: "这个学生还没有录成绩。" };
    }
    if (!consumeGeneration(1)) {
      setRemaining(remainingGenerations());
      return {
        ok: false,
        message: `今日生成次数已用完（每天 ${DAILY_LIMIT} 次），明天再试。`,
      };
    }
    setRemaining(remainingGenerations());

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examName: exam.name,
          score,
          fullScore: exam.fullScore,
          classAverage: avg,
          studentCount: students.length,
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        profile?: string;
        message?: string;
      };
      if (!response.ok || !result.ok || !result.profile || !result.message) {
        return {
          ok: false,
          message: result.message ?? `生成失败（HTTP ${response.status}）`,
        };
      }
      saveProfile(assessmentId, student.id, {
        profile: result.profile,
        message: result.message,
      });
      return { ok: true };
    } catch {
      return { ok: false, message: "网络异常，请检查网络后重试。" };
    }
  }

  function persistDraft() {
    if (!open || !currentProfile) return;
    const trimmed = draftMessage.trim();
    if (!trimmed || trimmed === currentProfile.message) return;
    saveProfile(assessmentId, open.id, {
      profile: currentProfile.profile,
      message: trimmed,
    });
  }

  function closeSheet() {
    persistDraft();
    setOpen(null);
    setError(null);
    setCopied("");
  }

  async function generate(student: Student, force = false) {
    const key = profileKey(assessmentId, student.id);
    if (store.profiles[key] && !force) {
      setOpen(student);
      setError(null);
      setCopied("");
      return;
    }
    setOpen(student);
    setError(null);
    setCopied("");
    setLoading(true);
    const result = await requestProfile(student);
    if (!result.ok) setError(result.message);
    setLoading(false);
  }

  async function generateAll() {
    if (batch.running) return;
    if (remaining <= 0) {
      setError(`今日生成次数已用完（每天 ${DAILY_LIMIT} 次），明天再试。`);
      return;
    }
    const targets = students.filter(
      (student) =>
        scores[student.id] !== undefined &&
        !store.profiles[profileKey(assessmentId, student.id)],
    );
    if (targets.length === 0) {
      setError("全班都已经生成过了。");
      return;
    }

    setError(null);
    setBatch({ running: true, done: 0, total: targets.length, failed: 0 });
    let done = 0;
    let failed = 0;
    for (const student of targets) {
      const result = await requestProfile(student);
      if (result.ok) done += 1;
      else failed += 1;
      setBatch({ running: true, done, total: targets.length, failed });
      if (!result.ok && result.message.includes("次数已用完")) break;
    }
    setBatch({ running: false, done, total: targets.length, failed });
  }

  async function copyText(text: string, kind: "one" | "all") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setError("复制失败，请手动选中复制。");
    }
  }

  async function copyAll() {
    const entries: string[] = [];
    for (const student of students) {
      const profile = store.profiles[profileKey(assessmentId, student.id)];
      const score = scores[student.id];
      if (!profile || score === undefined) continue;
      entries.push(`【${student.name}】${score} 分\n${profile.message}`);
    }
    if (entries.length === 0) {
      setError("还没有生成任何话术。");
      return;
    }
    await copyText(entries.join("\n\n---\n\n"), "all");
  }

  async function generateOverview() {
    if (!stats || overviewLoading) return;
    if (stats.count === 0) {
      setOverviewError("还没有录入成绩，先录一次成绩再生成。");
      return;
    }
    if (!consumeGeneration(1)) {
      setRemaining(remainingGenerations());
      setOverviewError(`今日生成次数已用完（每天 ${DAILY_LIMIT} 次），明天再试。`);
      return;
    }
    setRemaining(remainingGenerations());
    setOverviewLoading(true);
    setOverviewError(null);
    setOverviewCopied(false);
    try {
      const response = await fetch("/api/overview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examName: exam.name,
          fullScore: stats.fullScore,
          studentCount: students.length,
          average: stats.average,
          median: stats.median,
          max: stats.max,
          min: stats.min,
          passRate: stats.passRate,
          excellentRate: stats.excellentRate,
          lowRate: stats.lowRate,
          distribution: stats.distribution,
          previousAverage: stats.previousAverage,
          previousExamName: stats.previousExamName,
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        report?: {
          headline: string;
          pace: "加快" | "维持" | "减缓";
          diagnosis: string;
          actions: string[];
        };
        message?: string;
      };
      if (!response.ok || !result.ok || !result.report) {
        setOverviewError(result.message ?? `生成失败（HTTP ${response.status}）`);
        return;
      }
      saveReport(assessmentId, result.report);
    } catch {
      setOverviewError("网络异常，请检查网络后重试。");
    } finally {
      setOverviewLoading(false);
    }
  }

  async function copyOverview() {
    if (!report) return;
    const text = [
      `【${exam.name} · 班级总体学情】`,
      report.headline,
      `教学节奏建议：${report.pace}`,
      report.diagnosis,
      "行动建议：",
      ...report.actions.map((item, index) => `${index + 1}. ${item}`),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setOverviewCopied(true);
      setTimeout(() => setOverviewCopied(false), 2000);
    } catch {
      setOverviewError("复制失败，请手动选中复制。");
    }
  }

  return (
    <div className="px-5 pt-8">
      <header>
        <Link href={`/app/classes/${classId}`} className="text-sm text-zinc-500">
          ← {klass.name}
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">{exam.name}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {exam.date} · 满分 {exam.fullScore} · 班均 {avg || "—"}
        </p>
      </header>

      <div className="mt-5 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-xs leading-5 text-zinc-500">
          用匿名化的成绩数据生成学情档案和家长话术，姓名不会发送给模型。
        </p>

        <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400">
          <span>
            今日剩余 {remaining} / {DAILY_LIMIT} 次
          </span>
          <span>
            已生成 {generatedCount} / {students.length}
          </span>
        </div>

        <button
          type="button"
          onClick={generateAll}
          disabled={batch.running || remaining === 0 || missingCount === 0}
          className="mt-3 w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {batch.running
            ? `正在生成 ${batch.done} / ${batch.total}`
            : `生成全班（${missingCount} 人）`}
        </button>

        {batch.running ? (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-amber-500 transition-all"
              style={{
                width: `${batch.total === 0 ? 0 : (batch.done / batch.total) * 100}%`,
              }}
            />
          </div>
        ) : null}

        {!batch.running && batch.total > 0 && batch.failed > 0 ? (
          <p className="mt-2 text-[11px] text-amber-700">
            本次有 {batch.failed} 个生成失败，可以单独重试。
          </p>
        ) : null}
      </div>

      <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">班级总体学情</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              先看整体该加快还是补漏，再决定这一周的课堂节奏
            </p>
          </div>
          {report ? (
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${paceTone(report.pace)}`}
            >
              {report.pace}进度
            </span>
          ) : null}
        </div>

        {stats ? (
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              { label: "平均", value: stats.average },
              { label: "中位数", value: stats.median },
              { label: "最高", value: stats.max },
              { label: "最低", value: stats.min },
              { label: "及格率", value: `${stats.passRate}%` },
              { label: "优秀率", value: `${stats.excellentRate}%` },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl bg-zinc-50 px-2 py-2.5">
                <p className="text-[11px] text-zinc-400">{item.label}</p>
                <p className="mt-0.5 text-sm font-semibold text-zinc-800">{item.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {stats && stats.trend !== null ? (
          <p
            className={`mt-3 text-xs ${stats.trend >= 0 ? "text-emerald-700" : "text-amber-700"}`}
          >
            比上次{stats.previousExamName ? `（${stats.previousExamName}）` : ""}
            {stats.trend >= 0 ? "高" : "低"} {Math.abs(stats.trend)} 分
          </p>
        ) : null}

        {report ? (
          <div className="mt-4 rounded-2xl bg-zinc-50 p-4">
            <p className="text-sm font-semibold leading-6 text-zinc-900">
              {report.headline}
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{report.diagnosis}</p>
            <ul className="mt-3 space-y-1.5">
              {report.actions.map((action, index) => (
                <li
                  key={index}
                  className="flex gap-2 text-sm leading-6 text-zinc-700"
                >
                  <span className="mt-0.5 shrink-0 text-[11px] text-zinc-400">
                    {index + 1}.
                  </span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={copyOverview}
              className="mt-3 w-full rounded-xl border border-zinc-200 bg-white py-2 text-xs font-medium text-zinc-700"
            >
              {overviewCopied ? "已复制总体学情 ✓" : "复制总体学情"}
            </button>
          </div>
        ) : null}

        {overviewError ? (
          <p className="mt-3 rounded-2xl bg-red-50 p-3 text-xs leading-5 text-red-700">
            {overviewError}
          </p>
        ) : null}

        <button
          type="button"
          onClick={generateOverview}
          disabled={overviewLoading || !stats || stats.count === 0 || remaining === 0}
          className="mt-4 w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {overviewLoading
            ? "正在分析班级整体…"
            : report
              ? "重新生成总体学情"
              : "生成总体学情"}
        </button>

        <p className="mt-2 text-center text-[11px] text-zinc-400">
          {report
            ? `生成于 ${new Date(report.updatedAt).toLocaleString("zh-CN", { hour12: false })}`
            : "只发送汇总数据，不发送任何学生姓名"}
        </p>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-500">学生名单</h2>
          <span className="text-xs text-zinc-400">
            已录 {values.length} / {students.length}
          </span>
        </div>
        <div className="mt-3 overflow-hidden rounded-3xl border border-zinc-200 bg-white">
          {students.map((student, index) => {
            const value = scores[student.id];
            const generated = Boolean(
              store.profiles[profileKey(assessmentId, student.id)],
            );
            return (
              <div
                key={student.id}
                className={`flex items-center justify-between gap-3 px-4 py-3 ${
                  index === 0 ? "" : "border-t border-zinc-100"
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs text-zinc-500">
                    {index + 1}
                  </span>
                  <span className="truncate text-sm font-medium">{student.name}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={`text-sm ${
                      value === undefined
                        ? "text-zinc-300"
                        : "font-semibold text-zinc-800"
                    }`}
                  >
                    {value === undefined ? "未录" : `${value} 分`}
                  </span>
                  <button
                    type="button"
                    disabled={
                      value === undefined ||
                      batch.running ||
                      (!generated && remaining === 0)
                    }
                    onClick={() => generate(student)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      value === undefined
                        ? "bg-zinc-100 text-zinc-300"
                        : generated
                          ? "border border-zinc-200 text-zinc-700"
                          : "bg-zinc-900 text-white"
                    }`}
                  >
                    {generated ? "查看" : "生成"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <button
        type="button"
        onClick={copyAll}
        disabled={generatedCount === 0}
        className="mt-4 w-full rounded-2xl border border-zinc-200 bg-white py-3 text-sm font-medium text-zinc-700 disabled:opacity-40"
      >
        {copied === "all"
          ? "已复制全部话术 ✓"
          : `复制全部话术（${generatedCount} 人）`}
      </button>

      <p className="mt-6 text-center text-[11px] leading-5 text-zinc-400">
        生成内容基于匿名的成绩数据 · 姓名没有离开这台设备
      </p>

      {open ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <button
            type="button"
            aria-label="关闭"
            onClick={closeSheet}
            className="absolute inset-0 bg-black/30"
          />
          <div className="relative z-10 max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-zinc-400">
                  {exam.name} · {open.name}
                </p>
                <h2 className="mt-0.5 text-lg font-semibold">学情档案</h2>
              </div>
              <button
                type="button"
                onClick={closeSheet}
                className="rounded-full px-2 py-1 text-sm text-zinc-400"
              >
                关闭
              </button>
            </div>

            {loading ? (
              <div className="mt-5 space-y-3">
                <div className="h-4 w-3/4 animate-pulse rounded-full bg-zinc-100" />
                <div className="h-4 w-full animate-pulse rounded-full bg-zinc-100" />
                <div className="h-4 w-5/6 animate-pulse rounded-full bg-zinc-100" />
                <div className="h-20 animate-pulse rounded-2xl bg-zinc-100" />
              </div>
            ) : error ? (
              <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm leading-6 text-red-700">
                {error}
                <button
                  type="button"
                  onClick={() => generate(open, true)}
                  className="mt-3 w-full rounded-xl bg-white py-2 text-xs font-medium text-red-700"
                >
                  重试
                </button>
              </div>
            ) : currentProfile ? (
              <div className="mt-4">
                <div className="whitespace-pre-line rounded-2xl bg-zinc-50 p-4 text-sm leading-7 text-zinc-700">
                  {currentProfile.profile}
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-600">
                    家长沟通话术
                  </h3>
                  <span className="text-[11px] text-zinc-400">编辑后自动保存</span>
                </div>
                <textarea
                  value={draftMessage}
                  onChange={(event) => setDraftMessage(event.target.value)}
                  onBlur={persistDraft}
                  rows={6}
                  className="mt-2 w-full rounded-2xl border border-zinc-200 p-4 text-sm leading-7 text-zinc-700 outline-none focus:border-zinc-400"
                />

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      persistDraft();
                      void copyText(draftMessage, "one");
                    }}
                    className="rounded-xl bg-zinc-900 py-2.5 text-sm font-medium text-white"
                  >
                    {copied === "one" ? "已复制 ✓" : "复制话术"}
                  </button>
                  <button
                    type="button"
                    onClick={() => generate(open, true)}
                    className="rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-700"
                  >
                    重新生成
                  </button>
                </div>

                <p className="mt-4 text-center text-[11px] leading-5 text-zinc-400">
                  生成内容基于匿名化的成绩数据
                </p>
              </div>
            ) : (
              <p className="mt-5 text-sm text-zinc-500">还没有生成内容。</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function paceTone(pace: "加快" | "维持" | "减缓"): string {
  if (pace === "加快") return "bg-amber-50 text-amber-700";
  if (pace === "减缓") return "bg-sky-50 text-sky-700";
  return "bg-emerald-50 text-emerald-700";
}

function PageSkeleton() {
  return (
    <div className="px-5 pt-8">
      <div className="h-6 w-40 animate-pulse rounded-full bg-zinc-200" />
      <div className="mt-6 h-32 animate-pulse rounded-3xl bg-zinc-100" />
    </div>
  );
}
