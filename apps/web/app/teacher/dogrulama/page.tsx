"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { clearToken, getToken } from "../../lib/auth";
import { loginHrefWithReturn } from "../../lib/authRedirect";

type TeacherMe = {
  teacher: {
    verificationStatus: string;
    examDocs?: Array<{ title: string; url: string; kind?: string }>;
    videoUrl: string | null;
    bioRaw: string | null;
  };
  profileQualityScore: number;
  checklist: Record<string, boolean>;
};

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    unverified: "Doğrulanmadı",
    pending: "İnceleme bekliyor",
    verified: "Doğrulandı",
    rejected: "Reddedildi",
  };
  return map[status] ?? status;
}

export default function TeacherDogrulamaPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<TeacherMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

  useEffect(() => {
    if (!token) return;
    apiFetch<TeacherMe>("/v1/teacher/me", { token })
      .then(setMe)
      .catch((e) => {
        const m = e instanceof Error ? e.message : "yüklenemedi";
        if (m.includes("[401]")) {
          clearToken();
          router.replace(loginHrefWithReturn(pathname));
          return;
        }
        setError(m);
      });
  }, [token, router, pathname]);

  async function requestVerification() {
    if (!token) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await apiFetch("/v1/teacher/verification-request", { method: "POST", token });
      setOk("Doğrulama başvurunuz alındı. Sonuç panelinizde görünür.");
      const r = await apiFetch<TeacherMe>("/v1/teacher/me", { token });
      setMe(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "gönderilemedi");
    } finally {
      setBusy(false);
    }
  }

  if (!token || !me) return null;

  const docs = me.teacher.examDocs ?? [];
  const canRequest = me.teacher.verificationStatus !== "verified" && me.teacher.verificationStatus !== "pending";

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold text-paper-900">Kimlik ve belge doğrulama (KYC)</h1>
        <p className="mt-2 text-sm text-paper-800/75">
          Doğrulanmış rozet öğrenci güvenini artırır. Belgeleriniz yalnızca doğrulama ve destek amacıyla incelenir.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link href="/teacher/edit" className="text-brand-800 underline">
            Profili düzenle
          </Link>
          <Link href="/teacher" className="text-brand-800 underline">
            Panel
          </Link>
        </div>

        {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
        {ok ? <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">{ok}</div> : null}

        <div className="mt-8 rounded-2xl border border-paper-200 bg-white p-5 shadow-sm">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-paper-800/60">Durum</dt>
              <dd className="font-semibold text-paper-900">{statusLabel(me.teacher.verificationStatus)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-paper-800/60">Profil kalitesi</dt>
              <dd className="font-semibold text-paper-900">{me.profileQualityScore}/100</dd>
            </div>
          </dl>
        </div>

        <div className="mt-6 rounded-2xl border border-paper-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-paper-900">Yüklenen belgeler</h2>
          {docs.length === 0 ? (
            <p className="mt-2 text-sm text-paper-800/55">
              Henüz belge yok. Profil düzenleme sayfasından sınav sonucu, diploma veya kimlik kanıtı ekleyin.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {docs.map((d) => (
                <li key={`${d.title}-${d.url}`} className="rounded-lg border border-paper-100 bg-paper-50 p-3">
                  <div className="font-medium text-paper-900">{d.title}</div>
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-800 underline">
                    Belgeyi aç
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {canRequest ? (
          <button
            type="button"
            disabled={busy || docs.length === 0}
            onClick={() => void requestVerification()}
            className="mt-6 rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Gönderiliyor…" : "Doğrulama başvurusu gönder"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
