"use client";

import { useState } from "react";
import { apiFetch } from "../../lib/api";

type Props = {
  token: string | null;
  branchSlug?: string | null;
};

const contentKinds = [
  { value: "tip", label: "İpucu" },
  { value: "formula", label: "Formül" },
  { value: "video", label: "Video linki" },
  { value: "post", label: "Kısa paylaşım" },
] as const;

export function TeacherZigoPublish({ token, branchSlug }: Props) {
  const [title, setTitle] = useState("");
  const [contentKind, setContentKind] = useState<(typeof contentKinds)[number]["value"]>("tip");
  const [externalUrl, setExternalUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function publish() {
    if (!token) return;
    const trimmed = title.trim();
    if (trimmed.length < 3) {
      setError("Başlık en az 3 karakter olmalı.");
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await apiFetch("/v1/zigo/teacher-content", {
        method: "POST",
        token,
        body: JSON.stringify({
          title: trimmed,
          contentKind,
          externalUrl: externalUrl.trim() || null,
          branchSlug: branchSlug ?? null,
        }),
      });
      setOk("Vitrin akışına eklendi. Öğrenciler ana sayfa ve öğretmen listesinde görebilir.");
      setTitle("");
      setExternalUrl("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "zigo_publish_failed";
      if (msg.includes("zigo_syndication_not_available")) {
        setError("Zigo vitrin henüz bu ortamda aktif değil. Kısa süre sonra tekrar deneyin.");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 rounded-2xl border border-paper-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-paper-900">Zigo — vitrin paylaşımı</h2>
          <p className="mt-1 text-xs leading-relaxed text-paper-800/65">
            İpucu, formül veya video linki paylaşın; keşif akışında görünür. Öğrenci kazanımına uygun kısa içerikler
            önerilir.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-paper-800">Başlık</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={160}
            placeholder="Örn: Türevde zincir kuralı hatırlatması"
            className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-paper-800">Tür</span>
          <select
            value={contentKind}
            onChange={(e) => setContentKind(e.target.value as (typeof contentKinds)[number]["value"])}
            className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
          >
            {contentKinds.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-paper-800">Link (isteğe bağlı)</span>
          <input
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="https://..."
            className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
          />
        </label>
      </div>
      {error ? <p className="mt-3 text-xs text-red-700">{error}</p> : null}
      {ok ? <p className="mt-3 text-xs font-medium text-edu-success-800">{ok}</p> : null}
      <button
        type="button"
        disabled={busy || !token}
        onClick={() => void publish()}
        className="mt-4 rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-50"
      >
        {busy ? "Gönderiliyor…" : "Vitrine paylaş"}
      </button>
    </section>
  );
}
