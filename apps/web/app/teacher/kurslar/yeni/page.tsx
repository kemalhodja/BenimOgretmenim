"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../../lib/api";
import { loginHrefWithReturn } from "../../../lib/authRedirect";
import { clearToken, getToken } from "../../../lib/auth";

type Branch = { id: number; parent_id: number | null; name: string; slug: string };

function parseTlToMinor(raw: string): number {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return 0;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) throw new Error("Ücret için geçerli bir sayı girin (TL).");
  const minor = Math.round(n * 100);
  if (!Number.isSafeInteger(minor)) throw new Error("Ücret çok yüksek.");
  return minor;
}

export default function TeacherYeniKursPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [branchId, setBranchId] = useState<number | "">("");
  const [priceTl, setPriceTl] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    loadBranches().catch((e) => setError(e instanceof Error ? e.message : "load_failed"));
  }, [token, loadBranches]);

  async function create() {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      if (title.trim().length < 3) throw new Error("Başlık en az 3 karakter olmalı.");
      const priceMinor = parseTlToMinor(priceTl);
      const r = await apiFetch<{ course: { id: string } }>("/v1/courses", {
        method: "POST",
        token,
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          branchId: branchId === "" ? null : branchId,
          deliveryMode: "online",
          languageCode: "tr",
          priceMinor,
          currency: "TRY",
        }),
      });
      router.push("/teacher/kurslar");
      // ileride: cohort oluştur ekranına yönlendirebiliriz
      void r;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "create_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Kurs oluşturmak için öğretmen hesabı gerekir.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div>
          <Link
            href="/teacher/kurslar"
            className="text-sm font-medium text-brand-800 underline decoration-brand-400 underline-offset-4"
          >
            ← Kurslar
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-paper-900">Yeni kurs</h1>
          <p className="mt-1 text-sm text-paper-800/75">
            Kursu taslak olarak oluşturun; sonra yayınlayıp grup açın.
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8 rounded-xl border border-paper-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4">
            <label className="block">
              <div className="mb-1 text-sm font-medium text-paper-800">Başlık</div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                placeholder="Örn: 8. Sınıf LGS Matematik Kampı"
              />
            </label>

            <label className="block">
              <div className="mb-1 text-sm font-medium text-paper-800">Açıklama</div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-28 w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                placeholder="Hedef, ders planı, seviye, kaynaklar…"
              />
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <div className="mb-1 text-sm font-medium text-paper-800">Branş</div>
                <select
                  value={branchId}
                  onChange={(e) =>
                    setBranchId(e.target.value ? Number(e.target.value) : "")
                  }
                  className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                >
                  <option value="">Seçiniz</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <div className="mb-1 text-sm font-medium text-paper-800">Ücret (TL)</div>
                <input
                  value={priceTl}
                  onChange={(e) => setPriceTl(e.target.value)}
                  inputMode="decimal"
                  className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  placeholder="0"
                />
                <p className="mt-1 text-xs text-paper-800/55">
                  Bu tutar öğrenciye kayıt adımından önce gösterilir; ödeme durumu ilgili panelde takip edilir.
                </p>
              </label>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => void create()}
              className="rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Oluşturuluyor…" : "Kurs oluştur"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

