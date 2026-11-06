import Link from "next/link";

const steps = [
  { title: "建班级", desc: "导入学生名单，一分钟建好一个班" },
  { title: "录成绩", desc: "新建一次考试，粘贴整列分数" },
  { title: "生成并发送", desc: "每个学生一份学情档案 + 家长沟通话术" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#fbfaf7] text-zinc-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-sm font-bold text-white">
            景
          </span>
          <span className="text-lg font-semibold tracking-tight">景明</span>
          <span className="ml-1 hidden rounded-full border border-zinc-200 px-2.5 py-0.5 text-xs text-zinc-500 sm:inline">
            教师工作台
          </span>
        </div>
        <nav className="hidden items-center gap-6 text-sm text-zinc-500 md:flex">
          <span className="text-zinc-900">学情与沟通</span>
          <span>提问点名 · 已上线</span>
          <span>出勤表 · 已上线</span>
        </nav>
        <Link
          href="/app"
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
        >
          免费试用
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="py-16 md:py-24">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            为高中班主任打造
          </p>
          <h1 className="max-w-3xl text-4xl font-bold leading-[1.15] tracking-tight md:text-6xl">
            把一次考试后的家长沟通，
            <br />
            变成 <span className="text-amber-600">10 分钟</span> 的事
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-600">
            导入成绩，自动生成每个学生的学情档案和家长话术；上课随机点名记回答、一键记出勤——一个 App 管完班主任日常。
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/app"
              className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-zinc-700"
            >
              免费试用
            </Link>
            <Link
              href="#sample"
              className="rounded-full border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-700 transition hover:bg-white"
            >
              看示例
            </Link>
          </div>
          <p className="mt-4 text-xs text-zinc-400">学生数据只存在本机 · 生成前自动匿名化</p>
        </section>

        <section id="sample" className="grid gap-6 pb-16 md:grid-cols-2">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-400">学情档案 · 示例</p>
                <p className="mt-1 text-lg font-semibold">学生 A</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                较上次 +6
              </span>
            </div>
            <div className="mt-5 space-y-4 text-sm leading-6 text-zinc-600">
              <p>
                <span className="font-medium text-zinc-900">本次表现：</span>
                总分 82（班均 76），发挥稳定，基础题几乎全对。
              </p>
              <p>
                <span className="font-medium text-zinc-900">优势：</span>
                审题仔细，步骤完整，计算准确率高。
              </p>
              <p>
                <span className="font-medium text-zinc-900">薄弱点：</span>
                最后两道综合题的第二步推导容易跳步。
              </p>
              <p>
                <span className="font-medium text-zinc-900">下一步：</span>
                每天练 1 道综合题，重点写全推理步骤。
              </p>
            </div>
          </div>
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-xs text-zinc-400">家长沟通话术 · 示例</p>
            <p className="mt-4 text-sm leading-7 text-zinc-700">
              「家长您好，这次考试孩子总分 82，比上次进步 6 分，基础题掌握得很扎实。目前主要在综合题的推导步骤上还有些跳步，我给他安排了每天一道综合题的小练习，也请您在家帮忙提醒他写完步骤再对答案。有什么问题随时联系我。」
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-500">可编辑</span>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-500">一键复制</span>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-500">仅本地保存</span>
            </div>
          </div>
        </section>

        <section className="border-t border-zinc-200 py-16">
          <p className="text-sm font-medium text-zinc-400">三步完成</p>
          <div className="mt-8 grid gap-8 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.title}>
                <span className="text-sm font-semibold text-amber-600">0{index + 1}</span>
                <h2 className="mt-2 text-xl font-semibold">{step.title}</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-500">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 py-8 text-center text-xs text-zinc-400">
        <p>景明 · 把时间还给教学</p>
        <p className="mt-1">可添加到手机主屏幕，像 App 一样使用</p>
        <p className="mt-3">
          <a
            href="/downloads/jingming-teacher.apk"
            download
            className="font-medium text-zinc-700 underline underline-offset-2"
          >
            安卓版 APK 下载（v3.1.0）
          </a>
          <span className="mx-2 text-zinc-300">·</span>
          <span>安装时需允许「未知来源」</span>
        </p>
      </footer>
    </div>
  );
}
