"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAppStore, pushCurrent } from "@/lib/use-app-store";
import { loadData, saveData } from "@/lib/store";
import {
  clearSyncConfig,
  decryptData,
  describeSyncError,
  fetchRemote,
  generateSyncCode,
  readSyncConfig,
  writeSyncConfig,
  type SyncConfig,
} from "@/lib/sync";

export default function SettingsPage() {
  const { data } = useAppStore();
  const [config, setConfig] = useState<SyncConfig | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [busy, setBusy] = useState<"" | "create" | "join" | "sync" | "disable">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setConfig(readSyncConfig());
  }, []);

  async function createCode() {
    setBusy("create");
    setError("");
    setMessage("");
    try {
      const code = generateSyncCode();
      const next: SyncConfig = { code, enabled: true, lastSyncAt: null };
      writeSyncConfig(next);
      setConfig(next);
      const current = data ?? loadData();
      const ok = await pushCurrent(current);
      setMessage(ok ? "已开启同步，数据已加密上传" : "");
      if (!ok) setError("同步服务暂时不可用，数据已先保存在本机，稍后可点「立即同步」重试");
    } finally {
      setBusy("");
    }
  }

  async function joinWithCode() {
    const code = codeInput.trim().toUpperCase();
    if (!/^[A-Z0-9]{6,40}$/.test(code)) {
      setError("同步码格式不对（字母数字，6 位以上）");
      return;
    }
    setBusy("join");
    setError("");
    setMessage("");
    try {
      const remote = await fetchRemote(code);
      if (!remote.ok) {
        setError(describeSyncError(remote.error));
        return;
      }
      if (!remote.doc) {
        const next: SyncConfig = { code, enabled: true, lastSyncAt: null };
        writeSyncConfig(next);
        setConfig(next);
        const ok = await pushCurrent(data ?? loadData());
        setMessage(ok ? "这个同步码还没有数据，已把本机数据加密上传" : "");
        if (!ok) setError("上传失败，稍后可点「立即同步」重试");
        return;
      }
      const incoming = await decryptData(remote.doc.iv, remote.doc.ct, code);
      const next = { ...incoming, updatedAt: remote.doc.updatedAt };
      saveData(next);
      writeSyncConfig({ code, enabled: true, lastSyncAt: Date.now() });
      setMessage("已按同步码恢复数据，正在刷新…");
      setTimeout(() => window.location.reload(), 600);
    } catch {
      setError("同步码不对，或者数据已损坏（解密失败）");
    } finally {
      setBusy("");
    }
  }

  async function syncNow() {
    if (!config) return;
    setBusy("sync");
    setError("");
    setMessage("");
    try {
      const remote = await fetchRemote(config.code);
      if (!remote.ok) {
        setError(describeSyncError(remote.error));
        return;
      }
      const local = data ?? loadData();
      if (remote.doc && remote.doc.updatedAt > (local.updatedAt ?? 0)) {
        const incoming = await decryptData(remote.doc.iv, remote.doc.ct, config.code);
        saveData({ ...incoming, updatedAt: remote.doc.updatedAt });
        setMessage("已拉取云端较新的数据，正在刷新…");
        setTimeout(() => window.location.reload(), 600);
        return;
      }
      const ok = await pushCurrent(local);
      if (ok) {
        setConfig({ ...config, lastSyncAt: Date.now() });
        setMessage("已上传本机最新数据");
      } else {
        setError("上传失败，检查网络后重试");
      }
    } finally {
      setBusy("");
    }
  }

  function disableSync() {
    clearSyncConfig();
    setConfig(null);
    setMessage("已关闭同步。数据仍保存在本机");
  }

  async function copyCode() {
    if (!config) return;
    try {
      await navigator.clipboard.writeText(config.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("复制失败，请手动抄下同步码");
    }
  }

  const lastSync = config?.lastSyncAt
    ? new Date(config.lastSyncAt).toLocaleString("zh-CN", { hour12: false })
    : "还没同步过";

  return (
    <div className="px-5 pt-8">
      <header>
        <Link href="/app" className="text-sm text-zinc-500">
          ← 学情
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">数据同步</h1>
        <p className="mt-1 text-sm text-zinc-500">
          手机 App 和浏览器用同一份数据
        </p>
      </header>

      <div className="mt-5 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs leading-6 text-zinc-500">
          开启后，数据会先用你的同步码<b className="text-zinc-700">加密</b>再上传；
          服务器只存密文，没有同步码解不开。换手机/换浏览器时，输入同一串同步码即可恢复。
        </p>
      </div>

      {!config ? (
        <>
          <section className="mt-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold">第一次开启</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              生成一串同步码，记在备忘录里（丢了无法找回数据）。
            </p>
            <button
              type="button"
              onClick={createCode}
              disabled={busy !== ""}
              className="mt-3 w-full rounded-xl bg-zinc-900 py-3 text-sm font-medium text-white disabled:opacity-40"
            >
              {busy === "create" ? "正在开启…" : "生成同步码并开启"}
            </button>
          </section>

          <section className="mt-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold">已经有一串同步码</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              在另一台设备上填进去，拉取那边的数据。
            </p>
            <input
              value={codeInput}
              onChange={(event) => setCodeInput(event.target.value.toUpperCase())}
              placeholder="例如 K7M2Q9XW4P"
              className="mt-3 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm tracking-widest outline-none focus:border-zinc-400"
            />
            <button
              type="button"
              onClick={joinWithCode}
              disabled={busy !== "" || codeInput.trim().length < 6}
              className="mt-3 w-full rounded-xl border border-zinc-200 py-3 text-sm font-medium text-zinc-800 disabled:opacity-40"
            >
              {busy === "join" ? "正在恢复…" : "用同步码恢复数据"}
            </button>
          </section>
        </>
      ) : (
        <>
          <section className="mt-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">你的同步码</h2>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                已开启
              </span>
            </div>
            <p className="mt-3 text-center text-2xl font-bold tracking-[0.2em]">{config.code}</p>
            <button
              type="button"
              onClick={copyCode}
              className="mt-3 w-full rounded-xl border border-zinc-200 py-2 text-xs font-medium text-zinc-700"
            >
              {copied ? "已复制 ✓" : "复制同步码"}
            </button>
            <p className="mt-2 text-center text-[11px] text-zinc-400">上次同步：{lastSync}</p>
          </section>

          <section className="mt-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <button
              type="button"
              onClick={syncNow}
              disabled={busy !== ""}
              className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-medium text-white disabled:opacity-40"
            >
              {busy === "sync" ? "正在同步…" : "立即同步"}
            </button>
            <button
              type="button"
              onClick={disableSync}
              disabled={busy !== ""}
              className="mt-3 w-full rounded-xl border border-zinc-200 py-2.5 text-xs font-medium text-zinc-500"
            >
              关闭同步（不影响本机数据）
            </button>
          </section>
        </>
      )}

      {message ? (
        <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">{message}</p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-2xl bg-red-50 p-3 text-xs leading-5 text-red-700">{error}</p>
      ) : null}

      <p className="mt-6 text-center text-[11px] leading-5 text-zinc-400">
        端到端加密 · 服务器只存密文 · 同步码丢了数据无法恢复
      </p>
    </div>
  );
}
