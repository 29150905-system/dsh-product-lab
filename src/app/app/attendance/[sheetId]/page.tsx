"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAppStore } from "@/lib/use-app-store";
import {
  classStudents,
  sheetAbsentIds,
  sheetCounts,
  todayISO,
} from "@/lib/store";

const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8].map((index) => `第 ${index} 节`);

export default function AttendanceSheetPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SheetContent />
    </Suspense>
  );
}

function SheetContent() {
  const params = useParams<{ sheetId: string }>();
  const sheetId = params?.sheetId ?? "";
  const { data, updateSheet, toggleAbsent, setAllPresent } = useAppStore();
  const [savedAt, setSavedAt] = useState("");

  const sheet = data?.attendanceSheets.find((item) => item.id === sheetId);

  if (!data) return <PageSkeleton />;

  if (!sheet) {
    return (
      <div className="px-5 pt-8">
        <Link href="/app/attendance" className="text-sm text-zinc-500">
          ← 出勤
        </Link>
        <div className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
          没有找到这张出勤表。
        </div>
      </div>
    );
  }

  const store = data;
  const klass = store.classes.find((item) => item.id === sheet.classId);
  const students = klass ? classStudents(store, klass.id) : [];
  const studentIds = students.map((student) => student.id);
  const absentIds = sheetAbsentIds(store, sheetId);
  const counts = sheetCounts(store, sheetId, studentIds);
  const absentStudents = students.filter((student) => absentIds.has(student.id));

  function markSaved() {
    setSavedAt(new Date().toLocaleTimeString("zh-CN", { hour12: false }).slice(0, 5));
  }

  function toggle(studentId: string) {
    toggleAbsent(sheetId, studentId);
    markSaved();
  }

  function resetAll() {
    setAllPresent(sheetId);
    markSaved();
  }

  return (
    <div className="px-5 pt-8">
      <header>
        <Link href="/app/attendance" className="text-sm text-zinc-500">
          ← 出勤
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">出勤表</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {klass?.name ?? ""} · {sheet.date} · {sheet.period}
        </p>
        <p className="mt-1 text-[11px] text-zinc-400">
          {savedAt ? `已自动保存 ${savedAt}` : "改动自动保存"}
        </p>
      </header>

      <section className="mt-4 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] text-zinc-400">日期</span>
            <input
              type="date"
              value={sheet.date}
              max={todayISO()}
              onChange={(event) => {
                updateSheet(sheetId, { date: event.target.value });
                markSaved();
              }}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-zinc-400">节次</span>
            <select
              value={sheet.period}
              onChange={(event) => {
                updateSheet(sheetId, { period: event.target.value });
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

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-zinc-50 py-2.5">
            <p className="text-[11px] text-zinc-400">应到</p>
            <p className="text-sm font-semibold text-zinc-800">{counts.total}</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 py-2.5">
            <p className="text-[11px] text-emerald-700">实到</p>
            <p className="text-sm font-semibold text-emerald-800">{counts.present}</p>
          </div>
          <div className="rounded-2xl bg-red-50 py-2.5">
            <p className="text-[11px] text-red-700">缺勤</p>
            <p className="text-sm font-semibold text-red-800">{counts.absent}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={resetAll}
          disabled={counts.absent === 0}
          className="mt-3 w-full rounded-xl border border-zinc-200 py-2 text-xs font-medium text-zinc-700 disabled:opacity-40"
        >
          全部到齐
        </button>
      </section>

      <section className="mt-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-zinc-600">学生</h2>
          <span className="text-[11px] text-zinc-400">点一下 = 缺勤，再点恢复</span>
        </div>

        {students.length === 0 ? (
          <div className="mt-3 rounded-3xl border border-dashed border-zinc-300 bg-white/60 p-6 text-center text-sm text-zinc-500">
            这个班还没有学生，先去「学情」里加名单。
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {students.map((student) => {
              const absent = absentIds.has(student.id);
              return (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => toggle(student.id)}
                  className={`rounded-2xl px-2 py-3 text-sm font-medium transition active:scale-[0.98] ${
                    absent
                      ? "border border-red-200 bg-red-50 text-red-700"
                      : "border border-zinc-200 bg-white text-zinc-700"
                  }`}
                >
                  <span className="block truncate">{student.name}</span>
                  <span
                    className={`mt-0.5 block text-[10px] ${absent ? "text-red-500" : "text-zinc-400"}`}
                  >
                    {absent ? "缺勤" : "出勤"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {absentStudents.length > 0 ? (
        <section className="mt-4 rounded-3xl border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-medium text-red-800">
            缺勤 {absentStudents.length} 人（记得联系家长/补假条）
          </p>
          <p className="mt-1.5 text-xs leading-6 text-red-700">
            {absentStudents.map((student) => student.name).join("、")}
          </p>
        </section>
      ) : students.length > 0 ? (
        <section className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-center text-xs font-medium text-emerald-800">
          全班到齐 🎉
        </section>
      ) : null}

      <p className="mt-6 text-center text-[11px] leading-5 text-zinc-400">
        出勤数据只存在本机 · 不会上传
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
