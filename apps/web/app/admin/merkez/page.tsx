"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useRequireAdmin } from "../useRequireAdmin";

type Item = { href: string; title: string; desc: string };
type Overview = {
  counts: {
    openDemoRequests: number;
    unansweredDemoRequests: number;
    pendingTeacherVerification: number;
    weakTeacherProfiles: number;
    pendingBankPayments: number;
    pendingSubscriptionPayments: number;
    parentNotificationsUnread: number;
    homeworkPostsActive: number;
  };
};

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: "Özet ve kimlik",
    items: [
      { href: "/admin", title: "Özet", desc: "Canlı metrikler" },
      { href: "/admin/users", title: "Kullanıcılar", desc: "Arama, rol, rol güncelleme" },
      { href: "/admin/teachers", title: "Öğretmenler", desc: "Doğrulama durumu yönetimi" },
      { href: "/admin/support", title: "Canlı destek", desc: "Kullanıcı mesajları ve yanıt" },
    ],
  },
  {
    title: "Finans ve abonelik",
    items: [
      { href: "/admin/bank", title: "Havale onayı", desc: "Öğretmen aboneliği banka ödemeleri" },
      { href: "/admin/payments", title: "Abonelik ödemeleri", desc: "Tüm subscription_payments" },
      { href: "/admin/wallet", title: "Cüzdan grant", desc: "Manuel bakiye ekleme" },
      { href: "/admin/veri?k=ledger", title: "Cüzdan defteri", desc: "Tüm ledger satırları" },
      { href: "/admin/veri?k=wallet-topups", title: "Cüzdan PayTR yüklemeleri", desc: "wallet_topup_payments" },
      { href: "/admin/veri?k=student-sub-payments", title: "Öğrenci platform ödemeleri", desc: "student_sub_payments" },
    ],
  },
  {
    title: "İçerik ve ders",
    items: [
      { href: "/admin/courses", title: "Kurslar", desc: "Durum yönetimi (taslak / yayın / arşiv)" },
      { href: "/admin/veri?k=enrollments", title: "Kurs kayıtları", desc: "course_enrollments" },
      { href: "/admin/requests", title: "Ders talepleri", desc: "Liste ve iptal (uygun durumlarda)" },
      { href: "/admin/veri?k=packages", title: "Ders paketleri", desc: "lesson_packages" },
      { href: "/admin/direct-bookings", title: "Doğrudan ders anlaşmaları", desc: "Liste ve iptal" },
      { href: "/admin/group-lessons", title: "Grup ders talepleri", desc: "Durum ve iptal" },
      { href: "/admin/homework", title: "Ödev / soru havuzu", desc: "Liste ve iptal" },
    ],
  },
  {
    title: "Abonelik ve bildirim",
    items: [
      { href: "/admin/veri?k=teacher-subs", title: "Öğretmen abonelikleri", desc: "teacher_subscriptions" },
      { href: "/admin/veri?k=notifications", title: "Veli bildirimleri", desc: "parent_notifications" },
    ],
  },
];

export default function AdminMerkezPage() {
  const token = useRequireAdmin();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    apiFetch<Overview>("/api/admin/overview", { token })
      .then((r) => {
        if (!cancelled) setOverview(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "overview_failed");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) return null;

  const c = overview?.counts;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link
          href="/admin"
          className="text-sm font-medium text-brand-800 underline decoration-brand-400 underline-offset-4"
        >
          ← Özet
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-paper-900">Kontrol merkezi</h1>
        <p className="mt-2 text-sm text-paper-800/75">
          Tüm yönetim modülleri ve veri görünümleri. İşlemler API üzerinden audit edilir; üretimde{" "}
          <span className="font-mono">ADMIN_API_SECRET</span> önerilir.
        </p>

        {error ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Operasyon özeti yüklenemedi: {error}
          </div>
        ) : null}

        {c ? (
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-paper-800/55">
              Kritik operasyon kuyruğu
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Açık demo", c.openDemoRequests, "Yanıtsız: " + c.unansweredDemoRequests, "/admin/requests"],
                ["Doğrulama", c.pendingTeacherVerification, "Öğretmen bekliyor", "/admin/teachers"],
                ["Zayıf profil", c.weakTeacherProfiles, "Kalite skoru 40 altı", "/admin/teachers"],
                ["Ödeme bekliyor", c.pendingBankPayments + c.pendingSubscriptionPayments, "Havale + abonelik", "/admin/payments"],
                ["Okunmamış bildirim", c.parentNotificationsUnread, "Veli/öğrenci in-app", "/admin/veri?k=notifications"],
                ["Açık ödev", c.homeworkPostsActive, "Ödev/soru operasyonu", "/admin/homework"],
              ].map(([label, value, hint, href]) => (
                <Link
                  key={String(label)}
                  href={String(href)}
                  className="rounded-xl border border-paper-200 bg-white p-4 transition hover:border-brand-200 hover:bg-paper-50"
                >
                  <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">{label}</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums text-paper-900">{value}</div>
                  <div className="mt-1 text-xs text-paper-800/55">{hint}</div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <div className="mt-8 space-y-10">
          {SECTIONS.map((sec) => (
            <section key={sec.title}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-paper-800/55">{sec.title}</h2>
              <ul className="mt-3 divide-y divide-paper-200 rounded-xl border border-paper-200 bg-white">
                {sec.items.map((it) => (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      className="flex flex-col gap-0.5 px-4 py-3 transition hover:bg-paper-50 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="font-medium text-brand-900">{it.title}</span>
                      <span className="text-sm text-paper-800/55">{it.desc}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
