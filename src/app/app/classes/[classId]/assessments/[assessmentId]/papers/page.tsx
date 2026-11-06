"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/use-app-store";
import { assessmentPapers } from "@/lib/store";
import { compressImage, describeOcrStatus, estimateQuestionCount, recognizeImage } from "@/lib/ocr";
import { getImage, putImage } from "@/lib/media-store";

export default function PapersPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PapersContent />
    </Suspense>
  );
}

interface BusyState {
  running: boolean;
  status: string;
  progress: number;
}

function PapersContent() {
  const params = useParams<{ classId: string; assessmentId: string }>();
  const classId = params?.classId ?? "";
  const assessmentId = params?.assessmentId ?? "";
  const { data, addPaper, updatePaper, deletePaper } = useAppStore();
  const [busy, setBusy] = useState<BusyState>({ running: false, status: "", progress: 0 });
  const [error, setError] = useState("");
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<string>("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const papers = data ? assessmentPapers(data, assessmentId) : [];
  const exam = data?.assessments.find((item) => item.id === assessmentId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        papers.map(async (paper) => {
          const url = await getImage(paper.imageKey).catch(() => null);
          return [paper.imageKey, url ?? ""] as const;
        }),
      );
      if (!cancelled) setThumbs(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [papers.length, papers.map((paper) => paper.id).join(",")]);

  async function handleFile(file: File) {
    if (busy.running) return;
    setError("");
    setBusy({ running: true, status: "压缩图片…", progress: 0 });
    try {
      const dataUrl = await compressImage(file);
      setPreview(dataUrl);
      const result = await recognizeImage(dataUrl, (p) => {
        setBusy({ running: true, status: describeOcrStatus(p.status), progress: p.progress });
      });
      const imageKey = `paper_${crypto.randomUUID()}`;
      await putImage(imageKey, dataUrl);
      addPaper({
        assessmentId,
        title: `卷面 ${papers.length + 1}`,
        ocrText: result.text,
        imageKey,
        confidence: result.confidence,
      });
      setBusy({ running: false, status: "", progress: 0 });
    } catch (err) {
      setBusy({ running: false, status: "", progress: 0 });
      setError(err instanceof Error ? err.message : "识别失败，请重试");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
  }

  if (!data) return <PageSkeleton />;

  return (
    <div className="px-5 pt-8">
      <header>
        <Link
          href={`/app/classes/${classId}/assessments/${assessmentId}`}
          className="text-sm text-zinc-500"
        >
          ← {exam?.name ?? "考试"}
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">卷面 OCR</h1>
        <p className="mt-1 text-sm text-zinc-500">
          拍试卷 → 识别文字 → 校对保存；这些文字会用在下学期的「卷面分析」
        </p>
      </header>

      <section className="mt-5 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold">拍一张试卷</h2>
        <p className="mt-1 text-xs leading-5 text-zinc-500">
          尽量拍正、光照均匀；印刷体识别效果好，手写答案准确率有限，识别后请校对。
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onPick}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy.running}
          className="mt-3 w-full rounded-xl bg-zinc-900 py-3 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy.running ? "识别中…" : "拍照 / 选择图片"}
        </button>

        {busy.running ? (
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] text-zinc-500">
              <span>{busy.status}</span>
              <span>{Math.round(busy.progress * 100)}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-amber-500 transition-all"
                style={{ width: `${Math.round(busy.progress * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-zinc-400">
              首次识别要下载中文模型（约 15 MB），之后会快很多
            </p>
          </div>
        ) : null}

        {preview && !busy.running ? (
          <img
            src={preview}
            alt="最近一张卷面"
            className="mt-4 max-h-64 w-full rounded-2xl object-contain"
          />
        ) : null}

        {error ? (
          <p className="mt-3 rounded-2xl bg-red-50 p-3 text-xs leading-5 text-red-700">{error}</p>
        ) : null}
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-500">已识别的卷面</h2>
          <span className="text-xs text-zinc-400">{papers.length} 张</span>
        </div>

        {papers.length === 0 ? (
          <div className="mt-3 rounded-3xl border border-dashed border-zinc-300 bg-white/60 p-6 text-center text-sm text-zinc-500">
            还没有卷面。拍一张试试，识别出的文字可以直接改。
          </div>
        ) : (
          <div className="mt-3 space-y-4">
            {papers.map((paper) => (
              <div key={paper.id} className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  {thumbs[paper.imageKey] ? (
                    <img
                      src={thumbs[paper.imageKey]}
                      alt={paper.title}
                      className="h-20 w-16 shrink-0 rounded-xl bg-zinc-50 object-contain"
                    />
                  ) : (
                    <div className="h-20 w-16 shrink-0 animate-pulse rounded-xl bg-zinc-100" />
                  )}
                  <div className="min-w-0 flex-1">
                    <input
                      defaultValue={paper.title}
                      onBlur={(event) => updatePaper(paper.id, { title: event.target.value })}
                      className="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold outline-none focus:border-zinc-200"
                    />
                    <p className="mt-1 text-[11px] text-zinc-400">
                      识别置信度 {paper.confidence}% ·{" "}
                      {new Date(paper.updatedAt).toLocaleString("zh-CN", { hour12: false })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("删除这张卷面和识别文字？")) deletePaper(paper.id);
                    }}
                    className="shrink-0 rounded-full px-2 py-1 text-[11px] text-zinc-400"
                  >
                    删除
                  </button>
                </div>

                <textarea
                  defaultValue={paper.ocrText}
                  onBlur={(event) => updatePaper(paper.id, { ocrText: event.target.value })}
                  rows={6}
                  placeholder="识别结果会出现在这里，可以直接校对"
                  className="mt-3 w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-sm leading-6 outline-none focus:border-zinc-400"
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400">
                    {paper.ocrText.length} 字 · 约 {estimateQuestionCount(paper.ocrText)} 道题 · 失焦自动保存
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500">
                    卷面分析 · 待接入
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="mt-6 text-center text-[11px] leading-5 text-zinc-400">
        卷面图片与本机识别文字只存在这台设备 · 不会上传
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
