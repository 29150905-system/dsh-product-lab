"use client";

/**
 * 浏览器端 OCR（Tesseract.js，从 CDN 按需加载）。
 * 印刷体中文/英文识别可用；手写体准确率有限，识别结果一律交给老师校对后再用。
 */

const TESSERACT_CDN = "https://cdn.jsdelivr.net/npm/tesseract.js@7/dist/tesseract.min.js";
const LANGS = "chi_sim+eng";
const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.85;

export interface OcrProgress {
  status: string;
  progress: number;
}

interface TesseractWorker {
  recognize: (image: string) => Promise<{ data: { text: string; confidence: number } }>;
  terminate: () => Promise<unknown>;
}

interface TesseractNamespace {
  createWorker: (
    langs: string,
    oem?: number,
    options?: { logger?: (message: { status: string; progress: number }) => void },
  ) => Promise<TesseractWorker>;
}

declare global {
  interface Window {
    Tesseract?: TesseractNamespace;
  }
}

let workerPromise: Promise<TesseractWorker> | null = null;
let loadingPromise: Promise<TesseractNamespace> | null = null;

function loadTesseract(): Promise<TesseractNamespace> {
  if (typeof window === "undefined") return Promise.reject(new Error("仅浏览器可用"));
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (loadingPromise) return loadingPromise;
  loadingPromise = new Promise<TesseractNamespace>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TESSERACT_CDN;
    script.async = true;
    script.onload = () => {
      if (window.Tesseract) resolve(window.Tesseract);
      else reject(new Error("OCR 脚本加载失败"));
    };
    script.onerror = () => reject(new Error("OCR 脚本加载失败，请检查网络"));
    document.head.appendChild(script);
  });
  return loadingPromise;
}

async function getWorker(onProgress?: (p: OcrProgress) => void): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const Tesseract = await loadTesseract();
      return Tesseract.createWorker(LANGS, 1, {
        logger: (message) => {
          onProgress?.({
            status: message.status,
            progress: Math.max(0, Math.min(1, message.progress || 0)),
          });
        },
      });
    })();
    workerPromise.catch(() => {
      workerPromise = null;
    });
  }
  return workerPromise;
}

export async function disposeOcr(): Promise<void> {
  if (!workerPromise) return;
  const worker = await workerPromise.catch(() => null);
  workerPromise = null;
  if (worker) await worker.terminate().catch(() => undefined);
}

/** 把图片压到 1600px 以内并转 JPEG，返回 dataURL */
export async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器不支持图片处理");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

const STATUS_LABELS: Record<string, string> = {
  "loading tesseract core": "加载 OCR 引擎…",
  "initializing tesseract": "初始化…",
  "loading language traineddata": "下载中文识别模型（首次较慢）…",
  "initializing api": "准备识别…",
  "recognizing text": "正在识别文字…",
};

export async function recognizeImage(
  dataUrl: string,
  onProgress?: (p: OcrProgress) => void,
): Promise<{ text: string; confidence: number }> {
  const worker = await getWorker(onProgress);
  const result = await worker.recognize(dataUrl);
  const text = cleanOcrText(result.data.text ?? "");
  return { text, confidence: Math.round(result.data.confidence ?? 0) };
}

export function describeOcrStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}


/** Tesseract 中文结果常在汉字间插空格，这里做一次清理 */
export function cleanOcrText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/(?<=[\u4e00-\u9fff]) +(?=[\u4e00-\u9fff])/g, "")
    .replace(/(?<=[\u4e00-\u9fff]) +(?=[，。；：、！？）】」])/g, "")
    .replace(/(?<=[（【「]) +(?=[\u4e00-\u9fff])/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 粗略估计题目数量，为卷面分析的题目切分做准备 */
export function estimateQuestionCount(text: string): number {
  const lines = text.split("\n");
  let count = 0;
  for (const line of lines) {
    if (/^\s*(第\s*[一二三四五六七八九十百0-9]+\s*题|[0-9]{1,3}\s*[.、．]\s*\S)/.test(line)) {
      count += 1;
    }
  }
  return count;
}
