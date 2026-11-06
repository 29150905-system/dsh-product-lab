"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAppStore } from "@/lib/use-app-store";
import {
  ATTENDANCE_CYCLE,
  ATTENDANCE_LABELS,
  attendanceCounts,
  classStudents,
  lessonAttendance,
  todayISO,
} from "@/lib/store";
import type { AttendanceStatus } from "@/lib/types";

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  present: "border border-zinc-200 bg-white text-zinc-700",
  late: "border border-amber-200 bg-amber-50 text-amber-700",
  leave: "border border-sky-200 bg-sky-50 text-sky-700",
  absent: "border border-red-200 bg-red-50 text-red-700",
};

const STATUS_DOTS: Record<AttendanceStatus, string> = {
  present: "bg-zinc-300",
  late: "bg-amber-500",
  leave: "bg-sky-500",
  absent: "bg-red-500",
};

const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8].map((index) => `第 ${index} 节`);

export default function RollCallPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RollCallContent />
    </Suspense>
  );
}

function RollCallContent() {
  const params = useParams<{ lessonId: string }>();
  const lessonId = params?.lessonId ?? "";
  const { data, updateLesson, setAttendance, setAllAttendance } = useAppStore();
  const [savedAt, setSavedAt] = useState("");
  const [note, setNote] = useState("");
  const [subject, setSubject] = useState("");
  const [onlyExceptions, setOnlyExceptions] = useState(false);

  const lesson = data?.lessons.find((item) => item.id === lessonId);
  const persistedNote = lesson?.note ?? "";
  const persistedSubject = lesson?.subject ?? "";

  useEffect(() => {
    setNote(persistedNote);
  }, [lessonId, persistedNote]);

  useEffect(() => {
    setSubject(persistedSubject);
  }, [lessonId, persistedSubject]);

  if (!data) {
    return (
      <div className="px-5 pt-10">
        <div className="h-6 w-40 animate-pulse rounded-full bg-zinc-200" />
        <div className="mt-6 h-32 animate-pulse rounded-3xl bg-zinc-100" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="px-5 pt-8">
        <Link href="/app/classroom" className="text-sm text-zinc-500">
          ← 课堂
        </Link>
        <div className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
          没有找到这次点名记录。
        </div>
      </div>
    );
  }

  const klass = data.classes.find((item) => item.id === lesson.classId);
  const students = klass ? classStudents(data, klass.id) : [];
  const map = lessonAttendance(data, lessonId);
  const counts = attendanceCounts(
    data,
    lessonId,
    students.map((student) => student.id),
  );

  const exceptions = students.filter((student) => (map[student.id] ?? "present") !== "present");
  const visible = onlyExceptions ? exceptions : students;

  function markSaved() {
    setSavedAt(new Date().toLocaleTimeString("zh-CN", { hour12: false }).slice(0, 5));
  }

  function cycle(studentId: string) {
    const current = map[studentId] ?? "present";
    const index = ATTENDANCE_CYCLE.indexOf(current);
    const next = ATTENDANCE_CYCLE[(index + 1) % ATTENDANCE_CYCLE.length];
    setAttendance(lessonId, studentId, next);
    markSaved();
  }

  function resetAll() {
    setAllAttendance(
      lessonId,
      students.map((student) => student.id),
      "present",
    );
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

  if (!klass) {
    return (
      <div className="px-5 pt-8">
        <Link href="/app/classroom" className="text-sm text-zinc-500">
          ← 课堂
        </Link>
        <div className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
          这个班级已经不在了。
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-8 pb-4">
      <header>
        <Link href="/app/classroom" className="text-sm text-zinc-500">
          ← 课堂
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">点名</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {klass.name} · {lesson.date} · {lesson.period}
        </p>
        <p className="mt-1 text-[11px] text-zinc-400">
          {savedAt ? `已自动保存 ${savedAt}` : "每次改动自动保存"}
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
            placeholder="如：讲评上周作业，最后 10 分钟小测"
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm leading-6 outline-none focus:border-zinc-400"
          />
        </label>
      </section>

      <section className="mt-4 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-600">出勤</h2>
          <span className="text-[11px] text-zinc-400">
            应到 {counts.total} · 实到 {counts.signedIn}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          <div className="rounded-2xl bg-zinc-50 py-2">
            <p className="text-[11px] text-zinc-400">到</p>
            <p className="text-sm font-semibold text-zinc-800">{counts.present}</p>
          </div>
          <div className="rounded-2xl bg-amber-50 py-2">
            <p className="text-[11px] text-amber-700">迟到</p>
            <p className="text-sm font-semibold text-amber-800">{counts.late}</p>
          </div>
          <div className="rounded-2xl bg-sky-50 py-2">
            <p className="text-[11px] text-sky-700">请假</p>
            <p className="text-sm font-semibold text-sky-800">{counts.leave}</p>
          </div>
          <div className="rounded-2xl bg-red-50 py-2">
            <p className="text-[11px] text-red-700">缺勤</p>
            <p className="text-sm font-semibold text-red-800">{counts.absent}</p>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={resetAll}
            disabled={students.length === 0}
            className="flex-1 rounded-xl border border-zinc-200 py-2 text-xs font-medium text-zinc-700 disabled:opacity-40"
          >
            全部到齐
          </button>
          <button
            type="button"
            onClick={() => setOnlyExceptions((value) => !value)}
            className={`flex-1 rounded-xl border py-2 text-xs font-medium ${
              onlyExceptions
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 text-zinc-700"
            }`}
          >
            {onlyExceptions ? "显示全班" : `只看异常（${exceptions.length}）`}
          </button>
        </div>
      </section>

      <section className="mt-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-zinc-600">学生（点一下切换状态）</h2>
          <span className="text-[11px] text-zinc-400">到 → 缺勤 → 迟到 → 请假</span>
        </div>

        {students.length === 0 ? (
          <div className="mt-3 rounded-3xl border border-dashed border-zinc-300 bg-white/60 p-6 text-center text-sm text-zinc-500">
            这个班还没有学生，先去「学情」里加名单。
          </div>
        ) : visible.length === 0 ? (
          <div className="mt-3 rounded-3xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
            全班都到齐了 🎉
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {visible.map((student) => {
              const status = map[student.id] ?? "present";
              return (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => cycle(student.id)}
                  className={`flex items-center justify-between gap-2 rounded-2xl px-3 py-3 text-sm font-medium transition active:scale-[0.98] ${STATUS_STYLES[status]}`}
                >
                  <span className="truncate">{student.name}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${STATUS_DOTS[status]}`} />
                    <span className="text-xs">{ATTENDANCE_LABELS[status]}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {exceptions.length > 0 ? (
        <section className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium text-amber-800">
            需要跟进：{exceptions.length} 人
          </p>
          <p className="mt-1.5 text-xs leading-6 text-amber-700">
            {exceptions
              .map((student) => `${student.name}（${ATTENDANCE_LABELS[map[student.id] ?? "absent"]}）`)
              .join("、")}
          </p>
        </section>
      ) : null}

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
