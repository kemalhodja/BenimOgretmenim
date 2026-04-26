import { Suspense } from "react";

export default function StudentRequestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-zinc-500">
          Yükleniyor…
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
