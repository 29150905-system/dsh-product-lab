"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAppStore } from "@/lib/use-app-store";
import {
  CALL_LABELS,
  CALL_TONES,
  classStudents,
  lessonCallStats,
  lessonCalls,
  pickStudent,
  todayISO,
} from "@/lib/store";
import type { CallResult, Student } from "@/lib/types";

const RESULT_BUTTONS: { result: CallResult; className: string }[] = [
  { result: "good", className: "bg-emerald-600 text-white" },
  { result: "ok", className: "bg-amber-500 text-white" },
  { result: "poor", className: "bg-red-600 text-white" },
];

const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8].map((index) => `第 ${index} 节`);

export default function LessonPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LessonContent />
    </Suspense>
  );
}

function LessonContent() {
  const params = useParams<{ lessonId: string }>();
  const lessonId = params?.lessonId ?? "";
  const { data, updateLesson, addCall, deleteCall } = useAppStore();
  const [pending, setPending] = useState<Student | null>(null);
  const [savedAt, setSavedAt] = useState("");
  const [note, setNote] = useState("");
  const [subject, setSubject] = useState("");

  const lesson = data?.lessons.find((item) => item.id === lessonId);
  const persistedNote = lesson?.note ?? "";
  const persistedSubject = lesson?.subject ?? "";

  useEffect(() => {
    setNote(persistedNote);
  }, [lessonId, persistedNote]);

  useEffect(() => {
    setSubject(persistedSubject);
  }, [lessonId, persistedSubject]);

  if (!data) return <PageSkeleton />;

  if (!lesson) {
    return (
      <div className="px-5 pt-8">
        <Link href="/app/classroom" className="text-sm text-zinc-500">
          ← 课堂
        </Link>
        <div className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
          没有找到这节课。
        </div>
      </div>
    );
  }

  const store = data;
  const klass = store.classes.find((item) => item.id === lesson.classId);
  const students = klass ? classStudents(store, klass.id) : [];
  const stats = lessonCallStats(
    store,
    lessonId,
    students.map((student) => student.id),
  );
  const calls = lessonCalls(store, lessonId);
  const calledIds = new Set(calls.map((call) => call.studentId));
  const uncalled = students.filter((student) => !calledIds.has(student.id));

  function markSaved() {
    setSavedAt(new Date().toLocaleTimeString("zh-CN", { hour12: false }).slice(0, 5));
  }

  function randomPick() {
    const picked = pickStudent(store, lessonId, students);
    if (picked) setPending(picked);
  }

  function record(result: CallResult) {
    if (!pending) return;
    addCall(lessonId, pending.id, result);
    setPending(null);
    markSaved();
  }

  function saveNote() {
    if (note.trim() === persistedNote.trim()) return;
    updateLesson(lessonId, { note });
    markSaved();
  }

  function saveSubject() {
    if (subject.trim() === persistedSubject.trim()) return;
    updateLesson(lessonId, { subject });
    markSaved();
  }

  function studentName(studentId: string): string {
    return students.find((student) => student.id === studentId)?.name ?? "学生";
  }

  const coverage = stats.students === 0 ? 0 : Math.round((stats.covered / stats.students) * 100);

  return (
    <div className="px-5 pt-8">
      <header>
        <Link href="/app/classroom" className="text-sm text-zinc-500">
          ← 课堂
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">提问点名</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {klass?.name ?? ""} · {lesson.date} · {lesson.period}
        </p>
        <p className="mt-1 text-[11px] text-zinc-400">
          {savedAt ? `已自动保存 ${savedAt}` : "每次点名自动记录"}
        </p>
      </header>

      <section className="mt-4 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] text-zinc-400">日期</span>
            <input
              type="date"
              value={lesson.date}
              max={todayISO()}
              onChange={(event) => {
                updateLesson(lessonId, { date: event.target.value });
                markSaved();
              }}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-zinc-400">节次</span>
            <select
              value={lesson.period}
              onChange={(event) => {
                updateLesson(lessonId, { period: event.target.value });
                markSaved();
              }}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400"
            >
              {PERIODS.map((period) => (
                <option key={period} value={period}>
                  {period}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-3 block">
          <span className="text-[11px] text-zinc-400">科目（可选）</span>
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            onBlur={saveSubject}
            placeholder="如：数学"
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400"
          />
        </label>

        <label className="mt-3 block">
          <span className="text-[11px] text-zinc-400">课堂备注（可选）</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onBlur={saveNote}
            rows={2}
            placeholder="如：函数单调性，重点提问中段学生"
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm leading-6 outline-none focus:border-zinc-400"
          />
        </label>
      </section>

      <section className="mt-4 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
        {pending ? (
          <div>
            <p className="text-center text-xs text-zinc-400">请这位同学回答</p>
            <p className="mt-2 text-center text-4xl font-bold tracking-tight">{pending.name}</p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {RESULT_BUTTONS.map((button) => (
                <button
                  key={button.result}
                  type="button"
                  onClick={() => record(button.result)}
                  className={`rounded-xl py-3 text-sm font-medium ${button.className}`}
                >
                  {CALL_LABELS[button.result]}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={randomPick}
                className="flex-1 rounded-xl border border-zinc-200 py-2 text-xs font-medium text-zinc-700"
              >
                换一个
              </button>
              <button
                type="button"
                onClick={() => setPending(null)}
                className="flex-1 rounded-xl border border-zinc-200 py-2 text-xs font-medium text-zinc-500"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={randomPick}
              disabled={students.length === 0}
              className="w-full rounded-2xl bg-zinc-900 py-5 text-lg font-semibold text-white disabled:opacity-40"
            >
              随机点名
            </button>
            <p className="mt-2 text-center text-[11px] text-zinc-400">
              优先没被点过的 · 也可在下面名单里手点
            </p>
          </div>
        )}

        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          <div className="rounded-2xl bg-zinc-50 py-2">
            <p className="text-[11px] text-zinc-400">点名</p>
            <p className="text-sm font-semibold text-zinc-800">{stats.calls}</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 py-2">
            <p className="text-[11px] text-emerald-700">好</p>
            <p className="text-sm font-semibold text-emerald-800">{stats.good}</p>
          </div>
          <div className="rounded-2xl bg-amber-50 py-2">
            <p className="text-[11px] text-amber-700">一般</p>
            <p className="text-sm font-semibold text-amber-800">{stats.ok}</p>
          </div>
          <div className="rounded-2xl bg-red-50 py-2">
            <p className="text-[11px] text-red-700">没答上来</p>
            <p className="text-sm font-semibold text-red-800">{stats.poor}</p>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span>
              覆盖 {stats.covered} / {stats.students} 人
            </span>
            <span>{coverage}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-zinc-900 transition-all"
              style={{ width: `${coverage}%` }}
            />
          </div>
        </div>
      </section>

      {uncalled.length > 0 ? (
        <section className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium text-amber-800">这节课还没点到（{uncalled.length} 人）</p>
          <p className="mt-1.5 text-xs leading-6 text-amber-700">
            {uncalled.map((student) => student.name).join("、")}
          </p>
        </section>
      ) : students.length > 0 ? (
        <section className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-center text-xs font-medium text-emerald-800">
          全班都点过一遍了 🎉
        </section>
      ) : null}

      {calls.length > 0 ? (
        <section className="mt-4">
          <h2 className="px-1 text-sm font-semibold text-zinc-600">本节点名记录</h2>
          <div className="mt-2 overflow-hidden rounded-3xl border border-zinc-200 bg-white">
            {calls.map((call, index) => (
              <div
                key={call.id}
                className={`flex items-center justify-between gap-3 px-4 py-3 ${
                  index === 0 ? "" : "border-t border-zinc-100"
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium">{studentName(call.studentId)}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${CALL_TONES[call.result]}`}
                  >
                    {CALL_LABELS[call.result]}
                  </span>
                  <span className="shrink-0 text-[11px] text-zinc-400">
                    {new Date(call.createdAt).toLocaleTimeString("zh-CN", {
                      hour12: false,
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    deleteCall(call.id);
                    markSaved();
                  }}
                  className="shrink-0 rounded-full px-2 py-1 text-[11px] text-zinc-400"
                >
                  撤销
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-zinc-600">全班名单</h2>
          <span className="text-[11px] text-zinc-400">点名字 = 直接点他</span>
        </div>
        {students.length === 0 ? (
          <div className="mt-2 rounded-3xl border border-dashed border-zinc-300 bg-white/60 p-6 text-center text-sm text-zinc-500">
            这个班还没有学生，先去「学情」里加名单。
          </div>
        ) : (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {students.map((student) => {
              const total = store.calls.filter((call) => call.studentId === student.id).length;
              const called = calledIds.has(student.id);
              return (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => setPending(student)}
                  className={`rounded-2xl px-2 py-2.5 text-sm font-medium transition active:scale-[0.98] ${
                    called
                      ? "border border-zinc-900 bg-zinc-900 text-white"
                      : "border border-zinc-200 bg-white text-zinc-700"
                  }`}
                >
                  <span className="block truncate">{student.name}</span>
                  <span
                    className={`mt-0.5 block text-[10px] ${called ? "text-zinc-300" : "text-zinc-400"}`}
                  >
                    累计 {total} 次
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <p className="mt-6 text-center text-[11px] leading-5 text-zinc-400">
        点名记录自动保存 · 数据只存在本机
      </p>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="px-5 pt-10">
      <div className="h-6 w-40 animate-pulse rounded-full bg-zinc-200" />
      <div className="mt-6 h-32 animate-pulse rounded-3xl bg-zinc-100" />
    </div>
  );
}
