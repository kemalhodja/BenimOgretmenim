import { Suspense } from "react";

export default function StudentRequestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center bg-paper-50 text-sm text-paper-800/55">
          Yükleniyor…
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
