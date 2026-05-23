"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { useRequireAdmin } from "./useRequireAdmin";

type Overview = {
  usersByRole: Record<string, number>;
  counts: {
    usersTotal: number;
    teachers: number;
    students: number;
    coursesPublished: number;
    coursesDraft: number;
    lessonRequestsOpen: number;
    lessonRequestsMatched: number;
    groupLessonRequestsOpen: number;
    pendingBankPayments: number;
    pendingSubscriptionPayments: number;
    activeTeacherSubscriptions: number;
    lessonPackagesActive: number;
    activeStudentSubscriptions: number;
    walletsWithBalance: number;
    walletBalanceSumMinor: string;
    homeworkPostsActive: number;
    directBookingsInFlight: number;
    parentNotificationsUnread: number;
    openDemoRequests: number;
    unansweredDemoRequests: number;
    pendingTeacherVerification: number;
    weakTeacherProfiles: number;
  };
  generatedAt: string;
};

function StatCard({
  href,
  label,
  value,
  hint,
}: {
  href: string;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-paper-200 bg-white p-4 transition hover:border-brand-200 hover:bg-paper-50/60"
    >
      <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-paper-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-paper-800/55">{hint}</div> : null}
    </Link>
  );
}

export default function AdminDashboardPage() {
  const token = useRequireAdmin();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const r = await apiFetch<Overview>("/api/admin/overview", { token });
        if (!cancelled) setData(r);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "yüklenemedi");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) return null;

  const c = data?.counts;
  const roles = data?.usersByRole ?? {};

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Özet</h1>
          <Link
            href="/admin/merkez"
            className="text-sm font-medium text-brand-800 underline decoration-brand-400 underline-offset-4"
          >
            Kontrol merkezi
          </Link>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-paper-800/75">
          Kullanıcılar, içerik ve operasyon metrikleri. Tam liste ve aksiyonlar için kontrol merkezini açın.
        </p>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : null}

        {!data && !error ? (
          <p className="mt-6 text-sm text-paper-800/55">Özet yükleniyor…</p>
        ) : null}

        {c ? (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard href="/admin/users" label="Kayıtlı kullanıcı" value={c.usersTotal} />
              <StatCard href="/admin/teachers" label="Öğretmen profili" value={c.teachers} />
              <StatCard href="/admin/users" label="Öğrenci profili" value={c.students} hint="students tablosu" />
              <StatCard
                href="/admin/requests"
                label="Açık ders talebi"
                value={c.lessonRequestsOpen}
                hint={`Eşleşmiş: ${c.lessonRequestsMatched}`}
              />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard href="/admin/bank" label="Bekleyen havale" value={c.pendingBankPayments} />
              <StatCard
                href="/admin/payments"
                label="Bekleyen abonelik ödemesi"
                value={c.pendingSubscriptionPayments ?? 0}
                hint="Tüm yöntemler (pending)"
              />
              <StatCard
                href="/admin/wallet"
                label="Cüzdanı dolu kullanıcı"
                value={c.walletsWithBalance}
                hint={`Toplam bakiye (minor): ${c.walletBalanceSumMinor}`}
              />
              <StatCard
                href="/admin/courses"
                label="Yayında kurs"
                value={c.coursesPublished}
                hint={`Taslak: ${c.coursesDraft}`}
              />
              <StatCard
                href="/admin/teachers"
                label="Aktif öğretmen aboneliği"
                value={c.activeTeacherSubscriptions}
              />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                href="/admin/requests"
                label="Açık demo talebi"
                value={c.openDemoRequests ?? 0}
                hint={`Yanıtsız: ${c.unansweredDemoRequests ?? 0}`}
              />
              <StatCard
                href="/admin/teachers"
                label="Doğrulama bekleyen"
                value={c.pendingTeacherVerification ?? 0}
                hint="Öğretmen kalite kuyruğu"
              />
              <StatCard
                href="/admin/teachers"
                label="Zayıf öğretmen profili"
                value={c.weakTeacherProfiles ?? 0}
                hint="Kalite skoru 40 altı"
              />
              <StatCard href="/admin/merkez" label="Kalite operasyonu" value="Takip" hint="Demo + profil sağlığı" />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard href="/admin/group-lessons" label="Açık grup dersi" value={c.groupLessonRequestsOpen} />
              <StatCard
                href="/admin/homework"
                label="Açık ödev gönderisi"
                value={c.homeworkPostsActive ?? 0}
                hint="open + claimed"
              />
              <StatCard
                href="/admin/direct-bookings"
                label="Doğrudan ders (devam eden)"
                value={c.directBookingsInFlight ?? 0}
                hint="funding / funded"
              />
              <StatCard
                href="/admin/veri?k=notifications"
                label="Okunmamış veli bildirimi"
                value={c.parentNotificationsUnread ?? 0}
              />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard href="/admin/users" label="Aktif öğrenci platform aboneliği" value={c.activeStudentSubscriptions} />
              <StatCard href="/admin/users" label="Aktif ders paketi" value={c.lessonPackagesActive} hint="lesson_packages" />
              <StatCard href="/admin/merkez" label="Modül dizini" value="Merkez" hint="Tüm ekranlar" />
              <div className="rounded-xl border border-paper-200 bg-white p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">Rol dağılımı</div>
                <ul className="mt-2 space-y-1 text-sm text-paper-800">
                  {Object.entries(roles).map(([role, n]) => (
                    <li key={role} className="flex justify-between gap-2">
                      <span className="capitalize">{role}</span>
                      <span className="font-mono tabular-nums text-paper-900">{n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-4 text-xs text-paper-800/55">
              Veri anı: {new Date(data!.generatedAt).toLocaleString("tr-TR")}
            </p>
          </>
        ) : null}

        <section className="mt-10 border-t border-paper-200 pt-8">
          <h2 className="text-sm font-semibold text-paper-900">Diğer modüller</h2>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm leading-relaxed">
            <Link
              href="/admin/users"
              className="text-paper-800/75 underline decoration-paper-300 underline-offset-4 hover:text-paper-900"
            >
              Kullanıcılar
            </Link>
            <Link
              href="/admin/teachers"
              className="text-paper-800/75 underline decoration-paper-300 underline-offset-4 hover:text-paper-900"
            >
              Öğretmenler
            </Link>
            <Link
              href="/admin/requests"
              className="text-paper-800/75 underline decoration-paper-300 underline-offset-4 hover:text-paper-900"
            >
              Ders talepleri
            </Link>
            <Link
              href="/admin/bank"
              className="text-paper-800/75 underline decoration-paper-300 underline-offset-4 hover:text-paper-900"
            >
              Havale
            </Link>
            <Link
              href="/admin/wallet"
              className="text-paper-800/75 underline decoration-paper-300 underline-offset-4 hover:text-paper-900"
            >
              Cüzdan grant
            </Link>
            <Link
              href="/admin/courses"
              className="text-paper-800/75 underline decoration-paper-300 underline-offset-4 hover:text-paper-900"
            >
              Kurslar
            </Link>
            <Link
              href="/admin/payments"
              className="text-paper-800/75 underline decoration-paper-300 underline-offset-4 hover:text-paper-900"
            >
              Abonelik ödemeleri
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
