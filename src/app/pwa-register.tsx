"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // 本地开发（localhost）也注册，方便在电脑上验证「安装应用」
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // 注册失败不影响页面使用
    });
  }, []);

  return null;
}
