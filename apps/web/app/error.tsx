"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold text-paper-900">
        Bir şeyler ters gitti
      </h1>
      <p className="text-sm text-paper-700">
        Sayfayı yeniden yüklemeyi deneyin. Sorun devam ederse, aşağıdaki metinde
        geçen{" "}
        <span className="rounded bg-paper-100 px-1 font-mono text-xs">
          requestId
        </span>{" "}
        değerini destek ekibine iletin.
      </p>
      <pre className="max-h-48 overflow-auto rounded-lg border border-paper-200 bg-white p-3 font-mono text-xs text-paper-800">
        {error.message}
        {error.digest ? `\n(digest=${error.digest})` : ""}
      </pre>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-paper-900 px-4 py-2 text-sm font-medium text-white hover:bg-paper-800"
        >
          Yeniden dene
        </button>
        <Link
          href="/"
          className="rounded-lg border border-paper-300 bg-white px-4 py-2 text-sm font-medium text-paper-900 hover:bg-paper-50"
        >
          Ana sayfa
        </Link>
      </div>
    </div>
  );
}
