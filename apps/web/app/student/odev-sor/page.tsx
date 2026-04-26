"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { clearToken, getToken } from "../../lib/auth";

type Branch = { id: number; parent_id: number | null; name: string; slug: string };

export default function OdevSorPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<number | "">("");
  const [topic, setTopic] = useState("");
  const [helpText, setHelpText] = useState("");
  const [imageUrls, setImageUrls] = useState(""); // satır satır veya virgüllü URL
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
      const urls = imageUrls
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 8);
      await apiFetch("/v1/student-platform/homework-posts", {
        method: "POST",
        token,
        body: JSON.stringify({
          branchId,
          topic: topic.trim(),
          helpText: helpText.trim(),
          imageUrls: urls,
          audioUrl: audioUrl.trim() || null,
        }),
      });
      setOk("Gönderildi. Branştaki öğretmenler havuza görebilir.");
      setTopic("");
      setHelpText("");
      setImageUrls("");
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

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <div className="text-sm text-zinc-500">Öğrenci · branş havuzuna</div>
        <h1 className="text-2xl font-semibold text-zinc-900">Soru / ödev yardım</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Fotoğraflar (URL) ve açıklama. Ses için ses dosyası URL’i. Aktif abonelik gerekir.
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link
            href="/student/panel"
            className="font-medium text-brand-800 underline"
          >
            Abonelik & cüzdan
          </Link>
          <Link className="font-medium text-zinc-700 underline" href="/student/requests">
            Ders talepleri
          </Link>
          <Link className="font-medium text-zinc-700 underline" href="/student/dogrudan-dersler">
            Doğrudan ders
          </Link>
          <Link className="font-medium text-zinc-700 underline" href="/ogretmenler">
            Öğretmen ara
          </Link>
        </div>
        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {ok && (
          <div className="mt-4 rounded-2xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">
            {ok}
          </div>
        )}

        <div className="mt-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <label className="block text-sm">
            <span className="font-medium text-zinc-700">Branş (ders) — zorunlu</span>
            <select
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
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
            <span className="font-medium text-zinc-700">Konu — zorunlu</span>
            <input
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-700">Neyi anlamadınız? — zorunlu</span>
            <textarea
              className="mt-1 w-full min-h-28 rounded-xl border border-zinc-200 px-3 py-2"
              value={helpText}
              onChange={(e) => setHelpText(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-700">Görsel linkleri (isteğe, satır veya virgül)</span>
            <textarea
              className="mt-1 w-full min-h-20 font-mono text-xs rounded-xl border border-zinc-200 px-3 py-2"
              placeholder="https://..."
              value={imageUrls}
              onChange={(e) => setImageUrls(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-700">Ses URL (isteğe)</span>
            <input
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "…" : "Havuza gönder"}
          </button>
        </div>
      </div>
    </div>
  );
}
