import { Suspense } from "react";

export default function OdemeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-sm text-zinc-500">
          Yükleniyor…
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
