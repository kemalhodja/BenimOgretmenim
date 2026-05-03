import Link from "next/link";

export function StudentAudienceCard() {
  return (
    <div className="rounded-2xl border border-paper-200/90 bg-white/80 p-8 shadow-sm ring-1 ring-paper-100/80">
      <h2 className="text-xl font-semibold text-paper-900">Öğrenci ve veli</h2>
      <p className="mt-3 text-sm leading-relaxed text-paper-800/80">
        Profil ve teklifler tek ekranda. Veli: özet ve bildirimler.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/student/requests"
          className="rounded-xl bg-brand-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-950"
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
    <div className="rounded-2xl border border-warm-200/80 bg-gradient-to-b from-warm-50/90 to-amber-50/30 p-8 shadow-sm ring-1 ring-warm-100/50">
      <h2 className="text-xl font-semibold text-paper-900">Öğretmen</h2>
      <p className="mt-3 text-sm leading-relaxed text-paper-800/80">
        Taleplere teklif ver. Abonelik: sınırsız teklif. Ödeme: PayTR veya doğrudan havale.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/teacher"
          className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-medium text-white"
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
