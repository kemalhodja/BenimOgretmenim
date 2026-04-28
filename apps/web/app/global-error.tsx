"use client";

import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="tr">
      <body className="min-h-screen bg-paper-50 px-4 py-16 font-sans text-paper-900 antialiased">
        <div className="mx-auto max-w-lg space-y-4">
          <h1 className="text-2xl font-semibold">Kritik hata</h1>
          <p className="text-sm text-paper-700">
            Uygulama yüklenirken beklenmeyen bir hata oluştu. Lütfen sayfayı
            yenileyin.
          </p>
          <pre className="max-h-48 overflow-auto rounded-lg border border-paper-200 bg-white p-3 font-mono text-xs text-paper-800">
            {error.message}
            {error.digest ? `\n(digest=${error.digest})` : ""}
          </pre>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-paper-900 px-4 py-2 text-sm font-medium text-white hover:bg-paper-800"
          >
            Yeniden dene
          </button>
        </div>
      </body>
    </html>
  );
}
