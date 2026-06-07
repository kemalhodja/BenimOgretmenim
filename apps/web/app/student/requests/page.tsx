"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { clearToken, getToken } from "../../lib/auth";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { trackEvent } from "../../lib/trackEvent";

type Branch = { id: number; parent_id: number | null; name: string; slug: string };

type MyRequest = {
  id: string;
  status: string;
  request_kind?: "regular" | "demo";
  target_teacher_id: string | null;
  target_teacher_display_name: string | null;
  topic_text: string | null;
  branch_id: number;
  city_id: number | null;
  district_id: number | null;
  delivery_mode: string;
  created_at: string;
  offers_count: number;
};

type TeacherBatchRow = {
  id: string;
  display_name: string;
  primary_branch_id: number | null;
  primary_branch_name: string | null;
};

type ShortlistTeacher = { id: string; name: string };

function requestStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    open: "Açık",
    matched: "Eşleşti",
    cancelled: "İptal edildi",
    expired: "Süresi doldu",
    completed: "Tamamlandı",
  };
  return labels[status] ?? "Durum güncellendi";
}

export default function StudentRequestsPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [mine, setMine] = useState<MyRequest[]>([]);
  const [branchId, setBranchId] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [topic, setTopic] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [examTarget, setExamTarget] = useState("");
  const [preferredTimes, setPreferredTimes] = useState("");
  const [contactPreference, setContactPreference] = useState("Platform mesajları");
  const [requestKind, setRequestKind] = useState<"regular" | "demo">("regular");
  const [targetTeacherId, setTargetTeacherId] = useState<string | null>(null);
  const [targetTeacherName, setTargetTeacherName] = useState<string | null>(null);
  const [shortlistTeachers, setShortlistTeachers] = useState<ShortlistTeacher[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const pathWithQuery = useMemo(() => {
    const q = searchParams.toString();
    return q ? `${pathname}?${q}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathWithQuery));
      return;
    }
    setToken(t);
  }, [router, pathWithQuery]);

  const leafBranches = useMemo(() => {
    const hasChild = new Set<number>();
    for (const b of branches) if (b.parent_id != null) hasChild.add(b.parent_id);
    return branches.filter((b) => !hasChild.has(b.id));
  }, [branches]);

  useEffect(() => {
    const raw = searchParams.get("branchId");
    if (!raw) return;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return;
    setBranchId((prev) => (prev === "" ? n : prev));
  }, [searchParams]);

  useEffect(() => {
    const kind = searchParams.get("requestKind") ?? searchParams.get("kind");
    const teacherId = searchParams.get("teacherId");
    if (kind !== "demo" || !teacherId) return;
    setRequestKind("demo");
    setTargetTeacherId(teacherId);
    setTargetTeacherName(searchParams.get("teacherName"));
    setTopic((prev) => prev || "Demo ders");
    setPreferredTimes((prev) => prev || "Hafta içi 18:00-20:00, hafta sonu uygun");
    setNote((prev) => prev || "Demo ders için uygun gün ve saatleri konuşmak istiyorum.");
  }, [searchParams]);

  useEffect(() => {
    const kind = searchParams.get("requestKind") ?? searchParams.get("kind");
    const teacherId = searchParams.get("teacherId");
    if (kind !== "demo" || !teacherId) return;
    let cancelled = false;
    apiFetch<{ teachers: TeacherBatchRow[] }>(`/v1/teachers/batch?ids=${encodeURIComponent(teacherId)}`)
      .then((r) => {
        if (cancelled) return;
        const teacher = r.teachers[0];
        if (!teacher) return;
        setTargetTeacherName((prev) => prev ?? teacher.display_name);
        setBranchId((prev) => (prev === "" && teacher.primary_branch_id != null ? teacher.primary_branch_id : prev));
      })
      .catch(() => {
        /* Demo formu query verisiyle çalışmaya devam eder. */
      });
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    const ids = (searchParams.get("shortlistTeacherIds") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 5);
    if (ids.length === 0) return;
    const names = (searchParams.get("shortlistTeacherNames") ?? "")
      .split("|")
      .map((name) => name.trim())
      .filter(Boolean);
    setRequestKind("regular");
    setShortlistTeachers(ids.map((id, index) => ({ id, name: names[index] ?? `Öğretmen ${index + 1}` })));
    setTopic((prev) => prev || "Özel ders talebi");
    setNote((prev) =>
      prev ||
      `Karşılaştırdığım öğretmenlerden uygun olanlarla görüşmek istiyorum: ${names.length ? names.join(", ") : ids.join(", ")}`,
    );
  }, [searchParams]);

  async function refresh(t: string) {
    const [b, m] = await Promise.all([
      apiFetch<{ branches: Branch[] }>("/v1/meta/branches"),
      apiFetch<{ requests: MyRequest[] }>("/v1/lesson-requests/mine", { token: t }),
    ]);
    setBranches(b.branches);
    setMine(m.requests);
  }

  useEffect(() => {
    if (!token) return;
    refresh(token).catch((e) => {
      const msg = e instanceof Error ? e.message : "load_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathWithQuery));
      }
      if (msg.includes("[403]")) {
        setError("Bu sayfa yalnızca öğrenci hesabı içindir.");
      }
    });
  }, [token, router, pathWithQuery]);

  async function create() {
    if (!token) return;
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      if (branchId === "") throw new Error("Branş seçin");
      if (topic.trim().length < 2) throw new Error("Ders konusu en az 2 karakter olmalı (zorunlu).");
      if (requestKind === "demo" && !targetTeacherId) {
        throw new Error("Demo ders için öğretmen bilgisi eksik.");
      }
      const structuredDetails = [
        gradeLevel.trim() ? `Sınıf/seviye: ${gradeLevel.trim()}` : null,
        examTarget.trim() ? `Hedef: ${examTarget.trim()}` : null,
        preferredTimes.trim() ? `Uygun zaman: ${preferredTimes.trim()}` : null,
        contactPreference.trim() ? `İletişim tercihi: ${contactPreference.trim()}` : null,
        shortlistTeachers.length > 0 ? `Kısa liste: ${shortlistTeachers.map((teacher) => teacher.name).join(", ")}` : null,
        note.trim() ? `Not: ${note.trim()}` : null,
      ].filter(Boolean);
      const availabilityPayload: Record<string, unknown> = preferredTimes.trim()
        ? { preferredTimes: [preferredTimes.trim()] }
        : {};
      if (shortlistTeachers.length > 0) {
        availabilityPayload.shortlistTeacherIds = shortlistTeachers.map((teacher) => teacher.id);
      }
      await apiFetch("/v1/lesson-requests", {
        method: "POST",
        token,
        body: JSON.stringify({
          branchId,
          topic: topic.trim(),
          requestKind,
          targetTeacherId,
          deliveryMode: "online",
          availability: availabilityPayload,
          note: structuredDetails.length > 0 ? structuredDetails.join("\n") : null,
          imageUrls: [],
        }),
      });
      trackEvent("lesson_request_created", {
        entityType: requestKind === "demo" ? "demo_request" : "lesson_request",
        entityId: targetTeacherId ?? undefined,
        metadata: { branchId, requestKind, shortlistCount: shortlistTeachers.length },
      });
      setOk(requestKind === "demo" ? "Demo ders talebi öğretmene gönderildi." : "Talep oluşturuldu.");
      setNote("");
      setGradeLevel("");
      setExamTarget("");
      setPreferredTimes("");
      await refresh(token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "create_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathWithQuery));
      }
      if (msg.includes("[403]")) {
        setError("Talep oluşturmak için öğrenci hesabı gerekir.");
      }
      if (msg.includes("daily_lesson_request_quota_exceeded")) {
        setError("Bugünkü ders ilanı hakkınız doldu. Ücretsiz öğrenciler günde 1 ilan açabilir; yıllık abonelikte bu hak günde 5 ilandır.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (!token) return null;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-paper-900">
              Ders taleplerim
            </h1>
            <p className="mt-1 text-sm text-paper-800/65">
              Branş ve konu zorunlu; teklifler için satıra tıklayın.
            </p>
          </div>
        </header>

        {(error || ok) && (
          <div
            className={`mt-6 rounded-xl border p-4 text-sm ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-brand-200 bg-brand-50 text-brand-800"
            }`}
          >
            {error ?? ok}
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-paper-200 bg-white p-5">
            <h2 className="text-base font-semibold text-paper-900">
              {requestKind === "demo" ? "Demo ders talebi" : "Yeni talep"}
            </h2>
            <p className="mt-1 text-xs text-paper-800/55">
              Sınıf, hedef ve uygun zaman bilgisi öğretmenin hızlı yanıt vermesini sağlar. Medya için{" "}
              <Link className="font-medium text-brand-800 underline-offset-4 hover:underline" href="/student/odev-sor">
                Ödev sorusu
              </Link>
              , gönderiler:{" "}
              <Link
                className="font-medium text-brand-800 underline-offset-4 hover:underline"
                href="/student/odev-sor/gonderiler"
              >
                liste
              </Link>
              .
            </p>
            <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-3 text-xs leading-relaxed text-brand-950">
              Kayıtlı öğrenci ücretsiz olarak günlük 1 ders ilanı açabilir. Yıllık abonelikte bu limit günlük 5 ilana
              çıkar. Demo ders talepleri ilgili öğretmene özel gönderilir.
            </div>
            {requestKind === "demo" && (
              <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">
                {targetTeacherName ? (
                  <>
                    <span className="font-medium">{targetTeacherName}</span> için demo ders talebi
                    oluşturuyorsunuz. Talep yalnızca bu öğretmenin panelinde görünür.
                  </>
                ) : (
                  "Demo ders talebi oluşturuyorsunuz. Talep yalnızca ilgili öğretmenin panelinde görünür."
                )}
              </div>
            )}
            {shortlistTeachers.length > 0 && requestKind !== "demo" && (
              <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">
                <div className="font-medium">Kısa listeniz talebe eklenecek</div>
                <p className="mt-1 text-brand-900/80">
                  {shortlistTeachers.map((teacher) => teacher.name).join(", ")}
                </p>
                <p className="mt-1 text-xs text-brand-900/70">
                  Talep yine açık pazara gider; bu öğretmenler not ve yapılandırılmış availability içinde görünür.
                </p>
              </div>
            )}
            <div className="mt-4 space-y-4">
              <label className="block">
                <div className="mb-1 text-sm font-medium text-paper-900">Branş</div>
                <select
                  value={branchId}
                  onChange={(e) =>
                    setBranchId(e.target.value ? Number(e.target.value) : "")
                  }
                  className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                >
                  <option value="">Seçiniz</option>
                  {leafBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <div className="mb-1 text-sm font-medium text-paper-900">Sınıf / seviye</div>
                  <input
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                    placeholder="Örn. 8. sınıf, 11. sınıf…"
                  />
                </label>

                <label className="block">
                  <div className="mb-1 text-sm font-medium text-paper-900">Hedef</div>
                  <input
                    value={examTarget}
                    onChange={(e) => setExamTarget(e.target.value)}
                    className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                    placeholder="Örn. LGS, YKS, okul yazılısı…"
                  />
                </label>
              </div>

              <label className="block">
                <div className="mb-1 text-sm font-medium text-paper-900">Uygun zaman</div>
                <input
                  value={preferredTimes}
                  onChange={(e) => setPreferredTimes(e.target.value)}
                  className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  placeholder="Örn. Hafta içi 18:00 sonrası, pazar öğleden sonra…"
                />
              </label>

              <label className="block">
                <div className="mb-1 text-sm font-medium text-paper-900">İletişim tercihi</div>
                <select
                  value={contactPreference}
                  onChange={(e) => setContactPreference(e.target.value)}
                  className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                >
                  <option>Platform mesajları</option>
                  <option>Önce demo saatini netleştirelim</option>
                  <option>Veli ile planlama yapılsın</option>
                </select>
              </label>

              <label className="block">
                <div className="mb-1 text-sm font-medium text-paper-900">Konu</div>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  placeholder="Örn. Türev, paragrafta anlam…"
                />
              </label>

              <label className="block">
                <div className="mb-1 text-sm font-medium text-paper-900">Not</div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="min-h-24 w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  placeholder="İsteğe bağlı ayrıntı…"
                />
              </label>

              <button
                onClick={create}
                disabled={saving}
                className="w-full rounded-xl bg-brand-800 px-3 py-2.5 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-50"
              >
                {saving
                  ? "Oluşturuluyor..."
                  : requestKind === "demo"
                    ? "Demo talebi gönder"
                    : "Talep oluştur"}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-paper-200 bg-white p-5">
            <h2 className="text-base font-semibold text-paper-900">Talepler</h2>
            <p className="mt-1 text-xs text-paper-800/55">Detay ve teklifler için satıra tıklayın.</p>
            <div className="mt-3 space-y-2">
              {mine.length === 0 ? (
                <div className="rounded-xl border border-paper-100 bg-paper-50 p-4 text-sm text-paper-800/70">
                  Henüz talep yok. Branş, konu ve uygun zaman bilgisiyle ilk talebinizi oluşturabilirsiniz.
                </div>
              ) : (
                mine.map((r) => (
                  <Link
                    key={r.id}
                    href={`/student/requests/${r.id}`}
                    className="flex items-center justify-between rounded-xl border border-paper-100 px-3 py-2 transition hover:border-brand-200 hover:bg-brand-50/25"
                  >
                    <div>
                      <div className="text-sm font-medium text-paper-900">
                        {r.request_kind === "demo" ? "Demo talebi" : "Ders talebi"}
                      </div>
                      <div className="text-xs text-paper-800/55">
                        {requestStatusLabel(r.status)} · teklif: {r.offers_count}
                      </div>
                      {r.topic_text && (
                        <div className="mt-1 text-xs text-paper-800/65">{r.topic_text}</div>
                      )}
                      {r.target_teacher_display_name && (
                        <div className="mt-1 text-xs text-brand-800">
                          Öğretmen: {r.target_teacher_display_name}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-paper-800/55">
                      {new Date(r.created_at).toLocaleString("tr-TR")}
                    </div>
                  </Link>
                ))
              )}
            </div>
            <div className="mt-4 rounded-lg border border-brand-100 bg-brand-50/60 px-3 py-2 text-xs leading-relaxed text-brand-950">
              Talep detayında gelen teklifleri, öğretmen profillerini ve ödeme adımını birlikte görebilirsiniz.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

