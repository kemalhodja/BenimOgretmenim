import type { Metadata } from "next";
import Link from "next/link";
import { publicSiteUrl } from "../lib/siteUrl";
import { RoleBasedPricing } from "./RoleBasedPricing";

const fiyatlarUrl = `${publicSiteUrl()}/fiyatlar`;

export const metadata: Metadata = {
  title: "Fiyatlandırma ve kullanım akışları",
  description: "Öğrenci, öğretmen ve veli için üyelik sonrası role özel abonelik ve kullanım akışları.",
  alternates: { canonical: fiyatlarUrl },
  openGraph: {
    title: "Fiyatlandırma ve kullanım akışları · BenimÖğretmenim",
    description: "Fiyatlar üyelikten sonra ilgili kullanıcı rolüne göre panel içinde gösterilir.",
    url: fiyatlarUrl,
    locale: "tr_TR",
    type: "website",
  },
};

const audiencePlans = [
  {
    title: "Öğrenci",
    price: "Fiyat öğrenci panelinde görünür",
    body: "Öğretmen arama, teklif karşılaştırma, soru çözüm havuzu, çalışma planı ve canlı sınıf akışları öğrenci panelinde birleşir.",
    href: "/kayit?role=student",
    cta: "Öğrenci hesabı aç",
  },
  {
    title: "Öğretmen",
    price: "Planlar öğretmen panelinde görünür",
    body: "Profil görünürlüğü, teklif verme, doğrudan ders, grup/kurs akışları ve soru çözüm havuzu ile gelir kanalı oluşturun.",
    href: "/kayit?role=teacher",
    cta: "Öğretmen olarak başvur",
  },
  {
    title: "Veli",
    price: "Takip hesabı",
    body: "Öğrencinin ders bildirimleri, çalışma planı ilerlemesi, deneme ortalaması ve canlı sınıf linklerini takip edin.",
    href: "/kayit?role=guardian",
    cta: "Veli hesabı aç",
  },
] as const;

export default function FiyatlarPage() {
  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight text-paper-900">
          Fiyatlandırma ve kullanım akışları
        </h1>
        <p className="mt-2 max-w-xl text-sm text-paper-800/75">
          Öğrenci, öğretmen ve veli için akışlar ayrıdır; abonelik tutarları sadece giriş yapmış ilgili kullanıcıya
          kendi panelinde gösterilir.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {audiencePlans.map((plan) => (
            <div key={plan.title} className="rounded-2xl border border-paper-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-paper-900">{plan.title}</h2>
              <p className="mt-1 text-sm font-medium text-brand-900">{plan.price}</p>
              <p className="mt-3 text-sm leading-relaxed text-paper-800/75">{plan.body}</p>
              <Link
                href={plan.href}
                className="mt-4 inline-flex rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900"
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-brand-200 bg-brand-50 p-5">
          <h2 className="text-base font-semibold text-brand-950">Öğrenci için demo ders akışı</h2>
          <p className="mt-2 text-sm text-brand-900">
            Öğrenci öğretmen seçer, demo talebi gönderir, öğretmen yanıtlar ve kabul sonrası 30 dakikalık
            online demo oturumu oluşur. Demo sonrası paket, kurs veya ödev desteğine geçilebilir.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/ogretmenler"
              className="rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900"
            >
              Öğretmen seç ve demo talep et
            </Link>
            <Link
              href="/student/requests"
              className="rounded-xl border border-brand-200 bg-white px-4 py-2 text-sm font-medium text-brand-900 hover:bg-brand-100"
            >
              Taleplerim
            </Link>
          </div>
        </div>

        <RoleBasedPricing />

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link href="/kayit?role=teacher" className="rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900">
            Öğretmen kaydı
          </Link>
          <Link
            href="/ogretmenler?verifiedOnly=1&sort=recommended"
            className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-medium text-brand-900 hover:bg-brand-100"
          >
            Doğrulanmış öğretmenleri gör
          </Link>
          <Link
            href="/teacher"
            className="rounded-xl border border-paper-300 bg-white px-4 py-2.5 text-sm font-medium text-paper-900 hover:bg-paper-50"
          >
            Öğretmen paneli
          </Link>
          <Link href="/" className="text-sm font-medium text-paper-800/65 underline-offset-4 hover:text-paper-900">
            Ana sayfa
          </Link>
        </div>
      </div>
    </div>
  );
}
