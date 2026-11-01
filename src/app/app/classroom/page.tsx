import Link from "next/link";

export default function ClassroomPage() {
  return (
    <div className="px-5 pt-10">
      <p className="text-xs text-zinc-400">景明 · 教师工作台</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">课堂</h1>
      <div className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
          即将上线
        </span>
        <h2 className="mt-4 text-lg font-semibold">点名与课堂记录</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          一键点名、自动记录每堂课的情况，和学情档案打通——先把手头最急的「学情与沟通」做好，再回到这里。
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
