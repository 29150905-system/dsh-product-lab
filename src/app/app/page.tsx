"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAppStore } from "@/lib/use-app-store";
import type { Stage } from "@/lib/types";
import {
  average,
  classAssessments,
  classStudents,
  latestScores,
} from "@/lib/store";

export default function AppHomePage() {
  const router = useRouter();
  const { data, addClass } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("高一");
  const [stage, setStage] = useState<Stage>("senior");

  if (!data) {
    return (
      <div className="px-5 pt-10">
        <div className="h-8 w-24 animate-pulse rounded-full bg-zinc-200" />
        <div className="mt-6 h-28 animate-pulse rounded-3xl bg-zinc-100" />
      </div>
    );
  }

  function submitClass(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    const id = addClass({ name, stage, grade });
    setShowForm(false);
    setName("");
    router.push(`/app/classes/${id}`);
  }

  return (
    <div className="px-5 pt-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs text-zinc-400">景明 · 教师工作台</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">学情</h1>
          <p className="mt-1 text-sm text-zinc-500">选一个班级，开始今天的记录</p>
        </div>
        <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] text-zinc-400">
          示例数据
        </span>
      </header>

      <section className="mt-6 space-y-3">
        {data.classes.map((klass) => {
          const students = classStudents(data, klass.id);
          const assessments = classAssessments(data, klass.id);
          const latest = assessments[0];
          const scores = latest ? latestScores(data, latest.id) : {};
          const values = Object.values(scores);
          const avg = average(values);
          return (
            <Link
              key={klass.id}
              href={`/app/classes/${klass.id}`}
              className="block rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm transition active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-zinc-400">
                    {klass.stage === "senior" ? "高中" : "初中"} · {klass.grade || "—"}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">{klass.name}</h2>
                </div>
                <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                  {students.length} 人
                </span>
              </div>
              {latest ? (
                <p className="mt-3 text-sm text-zinc-500">
                  最近考试：{latest.name} · 平均 {avg || "—"} 分
                </p>
              ) : (
                <p className="mt-3 text-sm text-zinc-400">还没有考试记录</p>
              )}
            </Link>
          );
        })}
      </section>

      {showForm ? (
        <form
          onSubmit={submitClass}
          className="mt-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-sm font-semibold">新建班级</h2>
          <label className="mt-4 block text-xs text-zinc-500" htmlFor="class-name">
            班级名称
          </label>
          <input
            id="class-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：高一(3)班"
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-base outline-none focus:border-zinc-400"
            autoFocus
          />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-500" htmlFor="class-stage">
                学段
              </label>
              <select
                id="class-stage"
                value={stage}
                onChange={(event) => setStage(event.target.value as Stage)}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-base outline-none"
              >
                <option value="senior">高中</option>
                <option value="junior">初中</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500" htmlFor="class-grade">
                年级
              </label>
              <input
                id="class-grade"
                value={grade}
                onChange={(event) => setGrade(event.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-base outline-none focus:border-zinc-400"
              />
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm text-zinc-600"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-sm font-medium text-white disabled:opacity-40"
            >
              创建
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-4 w-full rounded-2xl border border-dashed border-zinc-300 bg-white/60 py-3 text-sm font-medium text-zinc-500"
        >
          + 新建班级
        </button>
      )}

      <p className="mt-8 text-center text-[11px] leading-5 text-zinc-400">
        学生数据只存在这台设备上
        <br />
        生成内容前会自动匿名化姓名
      </p>
    </div>
  );
}
