import Link from "next/link";

export function StudentAudienceCard() {
  return (
    <div className="rounded-2xl border border-brand-200/50 bg-gradient-to-b from-white to-brand-50/15 p-8 shadow-lg shadow-brand-900/6 ring-1 ring-brand-100/70">
      <h2 className="text-xl font-semibold text-paper-900">Öğrenci ve veli</h2>
      <p className="mt-3 text-sm leading-relaxed text-paper-800/80">
        Profil ve teklifler tek ekranda. Veli: özet ve bildirimler.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/student/requests"
          className="rounded-xl bg-gradient-to-r from-brand-800 to-brand-700 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-brand-900/25 transition hover:from-brand-900 hover:to-brand-800"
        >
          Talep başlat
        </Link>
        <Link
          href="/guardian"
          className="rounded-xl border border-paper-200 bg-white px-4 py-2.5 text-sm font-medium text-paper-800"
        >
          Veli paneli
        </Link>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <Link href="/courses" className="font-medium text-brand-800 underline">
          Kurslar
        </Link>
        <Link href="/student/panel" className="font-medium text-paper-800/90 underline">
          Abonelik & cüzdan
        </Link>
        <Link href="/student/dogrudan-dersler" className="font-medium text-paper-800/90 underline">
          Doğrudan ders anlaşmaları
        </Link>
        <Link href="/student/kurslar" className="font-medium text-paper-800/90 underline">
          Kayıtlı kurslarım
        </Link>
      </div>
    </div>
  );
}

export function TeacherAudienceCard() {
  return (
    <div className="rounded-2xl border border-warm-300/55 bg-gradient-to-br from-warm-50 via-white to-brand-50/30 p-8 shadow-lg shadow-warm-600/10 ring-1 ring-warm-200/60">
      <h2 className="text-xl font-semibold text-paper-900">Öğretmen</h2>
      <p className="mt-3 text-sm leading-relaxed text-paper-800/80">
        Taleplere teklif ver. Abonelik: sınırsız teklif. Ödeme: PayTR veya doğrudan havale.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/teacher"
          className="rounded-xl bg-gradient-to-r from-brand-700 to-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-brand-900/20 transition hover:from-brand-800 hover:to-brand-700"
        >
          Panele git
        </Link>
        <Link
          href="/teacher/requests"
          className="rounded-xl border border-brand-300 bg-white px-4 py-2.5 text-sm font-medium text-brand-900"
        >
          Talep gelen kutusu
        </Link>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <Link href="/teacher/kurslar" className="font-medium text-brand-900 underline">
          Online kurslar
        </Link>
        <Link href="/teacher/cuzdan" className="font-medium text-brand-900 underline">
          Cüzdan
        </Link>
        <Link href="/teacher/dogrudan-dersler" className="font-medium text-brand-900 underline">
          Doğrudan ders anlaşmaları
        </Link>
        <Link href="/teacher/odev-havuzu" className="font-medium text-brand-900 underline">
          Ödev havuzu
        </Link>
      </div>
    </div>
  );
}
