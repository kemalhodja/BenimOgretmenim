"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { clearToken, getToken } from "../../lib/auth";
import { prepareHomeworkImage, type HomeworkImageAttachment } from "../../lib/homeworkMedia";

type Branch = { id: number; parent_id: number | null; name: string; slug: string };

export default function OdevSorPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<number | "">("");
  const [topic, setTopic] = useState("");
  const [helpText, setHelpText] = useState("");
  const [gradeLevelText, setGradeLevelText] = useState("");
  const [targetExam, setTargetExam] = useState("");
  const [learningObjective, setLearningObjective] = useState("");
  const [urgencyLevel, setUrgencyLevel] = useState<"normal" | "priority" | "urgent">("normal");
  const [imageUrlText, setImageUrlText] = useState("");
  const [imageAttachments, setImageAttachments] = useState<HomeworkImageAttachment[]>([]);
  const [audioUrl, setAudioUrl] = useState("");
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

  const loadBranches = useCallback(async () => {
    const b = await apiFetch<{ branches: Branch[] }>("/v1/meta/branches");
    setBranches(b.branches);
  }, []);

  useEffect(() => {
    if (!token) return;
    loadBranches().catch(() => setError("branş yüklenemedi"));
  }, [token, loadBranches]);

  const leafBranches = (() => {
    const hasChild = new Set<number>();
    for (const x of branches) if (x.parent_id != null) hasChild.add(x.parent_id);
    return branches.filter((b) => !hasChild.has(b.id));
  })();

  async function submit() {
    if (!token) return;
    if (branchId === "") {
      setError("Branş (ders) seçin.");
      return;
    }
    if (topic.trim().length < 2) {
      setError("Konu gerekli.");
      return;
    }
    if (helpText.trim().length < 5) {
      setError("Açıklama (en az 5 karakter) gerekli.");
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const externalUrls = imageUrlText
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, Math.max(0, 4 - imageAttachments.length));
      const urls = [...imageAttachments.map((x) => x.dataUrl), ...externalUrls].slice(0, 4);
      await apiFetch("/v1/student-platform/homework-posts", {
        method: "POST",
        token,
        body: JSON.stringify({
          branchId,
          topic: topic.trim(),
          helpText: helpText.trim(),
          gradeLevelText: gradeLevelText.trim() || null,
          targetExam: targetExam.trim() || null,
          learningObjective: learningObjective.trim() || null,
          urgencyLevel,
          imageUrls: urls,
          audioUrl: audioUrl.trim() || null,
        }),
      });
      setOk("Gönderildi. Branştaki öğretmenler havuza görebilir.");
      setTopic("");
      setHelpText("");
      setGradeLevelText("");
      setTargetExam("");
      setLearningObjective("");
      setUrgencyLevel("normal");
      setImageUrlText("");
      setImageAttachments([]);
      setAudioUrl("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
        return;
      }
      if (msg.includes("subscription")) {
        setError(
          "Aktif abonelik gerekli. /student/panel sayfasından platform aboneliği alın.",
        );
        return;
      }
      if (msg.includes("[403]")) {
        setError("Bu işlem için öğrenci hesabı gerekir.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!token) return null;

  async function addImageFiles(files: File[]) {
    if (files.length === 0) return;
    setError(null);
    const remaining = Math.max(0, 4 - imageAttachments.length);
    if (remaining === 0) {
      setError("En fazla 4 görsel ekleyebilirsiniz.");
      return;
    }
    try {
      const prepared = await Promise.all(files.slice(0, remaining).map((file) => prepareHomeworkImage(file)));
      setImageAttachments((prev) => [...prev, ...prepared].slice(0, 4));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Görsel eklenemedi");
    }
  }

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Soru / ödev yardım</h1>
        <p className="mt-1 text-sm text-paper-800/75">
          Branş havuzuna düşer; bir öğretmen üstlenir (varsayılan 20 dk içinde cevaplamalı). Cevabı onaylarsanız
          öğretmen ücreti BenimÖğretmenim ödeme havuzundan öğretmen cüzdanına aktarılır (sizin cüzdanınızdan
          düşülmez). Onaylamadan önce cevabı yeterli bulmazsanız
          soruyu tekrar havuza iade edebilirsiniz (ödeme yapılmaz). Henüz kimse üstlenmediyse gönderiyi
          tamamen iptal edebilirsiniz. Aktif abonelik gerekir.
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/student/odev-sor/gonderiler" className="font-medium text-brand-800 underline">
            Gönderilerim
          </Link>
          <Link
            href="/student/panel"
            className="font-medium text-brand-800 underline"
          >
            Abonelik & cüzdan
          </Link>
          <Link className="font-medium text-paper-800 underline" href="/student/requests">
            Ders talepleri
          </Link>
          <Link className="font-medium text-paper-800 underline" href="/student/dogrudan-dersler">
            Doğrudan ders
          </Link>
          <Link className="font-medium text-paper-800 underline" href="/ogretmenler">
            Öğretmen ara
          </Link>
        </div>
        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {ok && (
          <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">
            {ok}
          </div>
        )}

        <div className="mt-6 space-y-4 rounded-xl border border-paper-200 bg-white p-5 shadow-sm">
          <label className="block text-sm">
            <span className="font-medium text-paper-800">Branş (ders) — zorunlu</span>
            <select
              className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Seçin</option>
              {leafBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-paper-800">Konu — zorunlu</span>
            <input
              className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-paper-800">Sınıf / seviye</span>
              <input
                className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2"
                value={gradeLevelText}
                onChange={(e) => setGradeLevelText(e.target.value)}
                placeholder="Örn. 8. sınıf, 11. sınıf"
                maxLength={80}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-paper-800">Sınav hedefi</span>
              <input
                className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2"
                value={targetExam}
                onChange={(e) => setTargetExam(e.target.value)}
                placeholder="Örn. LGS, TYT, AYT, okul yazılısı"
                maxLength={80}
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="font-medium text-paper-800">Kazanım / alt konu</span>
            <input
              className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2"
              value={learningObjective}
              onChange={(e) => setLearningObjective(e.target.value)}
              placeholder="Örn. Oran-orantı problemleri, paragrafta ana düşünce"
              maxLength={180}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-paper-800">Çözüm önceliği</span>
            <select
              className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2"
              value={urgencyLevel}
              onChange={(e) => setUrgencyLevel(e.target.value as "normal" | "priority" | "urgent")}
            >
              <option value="normal">Normal — hedef 20 dk</option>
              <option value="priority">Öncelikli — hedef 15 dk</option>
              <option value="urgent">Acil — hedef 10 dk</option>
            </select>
            <p className="mt-1 text-xs text-paper-800/55">
              Aciliyet, öğretmen havuzunda sıralamayı ve hedef cevap süresini etkiler.
            </p>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-paper-800">Neyi anlamadınız? — zorunlu</span>
            <textarea
              className="mt-1 w-full min-h-28 rounded-xl border border-paper-200 px-3 py-2"
              value={helpText}
              onChange={(e) => setHelpText(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-paper-800">Görseller (en fazla 4, otomatik sıkıştırılır)</span>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <label className="inline-flex items-center gap-2 rounded-xl border border-paper-200 bg-white px-3 py-2 text-xs font-medium text-paper-900 shadow-sm">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    void addImageFiles(Array.from(e.target.files ?? []).slice(0, 1));
                    e.target.value = "";
                  }}
                />
                Kamerayla çek
              </label>
              <span className="text-xs text-paper-800/55 sm:self-center">
                (Telefonlarda kamera açılır)
              </span>
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="mt-1 block w-full text-xs text-paper-800/75 file:mr-2 file:rounded-lg file:border file:border-paper-200 file:bg-white file:px-2 file:py-1"
              onChange={(e) => {
                void addImageFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
            {imageAttachments.length > 0 ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {imageAttachments.map((item) => (
                  <div key={item.id} className="rounded-xl border border-paper-200 bg-paper-50 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.dataUrl} alt={item.name} className="h-32 w-full rounded-lg object-contain" />
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs text-paper-800/65">
                      <span className="truncate">{item.name}</span>
                      <button
                        type="button"
                        onClick={() => setImageAttachments((prev) => prev.filter((x) => x.id !== item.id))}
                        className="shrink-0 rounded-lg border border-paper-300 bg-white px-2 py-1 font-medium text-paper-900"
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <textarea
              className="mt-2 w-full min-h-20 font-mono text-xs rounded-xl border border-paper-200 px-3 py-2"
              placeholder="İsteğe bağlı harici görsel URL'leri: https://..."
              value={imageUrlText}
              onChange={(e) => setImageUrlText(e.target.value)}
            />
            <p className="mt-1 text-xs text-paper-800/55">
              Dosyalar tarayıcıda küçültülür; harici URL kullanırsanız yalnızca HTTPS bağlantıları kabul edilir.
            </p>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-paper-800">Ses URL (isteğe)</span>
            <input
              className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2 text-sm"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="w-full rounded-xl bg-brand-800 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "…" : "Havuza gönder"}
          </button>
        </div>
      </div>
    </div>
  );
}
