"use client";

import Link from "next/link";
import { useRequireAdmin } from "../useRequireAdmin";

type Item = { href: string; title: string; desc: string };

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
  if (!token) return null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <p className="text-sm font-medium text-zinc-500">Yönetim</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">Kontrol merkezi</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Tüm yönetim modülleri ve veri görünümleri. İşlemler API üzerinden audit edilir; üretimde{" "}
          <span className="font-mono">ADMIN_API_SECRET</span> önerilir.
        </p>

        <div className="mt-8 space-y-10">
          {SECTIONS.map((sec) => (
            <section key={sec.title}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{sec.title}</h2>
              <ul className="mt-3 divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white shadow-sm">
                {sec.items.map((it) => (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      className="flex flex-col gap-0.5 px-4 py-3 transition hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="font-medium text-brand-900">{it.title}</span>
                      <span className="text-sm text-zinc-500">{it.desc}</span>
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
