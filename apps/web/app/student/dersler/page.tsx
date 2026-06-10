"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { loginHrefWithReturn } from "../../lib/authRedirect";
import { clearToken, getToken } from "../../lib/auth";

type ReviewableSession = {
  lesson_session_id: string;
  session_index: number;
  scheduled_start: string | null;
  actual_end: string | null;
  status: string;
  package_id: string;
  teacher_id: string;
  teacher_display_name: string;
};

type PastReview = {
  review_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  lesson_session_id: string;
  session_index: number;
  teacher_id: string;
  teacher_display_name: string;
};

type StudentPackage = {
  id: string;
  status: string;
  payment_status: string;
  total_lessons: number;
  completed_lessons: number;
  request_kind?: "regular" | "demo";
  source_request_id: string | null;
  created_at: string;
  teacher_id: string;
  teacher_display_name: string;
};

type PackageSession = {
  id: string;
  session_index: number;
  scheduled_start: string | null;
  scheduled_end: string | null;
  duration_minutes: number | null;
  delivery_mode: string;
  meeting_url: string | null;
  status: string;
};

function toLocal(dt: string | null): string {
  if (!dt) return "Planlanmadı";
  return new Date(dt).toLocaleString("tr-TR");
}

function paymentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    held_in_escrow: "Cüzdanda güvencede",
    pending: "Ödeme bekliyor",
    released: "Öğretmene aktarıldı",
    refunded: "İade edildi",
  };
  return labels[status] ?? status;
}

function packageStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: "Aktif paket",
    completed: "Tamamlandı",
    cancelled: "İptal edildi",
    expired: "Süresi doldu",
  };
  return labels[status] ?? "Durum güncellendi";
}

function sessionStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    scheduled: "Planlandı",
    completed: "Tamamlandı",
    cancelled: "İptal edildi",
    missed: "Kaçırıldı",
  };
  return labels[status] ?? "Durum güncellendi";
}

function deliveryModeLabel(mode: string): string {
  const labels: Record<string, string> = {
    online: "Online",
    in_person: "Yüz yüze",
    hybrid: "Online veya yüz yüze",
  };
  return labels[mode] ?? mode;
}

export default function StudentDerslerPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [token, setToken] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ReviewableSession[]>([]);
  const [pastReviews, setPastReviews] = useState<PastReview[]>([]);
  const [packages, setPackages] = useState<StudentPackage[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<string | null>(null);
  const [packageSessions, setPackageSessions] = useState<PackageSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace(loginHrefWithReturn(pathname));
      return;
    }
    setToken(t);
  }, [router, pathname]);

  const load = useCallback(async (t: string) => {
    setError(null);
    setOk(null);
    const [r, past, pkg] = await Promise.all([
      apiFetch<{ sessions: ReviewableSession[] }>("/v1/lesson-sessions/reviewable", {
        token: t,
      }),
      apiFetch<{ reviews: PastReview[] }>("/v1/lesson-sessions/my-reviews", {
        token: t,
      }),
      apiFetch<{ packages: StudentPackage[] }>("/v1/packages/student/mine", {
        token: t,
      }),
    ]);
    setSessions(r.sessions);
    setPastReviews(past.reviews);
    setPackages(pkg.packages);
  }, []);

  const selected = useMemo(
    () => packages.find((x) => x.id === selectedPkg) ?? packages[0] ?? null,
    [packages, selectedPkg],
  );

  useEffect(() => {
    if (!selected || selectedPkg) return;
    setSelectedPkg(selected.id);
  }, [selected, selectedPkg]);

  const loadPackageSessions = useCallback(async (t: string, packageId: string) => {
    const r = await apiFetch<{ sessions: PackageSession[] }>(
      `/v1/packages/${packageId}/sessions`,
      { token: t },
    );
    setPackageSessions(r.sessions);
  }, []);

  useEffect(() => {
    if (!token || !selectedPkg) return;
    loadPackageSessions(token, selectedPkg).catch((e) => {
      const msg = e instanceof Error ? e.message : "load_package_sessions_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Bu ders paketine erişim izniniz yok.");
      }
    });
  }, [token, selectedPkg, loadPackageSessions, router, pathname]);

  useEffect(() => {
    if (!token) return;
    load(token).catch((e) => {
      const msg = e instanceof Error ? e.message : "load_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
        return;
      }
      if (msg.includes("[403]")) {
        setError("Bu sayfa yalnızca öğrenci hesabı içindir.");
      }
    });
  }, [token, load, router, pathname]);

  async function submitReview(sessionId: string) {
    if (!token) return;
    const rating = ratings[sessionId];
    if (rating == null || rating < 1 || rating > 5) {
      setError("Lütfen 1–5 arası bir puan seçin.");
      return;
    }
    setBusyId(sessionId);
    setError(null);
    setOk(null);
    try {
      await apiFetch(`/v1/lesson-sessions/${sessionId}/review`, {
        method: "POST",
        token,
        body: JSON.stringify({
          rating,
          comment: comments[sessionId]?.trim() || null,
        }),
      });
      setOk("Yorumunuz kaydedildi; öğretmen profilinde görünür.");
      await load(token);
      setRatings((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
      setComments((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "submit_failed";
      setError(msg);
      if (msg.includes("[401]")) {
        clearToken();
        router.replace(loginHrefWithReturn(pathname));
      }
      if (msg.includes("[403]")) {
        setError("Bu ders oturumuna yorum bırakma izniniz yok.");
      }
    } finally {
      setBusyId(null);
    }
  }

  if (!token) return null;

  const activePackageCount = packages.filter((pkg) => pkg.status === "active").length;
  const escrowPackageCount = packages.filter((pkg) => pkg.payment_status === "held_in_escrow").length;
  const demoPackageCount = packages.filter((pkg) => pkg.request_kind === "demo").length;
  const upcomingSession =
    packageSessions
      .filter((session) => session.status === "scheduled" && session.scheduled_start)
      .sort((a, b) => new Date(a.scheduled_start ?? 0).getTime() - new Date(b.scheduled_start ?? 0).getTime())[0] ?? null;
  const waitingSession = packageSessions.find(
    (session) => session.status === "scheduled" && !session.scheduled_start,
  );
  const nextAction = sessions.length > 0
    ? {
        title: "Tamamlanan ders için yorum bırakın",
        body: "Geri bildiriminiz öğretmen profil kalitesine katkı verir ve sonraki seçimlerinizi kolaylaştırır.",
      }
    : upcomingSession
      ? {
          title: `Sıradaki ders: #${upcomingSession.session_index}`,
          body: `${toLocal(upcomingSession.scheduled_start)} tarihinde sınıf bağlantısı bu panelde hazır.`,
        }
      : waitingSession
        ? {
            title: "Öğretmen planlamasını bekliyorsunuz",
            body: "Öğretmen tarihi belirlediğinde size ve velinize bildirim düşecek.",
          }
        : selected
          ? {
              title: "Paketiniz güncel",
              body: "Dersleri, ödeme durumunu ve talep sohbetini bu ekrandan takip edebilirsiniz.",
            }
          : {
              title: "Ders paketi bekleniyor",
              body: "Öğretmen teklifini kabul ettiğinizde ders paketi burada oluşur.",
            };

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Derslerim</h1>
          <p className="mt-1 text-sm text-paper-800/75">
            Demo ve normal derslerinizi, ders bağlantılarını ve tamamlanan ders yorumlarını buradan takip edin.
          </p>
          <p className="mt-2 text-sm text-paper-800/65">
            Diğer işlemler üst menüden. Ödeme ve bakiye:{" "}
            <Link href="/student/panel" className="font-medium text-brand-800 underline-offset-4 hover:underline">
              özet / cüzdan
            </Link>
            .
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        {ok && (
          <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
            {ok}
          </div>
        )}

        <section className="mt-6 rounded-2xl border border-brand-200 bg-[linear-gradient(135deg,#ecfeff_0%,#ffffff_58%,#fff7ed_100%)] p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-900/70">Ders asistanı</div>
              <h2 className="mt-1 text-lg font-semibold text-paper-900">{nextAction.title}</h2>
              <p className="mt-1 max-w-2xl text-sm text-paper-800/70">{nextAction.body}</p>
            </div>
            {selected?.source_request_id ? (
              <Link
                href={`/student/requests/${selected.source_request_id}`}
                className="w-fit rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-950 hover:bg-brand-100"
              >
                Talep detayına git
              </Link>
            ) : null}
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-paper-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">Aktif paket</div>
            <div className="mt-1 text-2xl font-semibold text-paper-900">{activePackageCount}</div>
          </div>
          <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-brand-900/65">Güvende ödeme</div>
            <div className="mt-1 text-2xl font-semibold text-brand-950">{escrowPackageCount}</div>
          </div>
          <div className="rounded-xl border border-paper-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">Demo ders</div>
            <div className="mt-1 text-2xl font-semibold text-paper-900">{demoPackageCount}</div>
          </div>
          <div className="rounded-xl border border-warm-200 bg-warm-50/70 p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-warm-900/70">Yorum bekleyen</div>
            <div className="mt-1 text-2xl font-semibold text-warm-950">{sessions.length}</div>
          </div>
        </section>

        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-paper-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-paper-900">Ders paketleri</h2>
            <p className="mt-1 text-xs text-paper-800/55">
              Demo dersi kabul ettiğinizde burada 30 dakikalık tek oturum olarak görünür.
            </p>
            <div className="mt-4 space-y-2">
              {packages.length === 0 ? (
                <div className="text-sm text-paper-800/75">Henüz ders paketi yok.</div>
              ) : (
                packages.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPkg(p.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                      selectedPkg === p.id
                        ? "border-brand-200 bg-brand-50"
                        : "border-paper-100 bg-paper-50 hover:bg-paper-100"
                    }`}
                  >
                    <div className="font-medium text-paper-900">
                      {p.teacher_display_name} · {p.completed_lessons}/{p.total_lessons}
                    </div>
                    {p.request_kind === "demo" && (
                      <div className="mt-1 inline-flex rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-900">
                        Demo ders
                      </div>
                    )}
                    <div className="mt-0.5 text-xs text-paper-800/55">
                      {packageStatusLabel(p.status)} · ödeme: {paymentStatusLabel(p.payment_status)} ·{" "}
                      {new Date(p.created_at).toLocaleString("tr-TR")}
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl border border-paper-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-paper-900">Oturumlar</h2>
            {!selected ? (
              <div className="mt-4 text-sm text-paper-800/75">Bir ders paketi seçin.</div>
            ) : (
              <>
                <div className="mt-3 rounded-xl border border-paper-100 bg-paper-50 p-3 text-sm">
                  <div className="font-medium text-paper-900">{selected.teacher_display_name}</div>
                  <div className="mt-1 text-xs text-paper-800/75">
                    {selected.request_kind === "demo" ? "Demo ders" : "Paket"}:{" "}
                    {selected.completed_lessons}/{selected.total_lessons} · {packageStatusLabel(selected.status)} ·{" "}
                    {paymentStatusLabel(selected.payment_status)}
                  </div>
                  {selected.source_request_id && (
                    <Link
                      href={`/student/requests/${selected.source_request_id}`}
                      className="mt-2 inline-block text-xs font-medium text-brand-800 underline"
                    >
                      Talep detayına git
                    </Link>
                  )}
                  {selected.request_kind === "demo" && selected.status === "completed" && (
                    <div className="mt-3 rounded-lg border border-brand-100 bg-white p-3">
                      <div className="text-xs font-semibold text-paper-900">
                        Demo sonrası önerilen adımlar
                      </div>
                      <p className="mt-1 text-xs text-paper-800/65">
                        Öğretmenle devam paketi için talep sohbetinden ilerleyin veya farklı seçenekleri
                        karşılaştırın.
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selected.source_request_id && (
                          <Link
                            href={`/student/requests/${selected.source_request_id}`}
                            className="rounded-lg bg-brand-800 px-2.5 py-1.5 text-xs font-medium text-white"
                          >
                            Paket için konuş
                          </Link>
                        )}
                        <Link
                          href="/ogretmenler"
                          className="rounded-lg border border-paper-300 bg-white px-2.5 py-1.5 text-xs font-medium text-paper-900"
                        >
                          Başka öğretmen dene
                        </Link>
                        <Link
                          href="/student/odev-sor"
                          className="rounded-lg border border-paper-300 bg-white px-2.5 py-1.5 text-xs font-medium text-paper-900"
                        >
                          Ödev desteği al
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-2">
                  {packageSessions.length === 0 ? (
                    <div className="text-sm text-paper-800/75">Oturum yok.</div>
                  ) : (
                    packageSessions.map((s) => (
                      <div
                        key={s.id}
                        className="rounded-xl border border-paper-100 bg-paper-50 px-3 py-2 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-medium text-paper-900">
                            {s.session_index}. ders · {sessionStatusLabel(s.status)}
                          </div>
                          <div className="text-xs text-paper-800/55">
                            {toLocal(s.scheduled_start)}
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-paper-800/75">
                          {deliveryModeLabel(s.delivery_mode)} · süre: {s.duration_minutes ?? "—"} dk
                        </div>
                        {s.meeting_url && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Link
                              href={`/classroom/lesson/${s.id}`}
                              className="inline-block rounded-lg bg-brand-800 px-2.5 py-1.5 text-xs font-medium text-white"
                            >
                              Sınıfa gir
                            </Link>
                            <a
                              href={s.meeting_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-block text-xs font-medium text-brand-800 underline"
                            >
                              Dış bağlantı
                            </a>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </section>
        </div>

        <div className="mt-10 space-y-4">
          <h2 className="text-base font-semibold text-paper-900">Yorum bekleyen dersler</h2>
          {sessions.length === 0 ? (
            <div className="rounded-xl border border-paper-200 bg-white p-6 text-sm text-paper-800/75 shadow-sm">
              Yorum yazılabilecek tamamlanmış ders yok. Paketinizdeki dersler tamamlandıkça
              burada listelenir.
            </div>
          ) : (
            sessions.map((s) => {
              const when =
                s.actual_end ?? s.scheduled_start ?? null;
              const whenLabel = when
                ? new Date(when).toLocaleString("tr-TR")
                : "—";
              return (
                <div
                  key={s.lesson_session_id}
                  className="rounded-xl border border-paper-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-paper-900">
                        {s.teacher_display_name}
                      </div>
                      <div className="mt-1 text-xs text-paper-800/55">
                        {s.session_index}. ders · {whenLabel}
                      </div>
                      <Link
                        href={`/ogretmenler/${s.teacher_id}`}
                        className="mt-2 inline-block text-xs font-medium text-brand-800 underline"
                      >
                        Öğretmen profili
                      </Link>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="text-xs font-medium text-paper-800/75">Puan:</span>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        disabled={busyId === s.lesson_session_id}
                        onClick={() =>
                          setRatings((prev) => ({
                            ...prev,
                            [s.lesson_session_id]: n,
                          }))
                        }
                        className={`rounded-lg px-2.5 py-1 text-sm font-medium ${
                          ratings[s.lesson_session_id] === n
                            ? "bg-brand-700 text-white"
                            : "border border-paper-200 bg-paper-50 text-paper-800 hover:bg-paper-100"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <label className="mt-3 block">
                    <span className="text-xs font-medium text-paper-800/75">
                      Yorum (isteğe bağlı)
                    </span>
                    <textarea
                      value={comments[s.lesson_session_id] ?? ""}
                      disabled={busyId === s.lesson_session_id}
                      onChange={(e) =>
                        setComments((prev) => ({
                          ...prev,
                          [s.lesson_session_id]: e.target.value,
                        }))
                      }
                      rows={3}
                      className="mt-1 w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
                      placeholder="Kısa geri bildiriminiz…"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busyId === s.lesson_session_id}
                    onClick={() => void submitReview(s.lesson_session_id)}
                    className="mt-3 rounded-xl bg-brand-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {busyId === s.lesson_session_id ? "Gönderiliyor…" : "Yorumu gönder"}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {pastReviews.length > 0 && (
          <div className="mt-10">
            <h2 className="text-base font-semibold text-paper-900">Gönderdiğim yorumlar</h2>
            <ul className="mt-3 space-y-3">
              {pastReviews.map((pr) => (
                <li
                  key={String(pr.review_id)}
                  className="rounded-xl border border-paper-200 bg-white p-4 text-sm shadow-sm"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-paper-900">
                      {pr.teacher_display_name} · {pr.session_index}. ders
                    </span>
                    <span className="text-xs text-paper-800/55">
                      {new Date(pr.created_at).toLocaleString("tr-TR")}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-amber-800">★ {pr.rating} / 5</div>
                  {pr.comment && (
                    <p className="mt-2 whitespace-pre-wrap text-paper-800">{pr.comment}</p>
                  )}
                  <Link
                    href={`/ogretmenler/${pr.teacher_id}`}
                    className="mt-2 inline-block text-xs font-medium text-brand-800 underline"
                  >
                    Öğretmen profili
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
