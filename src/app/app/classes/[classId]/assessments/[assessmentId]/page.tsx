"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAppStore } from "@/lib/use-app-store";
import { average, classStudents, latestScores, profileKey } from "@/lib/store";
import type { Student } from "@/lib/types";

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
  const { data, saveProfile } = useAppStore();
  const [open, setOpen] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!data) return <PageSkeleton />;

  const klass = data.classes.find((item) => item.id === classId);
  const assessment = data.assessments.find((item) => item.id === assessmentId);
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

  const students = classStudents(data, classId);
  const scores = latestScores(data, assessmentId);
  const values = Object.values(scores);
  const avg = average(values);
  const store = data;
  const exam = assessment;
  const currentKey = open ? profileKey(assessmentId, open.id) : "";
  const current = open ? store.profiles[currentKey] : undefined;

  async function generate(student: Student, force = false) {
    const score = scores[student.id];
    if (score === undefined) return;
    setOpen(student);
    setError(null);
    setCopied(false);
    const key = profileKey(assessmentId, student.id);
    if (store.profiles[key] && !force) return;

    setLoading(true);
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
        messageText?: string;
      };
      if (!response.ok || !result.ok || !result.profile || !result.message) {
        setError(
          (result as { message?: string }).message ??
            "生成失败，请稍后重试。",
        );
        return;
      }
      saveProfile(assessmentId, student.id, {
        profile: result.profile,
        message: result.message,
      });
    } catch {
      setError("网络异常，请检查网络后重试。");
    } finally {
      setLoading(false);
    }
  }

  async function copyMessage() {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("复制失败，请手动选中复制。");
    }
  }

  return (
    <div className="px-5 pt-8">
      <header>
        <Link href={`/app/classes/${classId}`} className="text-sm text-zinc-500">
          ← {klass.name}
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">{assessment.name}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {assessment.date} · 满分 {assessment.fullScore} · 班均 {avg || "—"}
        </p>
      </header>

      <div className="mt-5 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-xs leading-5 text-zinc-500">
          点「生成」，用匿名化的成绩数据生成每个学生的学情档案和家长话术。姓名不会发送给模型。
        </p>
      </div>

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
            const generated = Boolean(data.profiles[profileKey(assessmentId, student.id)]);
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
                      value === undefined ? "text-zinc-300" : "font-semibold text-zinc-800"
                    }`}
                  >
                    {value === undefined ? "未录" : `${value} 分`}
                  </span>
                  <button
                    type="button"
                    disabled={value === undefined}
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

      <p className="mt-6 text-center text-[11px] leading-5 text-zinc-400">
        生成内容基于匿名的成绩数据 · 姓名没有离开这台设备
      </p>

      {open ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <button
            type="button"
            aria-label="关闭"
            onClick={() => setOpen(null)}
            className="absolute inset-0 bg-black/30"
          />
          <div className="relative z-10 max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-zinc-400">
                  {assessment.name} · {open.name}
                </p>
                <h2 className="mt-0.5 text-lg font-semibold">学情档案</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(null)}
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
            ) : current ? (
              <div className="mt-4">
                <div className="whitespace-pre-line rounded-2xl bg-zinc-50 p-4 text-sm leading-7 text-zinc-700">
                  {current.profile}
                </div>
                <h3 className="mt-5 text-sm font-semibold text-zinc-600">家长沟通话术</h3>
                <div className="mt-2 rounded-2xl border border-zinc-200 p-4 text-sm leading-7 text-zinc-700">
                  {current.message}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={copyMessage}
                    className="rounded-xl bg-zinc-900 py-2.5 text-sm font-medium text-white"
                  >
                    {copied ? "已复制 ✓" : "复制话术"}
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

function PageSkeleton() {
  return (
    <div className="px-5 pt-8">
      <div className="h-6 w-40 animate-pulse rounded-full bg-zinc-200" />
      <div className="mt-6 h-32 animate-pulse rounded-3xl bg-zinc-100" />
    </div>
  );
}
