"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAppStore } from "@/lib/use-app-store";
import {
  attendanceCounts,
  classLessons,
  classStudents,
  defaultPeriodLabel,
  todayISO,
} from "@/lib/store";

export default function ClassroomPage() {
  const router = useRouter();
  const { data, addLesson } = useAppStore();
  const [pickedClassId, setPickedClassId] = useState("");

  if (!data) {
    return (
      <div className="px-5 pt-10">
        <div className="h-8 w-24 animate-pulse rounded-full bg-zinc-200" />
        <div className="mt-6 h-28 animate-pulse rounded-3xl bg-zinc-100" />
      </div>
    );
  }

  const activeClass =
    data.classes.find((klass) => klass.id === pickedClassId) ?? data.classes[0] ?? null;

  if (!activeClass) {
    return (
      <div className="px-5 pt-10">
        <p className="text-xs text-zinc-400">景明 · 教师工作台</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">课堂</h1>
        <div className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 text-sm leading-6 text-zinc-500 shadow-sm">
          还没有班级。先去「学情」里建一个班级，再回来点名。
        </div>
        <Link
          href="/app"
          className="mt-6 block w-full rounded-2xl bg-zinc-900 py-3 text-center text-sm font-medium text-white"
        >
          去学情建班级
        </Link>
      </div>
    );
  }

  const students = classStudents(data, activeClass.id);
  const lessons = classLessons(data, activeClass.id);
  const totalAbsent = lessons.reduce(
    (acc, lesson) => acc + attendanceCounts(data, lesson.id, students.map((s) => s.id)).absent,
    0,
  );
  const totalLate = lessons.reduce(
    (acc, lesson) => acc + attendanceCounts(data, lesson.id, students.map((s) => s.id)).late,
    0,
  );

  function startRollCall() {
    const id = addLesson({
      classId: activeClass.id,
      date: todayISO(),
      period: defaultPeriodLabel(),
      studentIds: students.map((student) => student.id),
    });
    router.push(`/app/classroom/${id}`);
  }

  return (
    <div className="px-5 pt-8">
      <header>
        <p className="text-xs text-zinc-400">景明 · 教师工作台</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">课堂</h1>
        <p className="mt-1 text-sm text-zinc-500">点一次名，自动记一节课</p>
      </header>

      {data.classes.length > 1 ? (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {data.classes.map((klass) => (
            <button
              key={klass.id}
              type="button"
              onClick={() => setPickedClassId(klass.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                klass.id === activeClass.id
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-200 bg-white text-zinc-600"
              }`}
            >
              {klass.name}
            </button>
          ))}
        </div>
      ) : null}

      <section className="mt-5 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{activeClass.name}</h2>
            <p className="mt-1 text-xs text-zinc-400">
              {students.length} 人 · 已点 {lessons.length} 次
            </p>
          </div>
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] text-zinc-500">
            自动记录
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-zinc-50 px-2 py-2.5">
            <p className="text-[11px] text-zinc-400">累计点名</p>
            <p className="mt-0.5 text-sm font-semibold text-zinc-800">{lessons.length} 次</p>
          </div>
          <div className="rounded-2xl bg-zinc-50 px-2 py-2.5">
            <p className="text-[11px] text-zinc-400">缺勤</p>
            <p className="mt-0.5 text-sm font-semibold text-zinc-800">{totalAbsent} 人次</p>
          </div>
          <div className="rounded-2xl bg-zinc-50 px-2 py-2.5">
            <p className="text-[11px] text-zinc-400">迟到</p>
            <p className="mt-0.5 text-sm font-semibold text-zinc-800">{totalLate} 人次</p>
          </div>
        </div>

        <button
          type="button"
          onClick={startRollCall}
          disabled={students.length === 0}
          className="mt-4 w-full rounded-2xl bg-zinc-900 py-3 text-sm font-medium text-white disabled:opacity-40"
        >
          {students.length === 0 ? "先在学情里加学生" : `开始点名 · 今天 ${defaultPeriodLabel()}`}
        </button>
        <p className="mt-2 text-center text-[11px] text-zinc-400">
          默认全班到齐，只需要点异常的同学；每次改动自动保存
        </p>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-500">课堂记录</h2>
          <span className="text-xs text-zinc-400">共 {lessons.length} 次</span>
        </div>

        {lessons.length === 0 ? (
          <div className="mt-3 rounded-3xl border border-dashed border-zinc-300 bg-white/60 p-6 text-center text-sm text-zinc-500">
            还没有点名记录，点上面「开始点名」试试。
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-3xl border border-zinc-200 bg-white">
            {lessons.map((lesson, index) => {
              const counts = attendanceCounts(data, lesson.id, students.map((s) => s.id));
              return (
                <Link
                  key={lesson.id}
                  href={`/app/classroom/${lesson.id}`}
                  className={`flex items-center justify-between gap-3 px-4 py-3.5 ${
                    index === 0 ? "" : "border-t border-zinc-100"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {lesson.date} · {lesson.period}
                      {lesson.subject ? ` · ${lesson.subject}` : ""}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-zinc-400">
                      实到 {counts.signedIn} / {counts.total}
                      {counts.leave > 0 ? ` · 请假 ${counts.leave}` : ""}
                      {counts.late > 0 ? ` · 迟到 ${counts.late}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      counts.absent > 0
                        ? "bg-red-50 text-red-700"
                        : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {counts.absent > 0 ? `缺勤 ${counts.absent}` : "全到"}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <p className="mt-6 text-center text-[11px] leading-5 text-zinc-400">
        点名数据只存在本机 · 不会上传
      </p>
    </div>
  );
}
