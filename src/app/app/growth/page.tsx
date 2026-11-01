import Link from "next/link";

export default function GrowthPage() {
  return (
    <div className="px-5 pt-10">
      <p className="text-xs text-zinc-400">景明 · 教师工作台</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">成长</h1>
      <div className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
          即将上线
        </span>
        <h2 className="mt-4 text-lg font-semibold">课程设计建议</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          不替你写教案，而是把一节课的设计思路拆开给你看：目标、节奏、提问、可能的坑。让新老师更快成熟。
        </p>
      </div>
      <Link
        href="/app"
        className="mt-6 block w-full rounded-2xl border border-zinc-200 bg-white py-3 text-center text-sm font-medium text-zinc-700"
      >
        去学情
      </Link>
    </div>
  );
}
