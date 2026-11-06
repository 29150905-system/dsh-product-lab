"use client";

import type { AppData } from "./types";

const CONFIG_KEY = "jingming:sync:v1";
const DEVICE_KEY = "jingming:device:v1";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export interface SyncConfig {
  code: string;
  enabled: boolean;
  lastSyncAt: number | null;
}

export interface SyncDoc {
  updatedAt: number;
  iv: string;
  ct: string;
  deviceId: string;
}

export interface RemoteResult {
  ok: boolean;
  doc?: SyncDoc | null;
  error?: string;
  message?: string;
}

const encoder = new TextEncoder();

export function generateSyncCode(length = 10): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

export function readSyncConfig(): SyncConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SyncConfig>;
    if (typeof parsed.code !== "string" || !parsed.code) return null;
    return {
      code: parsed.code,
      enabled: parsed.enabled !== false,
      lastSyncAt: typeof parsed.lastSyncAt === "number" ? parsed.lastSyncAt : null,
    };
  } catch {
    return null;
  }
}

export function writeSyncConfig(config: SyncConfig): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function clearSyncConfig(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CONFIG_KEY);
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  let id = window.localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(code: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    encoder.encode("jingming-sync-key:" + code),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("jingming-sync-salt-v1"),
      iterations: 120_000,
      hash: "SHA-256",
    },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptData(
  data: AppData,
  code: string,
): Promise<{ iv: string; ct: string }> {
  const key = await deriveKey(code);
  const iv = new Uint8Array(new ArrayBuffer(12));
  crypto.getRandomValues(iv);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(data)),
  );
  return { iv: toBase64(iv), ct: toBase64(new Uint8Array(cipher)) };
}

export async function decryptData(
  ivB64: string,
  ctB64: string,
  code: string,
): Promise<AppData> {
  const key = await deriveKey(code);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(ivB64) },
    key,
    fromBase64(ctB64),
  );
  return JSON.parse(new TextDecoder().decode(plain)) as AppData;
}

export async function fetchRemote(code: string): Promise<RemoteResult> {
  try {
    const response = await fetch("/api/sync?code=" + encodeURIComponent(code), {
      method: "GET",
      cache: "no-store",
    });
    const result = (await response.json()) as RemoteResult;
    if (!response.ok) {
      return { ok: false, error: result.error ?? "http_" + response.status, message: result.message };
    }
    return result;
  } catch {
    return { ok: false, error: "network_error" };
  }
}

export async function pushRemote(code: string, doc: SyncDoc): Promise<RemoteResult> {
  try {
    const response = await fetch("/api/sync", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, doc }),
    });
    const result = (await response.json()) as RemoteResult;
    if (!response.ok) {
      return { ok: false, error: result.error ?? "http_" + response.status, message: result.message };
    }
    return result;
  } catch {
    return { ok: false, error: "network_error" };
  }
}

export function describeSyncError(error?: string): string {
  if (!error) return "同步失败，请稍后重试";
  if (error === "sync_not_configured") return "同步服务还没配置（需要先在 Vercel 里建一个 Redis 存储）";
  if (error === "network_error") return "网络异常，检查网络后重试";
  if (error === "too_large") return "数据过大，暂时无法同步";
  return "同步失败：" + error;
}
