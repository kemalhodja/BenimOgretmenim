"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../../lib/api";
import { loginHrefWithReturn } from "../../../lib/authRedirect";
import { clearToken, getToken } from "../../../lib/auth";
import { RequestChat } from "../../../components/RequestChat";

export default function TeacherRequestChatPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const params = useParams();
  const requestId = typeof params.requestId === "string" ? params.requestId : "";

  const [token, setToken] = useState<string | null>(null);
  const [canChat, setCanChat] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

  useEffect(() => {
    if (!token || !requestId) return;
    (async () => {
      setError(null);
      try {
        await apiFetch<{ messages: unknown[] }>(
          `/v1/lesson-requests/${requestId}/messages`,
          { token },
        );
        setCanChat(true);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "load_failed";
        setCanChat(false);
        if (msg.includes("[401]")) {
          clearToken();
          router.replace(loginHrefWithReturn(pathname));
          return;
        }
        setError(msg.includes("[403]") ? "Bu talebe teklif vermeden mesaj göremezsiniz." : msg);
      }
    })();
  }, [token, requestId, router, pathname]);

  if (!token) return null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/teacher/requests"
            className="text-sm font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900"
          >
            ← Açık talepler
          </Link>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/teacher/cuzdan"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Cüzdan
            </Link>
            <Link
              href="/teacher/dogrudan-dersler"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Doğrudan dersler
            </Link>
            <Link
              href="/teacher/dersler"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Ders oturumları
            </Link>
            <Link
              href="/teacher/kurslar"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Online kurslar
            </Link>
            <Link
              href="/teacher"
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
            >
              Panel
            </Link>
          </div>
        </div>

        <p className="mt-6 text-sm font-medium text-zinc-500">Öğretmen</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">Talep sohbeti</h1>
        <p className="mt-1 font-mono text-xs text-zinc-500">{requestId}</p>

        {error && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {error}
          </div>
        )}

        {canChat === null && !error && (
          <div className="mt-6 text-sm text-zinc-500">Yükleniyor…</div>
        )}
        {canChat === true && <RequestChat token={token} requestId={requestId} />}
      </div>
    </div>
  );
}
