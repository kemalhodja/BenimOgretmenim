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
      className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50/80"
    >
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-zinc-500">{hint}</div> : null}
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
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-sm font-medium text-zinc-500">Yönetim</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Özet</h1>
          <Link href="/admin/merkez" className="text-sm font-medium text-brand-800 underline">
            Tüm modüller (merkez)
          </Link>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">
          Kullanıcılar, içerik ve operasyon metrikleri. Tam liste ve aksiyonlar için kontrol merkezini açın.
        </p>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : null}

        {!data && !error ? (
          <p className="mt-6 text-sm text-zinc-500">Özet yükleniyor…</p>
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
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Rol dağılımı</div>
                <ul className="mt-2 space-y-1 text-sm text-zinc-700">
                  {Object.entries(roles).map(([role, n]) => (
                    <li key={role} className="flex justify-between gap-2">
                      <span className="capitalize">{role}</span>
                      <span className="font-mono tabular-nums text-zinc-900">{n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-4 text-xs text-zinc-500">
              Veri anı: {new Date(data!.generatedAt).toLocaleString("tr-TR")}
            </p>
          </>
        ) : null}

        <section className="mt-10 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Bölümler</h2>
          <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <li>
              <Link className="font-medium text-brand-800 underline" href="/admin/merkez">
                Kontrol merkezi
              </Link>
              <span className="text-zinc-500"> — tüm modüller ve veri görünümleri</span>
            </li>
            <li>
              <Link className="font-medium text-brand-800 underline" href="/admin/users">
                Kullanıcılar
              </Link>
              <span className="text-zinc-500"> — arama, rol filtresi ve rol güncelleme</span>
            </li>
            <li>
              <Link className="font-medium text-brand-800 underline" href="/admin/teachers">
                Öğretmenler
              </Link>
              <span className="text-zinc-500"> — doğrulama, şehir, halka açık profil</span>
            </li>
            <li>
              <Link className="font-medium text-brand-800 underline" href="/admin/requests">
                Ders talepleri
              </Link>
              <span className="text-zinc-500"> — özet ve liste</span>
            </li>
            <li>
              <Link className="font-medium text-brand-800 underline" href="/admin/bank">
                Havale onayı
              </Link>
            </li>
            <li>
              <Link className="font-medium text-brand-800 underline" href="/admin/wallet">
                Cüzdan grant
              </Link>
            </li>
            <li>
              <Link className="font-medium text-brand-800 underline" href="/admin/courses">
                Kurslar
              </Link>
              <span className="text-zinc-500"> — tüm durumlar, öğretmen ve detay linki</span>
            </li>
            <li>
              <Link className="font-medium text-brand-800 underline" href="/admin/payments">
                Abonelik ödemeleri
              </Link>
              <span className="text-zinc-500"> — PayTR / havale kayıtları</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
