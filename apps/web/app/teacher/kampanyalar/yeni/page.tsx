"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../../lib/api";
import { loginHrefWithReturn } from "../../../lib/authRedirect";
import { clearToken, getToken } from "../../../lib/auth";

type Branch = { id: number; parent_id: number | null; name: string; slug: string };
type City = { id: number; name: string; slug: string };

function parseTlToMinor(raw: string): number {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return 0;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) throw new Error("Ücret için geçerli bir TL tutarı girin.");
  const minor = Math.round(n * 100);
  if (!Number.isSafeInteger(minor)) throw new Error("Ücret çok yüksek.");
  return minor;
}

function parseOptionalPositiveInt(raw: string, label: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${label} pozitif tam sayı olmalı.`);
  return n;
}

export default function NewTeacherCampaignPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [branchId, setBranchId] = useState<number | "">("");
  const [cityId, setCityId] = useState<number | "">("");
  const [deliveryMode, setDeliveryMode] = useState<"online" | "in_person" | "hybrid">("online");
  const [lessonCount, setLessonCount] = useState("40");
  const [priceTl, setPriceTl] = useState("10000");
  const [capacity, setCapacity] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [billingModel, setBillingModel] = useState<"listing_fee" | "success_fee">("listing_fee");
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

  const loadMeta = useCallback(async () => {
    const [branchRes, cityRes] = await Promise.all([
      apiFetch<{ branches: Branch[] }>("/v1/meta/branches"),
      apiFetch<{ cities: City[] }>("/v1/meta/cities"),
    ]);
    setBranches(branchRes.branches);
    setCities(cityRes.cities);
  }, []);

  useEffect(() => {
    if (!token) return;
    loadMeta().catch((e) => setError(e instanceof Error ? e.message : "meta_load_failed"));
  }, [token, loadMeta]);

  async function create() {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      if (title.trim().length < 3) throw new Error("Başlık en az 3 karakter olmalı.");
      if (description.trim().length < 20) throw new Error("Açıklama en az 20 karakter olmalı.");
      const priceMinor = parseTlToMinor(priceTl);
      const lessonCountValue = parseOptionalPositiveInt(lessonCount, "Ders sayısı");
      const capacityValue = parseOptionalPositiveInt(capacity, "Kontenjan");
      const startsAtIso = startsAt ? new Date(startsAt).toISOString() : null;

      await apiFetch<{ campaign: { id: string; listing_fee_minor: number } }>("/v1/teacher-campaigns", {
        method: "POST",
        token,
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          branchId: branchId === "" ? null : branchId,
          cityId: cityId === "" ? null : cityId,
          deliveryMode,
          lessonCount: lessonCountValue,
          priceMinor,
          currency: "TRY",
          capacity: capacityValue,
          startsAt: startsAtIso,
          billingModel,
        }),
      });
      router.push("/teacher/kampanyalar");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "create_failed";
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
        return;
      }
      if (msg.includes("teacher_subscription_required")) {
        setError("Kampanya yayınlamak için aktif öğretmen aboneliği gerekir.");
      } else if (msg.includes("insufficient_balance")) {
        setError("Sabit yayın ücreti modelinde 1000 TL ilan ücreti gerekir. İsterseniz başarı bedelli modeli seçebilirsiniz.");
      } else if (msg.includes("[403]")) {
        setError("Bu sayfa yalnızca öğretmen hesabı içindir.");
      } else {
        setError(msg);
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
            href="/teacher/kampanyalar"
            className="text-sm font-medium text-brand-800 underline decoration-brand-400 underline-offset-4"
          >
            ← Kampanyalarım
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-paper-900">Yeni kampanya</h1>
          <p className="mt-1 text-sm text-paper-800/75">
            Örneğin “TYT Matematik Kampı, online, 40 ders, 10.000 TL” gibi net bir teklif oluşturun.
          </p>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p>{error}</p>
            {error.includes("cüzdan") ? (
              <Link href="/teacher/cuzdan" className="mt-2 inline-block font-medium underline underline-offset-4">
                Cüzdan yükleme sayfasına git
              </Link>
            ) : null}
          </div>
        ) : null}

        <div className="mt-8 rounded-xl border border-paper-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4">
            <label className="block">
              <div className="mb-1 text-sm font-medium text-paper-800">Kampanya başlığı</div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                placeholder="TYT Matematik Kampı Online"
              />
            </label>

            <label className="block">
              <div className="mb-1 text-sm font-medium text-paper-800">Açıklama</div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-32 w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                placeholder="Kimler için uygun, kaç hafta sürecek, hangi konular işlenecek, öğrenci ne kazanacak?"
              />
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <div className="mb-1 text-sm font-medium text-paper-800">Branş</div>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                >
                  <option value="">Seçiniz</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <div className="mb-1 text-sm font-medium text-paper-800">Şehir</div>
                <select
                  value={cityId}
                  onChange={(e) => setCityId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                >
                  <option value="">Online / tüm Türkiye</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <div className="mb-1 text-sm font-medium text-paper-800">Ders türü</div>
                <select
                  value={deliveryMode}
                  onChange={(e) => setDeliveryMode(e.target.value as "online" | "in_person" | "hybrid")}
                  className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                >
                  <option value="online">Online</option>
                  <option value="in_person">Yüz yüze</option>
                  <option value="hybrid">Hibrit</option>
                </select>
              </label>

              <label className="block">
                <div className="mb-1 text-sm font-medium text-paper-800">Başlangıç tarihi</div>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="block">
                <div className="mb-1 text-sm font-medium text-paper-800">Ders sayısı</div>
                <input
                  value={lessonCount}
                  onChange={(e) => setLessonCount(e.target.value)}
                  inputMode="numeric"
                  className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  placeholder="40"
                />
              </label>

              <label className="block">
                <div className="mb-1 text-sm font-medium text-paper-800">Kampanya fiyatı (TL)</div>
                <input
                  value={priceTl}
                  onChange={(e) => setPriceTl(e.target.value)}
                  inputMode="decimal"
                  className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  placeholder="10000"
                />
              </label>

              <label className="block">
                <div className="mb-1 text-sm font-medium text-paper-800">Kontenjan</div>
                <input
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  inputMode="numeric"
                  className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  placeholder="İsteğe bağlı"
                />
              </label>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
              Kampanya göndermek için aktif öğretmen aboneliği gerekir. Öğrenci kampanya üzerinden kayıt olursa ödeme
              platform cüzdanında güvenli ilerler; ilk ders sonrası iade hakkı vardır, ikinci dersten sonra iade kapanır.
            </div>

            <section className="rounded-2xl border border-paper-200 bg-paper-50 p-4">
              <div className="text-sm font-semibold text-paper-900">Kampanya ödeme modeli</div>
              <p className="mt-1 text-xs leading-relaxed text-paper-800/65">
                Sabit yayın ücretiyle ilanı baştan ödeyebilir veya risksiz başlayıp öğrenci gelirse %10 platform başarı
                bedeliyle devam edebilirsiniz.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setBillingModel("listing_fee")}
                  aria-pressed={billingModel === "listing_fee"}
                  className={`rounded-xl border p-3 text-left ${
                    billingModel === "listing_fee" ? "border-brand-300 bg-white ring-2 ring-brand-100" : "border-paper-200 bg-white/70"
                  }`}
                >
                  <div className="text-sm font-semibold text-paper-950">Sabit yayın ücreti</div>
                  <p className="mt-1 text-xs leading-relaxed text-paper-800/70">
                    İlk kampanya ücretsizdir. Sonraki ilanlarda <span className="line-through text-paper-800/45">8.000 TL</span>{" "}
                    yerine 1000 TL cüzdandan düşülür.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setBillingModel("success_fee")}
                  aria-pressed={billingModel === "success_fee"}
                  className={`rounded-xl border p-3 text-left ${
                    billingModel === "success_fee" ? "border-brand-300 bg-white ring-2 ring-brand-100" : "border-paper-200 bg-white/70"
                  }`}
                >
                  <div className="text-sm font-semibold text-paper-950">Başarı bedelli yayınla</div>
                  <p className="mt-1 text-xs leading-relaxed text-paper-800/70">
                    Yayınlarken ücret ödemezsiniz. Öğrenci derse devam edip iade hakkı kapanınca brüt tutardan %10
                    platform başarı bedeli ayrılır.
                  </p>
                </button>
              </div>
            </section>

            <button
              type="button"
              disabled={saving}
              onClick={() => void create()}
              className="rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "İncelemeye gönderiliyor…" : "Kampanyayı incelemeye gönder"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
