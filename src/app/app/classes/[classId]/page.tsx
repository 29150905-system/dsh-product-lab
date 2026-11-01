"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAppStore } from "@/lib/use-app-store";
import {
  average,
  classAssessments,
  classStudents,
  latestScores,
} from "@/lib/store";

export default function ClassDetailPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ClassDetailContent />
    </Suspense>
  );
}

function ClassDetailContent() {
  const params = useParams<{ classId: string }>();
  const classId = params?.classId ?? "";
  const { data, addStudents } = useAppStore();
  const [showAdd, setShowAdd] = useState(false);
  const [namesText, setNamesText] = useState("");

  if (!data) {
    return (
      <div className="px-5 pt-8">
        <div className="h-6 w-40 animate-pulse rounded-full bg-zinc-200" />
        <div className="mt-6 h-32 animate-pulse rounded-3xl bg-zinc-100" />
      </div>
    );
  }

  const klass = data.classes.find((item) => item.id === classId);
  if (!klass) {
    return (
      <div className="px-5 pt-8">
        <Link href="/app" className="text-sm text-zinc-500">
          ← 返回学情
        </Link>
        <div className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
          没有找到这个班级，可能已被删除。
        </div>
      </div>
    );
  }

  const students = classStudents(data, classId);
  const assessments = classAssessments(data, classId);
  const latest = assessments[0];
  const scores = latest ? latestScores(data, latest.id) : {};
  const values = Object.values(scores);
  const avg = average(values);

  function submitStudents(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const names = namesText
      .split(/[\n,，、;；]+/)
      .map((name) => name.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    addStudents(classId, names);
    setNamesText("");
    setShowAdd(false);
  }

  return (
    <div className="px-5 pt-8">
      <header>
        <Link href="/app" className="text-sm text-zinc-500">
          ← 学情
        </Link>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-zinc-400">
              {klass.stage === "senior" ? "高中" : "初中"} · {klass.grade || "—"}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{klass.name}</h1>
          </div>
          <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs text-zinc-500 shadow-sm">
            {students.length} 人
          </span>
        </div>
      </header>

      <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        {latest ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-zinc-400">最近考试</p>
                <h2 className="mt-1 text-lg font-semibold">{latest.name}</h2>
                <p className="mt-1 text-xs text-zinc-400">{latest.date}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-400">平均分</p>
                <p className="mt-1 text-2xl font-bold text-amber-600">{avg || "—"}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-zinc-500">
              已录 {values.length} / {students.length} 人 · 满分 {latest.fullScore}
            </p>
          </>
        ) : (
          <p className="text-sm text-zinc-500">还没有考试记录，先录一次成绩吧。</p>
        )}
        <Link
          href={`/app/classes/${classId}/assessments/${latest.id}`}
          className="mt-4 block rounded-xl bg-zinc-900 py-2.5 text-center text-sm font-medium text-white"
        >
          查看本次学情
        </Link>
        <Link
          href={`/app/classes/${classId}/exam/new`}
          className="mt-2 block rounded-xl border border-zinc-200 py-2.5 text-center text-sm font-medium text-zinc-700"
        >
          + 录入新考试
        </Link>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setShowAdd((open) => !open)}
          className="rounded-xl border border-zinc-200 bg-white py-2.5 text-sm font-medium text-zinc-700"
        >
          {showAdd ? "收起" : "+ 添加学生"}
        </button>
        <Link
          href={`/app/classes/${classId}/exam/new`}
          className="rounded-xl border border-zinc-200 bg-white py-2.5 text-center text-sm font-medium text-zinc-700"
        >
          + 新建考试
        </Link>
      </div>

      {showAdd ? (
        <form
          onSubmit={submitStudents}
          className="mt-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm"
        >
          <label className="block text-xs text-zinc-500" htmlFor="student-names">
            学生名单（每行一个，也支持逗号分隔）
          </label>
          <textarea
            id="student-names"
            value={namesText}
            onChange={(event) => setNamesText(event.target.value)}
            rows={5}
            placeholder={"陈星\n林一诺\n王雨桐"}
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-base outline-none focus:border-zinc-400"
            autoFocus
          />
          <button
            type="submit"
            disabled={!namesText.trim()}
            className="mt-3 w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            添加到班级
          </button>
        </form>
      ) : null}

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-500">学生名单</h2>
          {latest ? <span className="text-xs text-zinc-400">{latest.name} 成绩</span> : null}
        </div>
        <div className="mt-3 overflow-hidden rounded-3xl border border-zinc-200 bg-white">
          {students.length === 0 ? (
            <p className="p-6 text-sm text-zinc-400">还没有学生，点上面的「添加学生」。</p>
          ) : (
            students.map((student, index) => {
              const value = scores[student.id];
              return (
                <div
                  key={student.id}
                  className={`flex items-center justify-between px-4 py-3 ${
                    index === 0 ? "" : "border-t border-zinc-100"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-xs text-zinc-500">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium">{student.name}</span>
                  </div>
                  <span
                    className={`text-sm ${
                      value === undefined ? "text-zinc-300" : "font-semibold text-zinc-800"
                    }`}
                  >
                    {value === undefined ? "未录" : `${value} 分`}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </section>

      <button
        type="button"
        disabled
        className="mt-6 w-full rounded-2xl border border-zinc-200 bg-white/70 py-3 text-sm text-zinc-400"
      >
        生成学情档案（W3 接入）
      </button>

      <p className="mt-6 text-center text-[11px] leading-5 text-zinc-400">
        数据只存在这台设备上 · 生成前自动匿名化姓名
      </p>
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
