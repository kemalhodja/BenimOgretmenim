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
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <Link
          href="/teacher/requests"
          className="text-sm font-medium text-paper-800/75 underline decoration-paper-300 underline-offset-4 hover:text-paper-900"
        >
          ← Açık talepler
        </Link>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-paper-900">Talep sohbeti</h1>
        <p className="mt-1 font-mono text-xs text-paper-800/55">{requestId}</p>

        {error && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {error}
          </div>
        )}

        {canChat === null && !error && (
          <div className="mt-6 text-sm text-paper-800/55">Yükleniyor…</div>
        )}
        {canChat === true && <RequestChat token={token} requestId={requestId} />}
      </div>
    </div>
  );
}
