import { Suspense, type ReactNode } from "react";
import BottomNav from "@/components/bottom-nav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fbfaf7] text-zinc-900">
      <div className="mx-auto min-h-screen w-full max-w-md pb-24">{children}</div>
      <Suspense fallback={null}>
        <BottomNav />
      </Suspense>
    </div>
  );
}
