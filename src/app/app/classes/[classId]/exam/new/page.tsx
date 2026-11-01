"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { useAppStore } from "@/lib/use-app-store";
import { classStudents, todayISO } from "@/lib/store";

export default function NewExamPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewExamContent />
    </Suspense>
  );
}

function NewExamContent() {
  const params = useParams<{ classId: string }>();
  const classId = params?.classId ?? "";
  const router = useRouter();
  const { data, addAssessment } = useAppStore();

  const [name, setName] = useState("第一次月考");
  const [date, setDate] = useState(todayISO());
  const [fullScore, setFullScore] = useState("100");
  const [values, setValues] = useState<Record<string, string>>({});
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");

  if (!data) {
    return (
      <div className="px-5 pt-8">
        <div className="h-6 w-40 animate-pulse rounded-full bg-zinc-200" />
        <div className="mt-6 h-40 animate-pulse rounded-3xl bg-zinc-100" />
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
          没有找到这个班级。
        </div>
      </div>
    );
  }

  const students = classStudents(data, classId);
  const filledCount = students.filter((student) => {
    const value = values[student.id];
    return value !== undefined && value.trim() !== "";
  }).length;

  function applyPaste() {
    const parsed = pasteText
      .split(/[\n,，、;；\s]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (parsed.length === 0) return;
    const next: Record<string, string> = {};
    students.forEach((student, index) => {
      const value = parsed[index];
      if (value !== undefined) next[student.id] = value;
    });
    setValues(next);
    setPasteOpen(false);
    setPasteText("");
  }

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const score = Number(fullScore);
    if (!name.trim() || !date || !Number.isFinite(score) || score <= 0) return;
    const numeric: Record<string, number> = {};
    for (const student of students) {
      const raw = values[student.id];
      if (raw === undefined || raw.trim() === "") continue;
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) numeric[student.id] = parsed;
    }
    addAssessment({
      classId,
      name,
      date,
      fullScore: score,
      values: numeric,
    });
    router.push(`/app/classes/${classId}`);
  }

  return (
    <div className="px-5 pb-32 pt-8">
      <header>
        <Link href={`/app/classes/${classId}`} className="text-sm text-zinc-500">
          ← {klass.name}
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">录入成绩</h1>
        <p className="mt-1 text-sm text-zinc-500">
          只录总分，先跑通「成绩 → 学情」的闭环
        </p>
      </header>

      {students.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
          这个班还没有学生，先去班级页添加名单。
          <Link
            href={`/app/classes/${classId}`}
            className="mt-4 block rounded-xl bg-zinc-900 py-2.5 text-center text-sm font-medium text-white"
          >
            去添加学生
          </Link>
        </div>
      ) : (
        <form onSubmit={save} className="mt-6 space-y-4">
          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <label className="block text-xs text-zinc-500" htmlFor="exam-name">
              考试名称
            </label>
            <input
              id="exam-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-base outline-none focus:border-zinc-400"
            />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-500" htmlFor="exam-date">
                  日期
                </label>
                <input
                  id="exam-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-base outline-none focus:border-zinc-400"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500" htmlFor="exam-full">
                  满分
                </label>
                <input
                  id="exam-full"
                  type="number"
                  inputMode="decimal"
                  value={fullScore}
                  onChange={(event) => setFullScore(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-base outline-none focus:border-zinc-400"
                />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-600">学生成绩</h2>
              <span className="text-xs text-zinc-400">
                已录 {filledCount} / {students.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPasteOpen((open) => !open)}
              className="mt-3 w-full rounded-xl border border-dashed border-zinc-300 py-2 text-xs text-zinc-500"
            >
              {pasteOpen ? "收起粘贴框" : "粘贴整列分数（按名单顺序）"}
            </button>
            {pasteOpen ? (
              <div className="mt-3">
                <textarea
                  value={pasteText}
                  onChange={(event) => setPasteText(event.target.value)}
                  rows={4}
                  placeholder={"82\n76\n91\n68"}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-base outline-none focus:border-zinc-400"
                />
                <button
                  type="button"
                  onClick={applyPaste}
                  disabled={!pasteText.trim()}
                  className="mt-2 w-full rounded-xl border border-zinc-200 py-2 text-xs font-medium text-zinc-700 disabled:opacity-40"
                >
                  填入下面的名单
                </button>
              </div>
            ) : null}

            <div className="mt-4 divide-y divide-zinc-100">
              {students.map((student) => (
                <label key={student.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-sm text-zinc-700">{student.name}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={values[student.id] ?? ""}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, [student.id]: event.target.value }))
                    }
                    placeholder="—"
                    className="w-24 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-right text-base outline-none focus:border-zinc-400"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="fixed inset-x-0 bottom-20 z-40 mx-auto max-w-md px-5">
            <div className="rounded-2xl border border-zinc-200 bg-[#fbfaf7]/95 p-2 shadow-lg backdrop-blur">
              <button
                type="submit"
                disabled={!name.trim() || filledCount === 0}
                className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-medium text-white disabled:opacity-40"
              >
                保存成绩
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="px-5 pt-8">
      <div className="h-6 w-40 animate-pulse rounded-full bg-zinc-200" />
      <div className="mt-6 h-40 animate-pulse rounded-3xl bg-zinc-100" />
    </div>
  );
}
