import Link from "next/link";
import { RegisterNavLink } from "./AuthNavLinks";

export function SiteFooter() {
  const api =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3002";
  return (
    <footer className="mt-auto border-t border-paper-200/80 bg-paper-100/40">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-paper-800/60">
              Öğrenci
            </div>
            <ul className="mt-3 space-y-2 text-sm text-paper-800/90">
              <li>
                <Link href="/student/requests" className="hover:underline">
                  Talep oluştur
                </Link>
              </li>
              <li>
                <Link href="/student/dersler" className="hover:underline">
                  Ders yorumu
                </Link>
              </li>
              <li>
                <Link href="/student/panel" className="hover:underline">
                  Abonelik (öğrenci)
                </Link>
              </li>
              <li>
                <Link href="/student/odev-sor" className="hover:underline">
                  Soru / ödev gönder
                </Link>
              </li>
              <li>
                <Link href="/student/odev-sor/gonderiler" className="hover:underline">
                  Soru gönderilerim
                </Link>
              </li>
              <li>
                <Link href="/student/dogrudan-dersler" className="hover:underline">
                  Doğrudan ders anlaşmaları
                </Link>
              </li>
              <li>
                <Link href="/student/grup-dersler" className="hover:underline">
                  Grup ders talepleri
                </Link>
              </li>
              <li>
                <Link href="/student/kurslar" className="hover:underline">
                  Kurslarım
                </Link>
              </li>
              <li>
                <Link href="/courses" className="hover:underline">
                  Kurslar
                </Link>
              </li>
              <li>
                <Link href="/ogretmenler" className="hover:underline">
                  Öğretmen ara
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-paper-800/60">
              Öğretmen
            </div>
            <ul className="mt-3 space-y-2 text-sm text-paper-800/90">
              <li>
                <RegisterNavLink className="hover:underline">Kayıt ol</RegisterNavLink>
              </li>
              <li>
                <Link href="/teacher" className="hover:underline">
                  Panel & abonelik
                </Link>
              </li>
              <li>
                <Link href="/fiyatlar" className="hover:underline">
                  Abonelik fiyatları
                </Link>
              </li>
              <li>
                <Link href="/teacher/requests" className="hover:underline">
                  Açık talepler
                </Link>
              </li>
              <li>
                <Link href="/teacher/teklifler" className="hover:underline">
                  Verdiğim teklifler
                </Link>
              </li>
              <li>
                <Link href="/teacher/kurslar" className="hover:underline">
                  Online kurslar
                </Link>
              </li>
              <li>
                <Link href="/teacher/dersler" className="hover:underline">
                  Ders oturumları
                </Link>
              </li>
              <li>
                <Link href="/teacher/cuzdan" className="hover:underline">
                  Cüzdan
                </Link>
              </li>
              <li>
                <Link href="/teacher/dogrudan-dersler" className="hover:underline">
                  Doğrudan ders anlaşmaları
                </Link>
              </li>
              <li>
                <Link href="/teacher/odev-havuzu" className="hover:underline">
                  Soru / ödev havuzu
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-paper-800/60">
              Veli
            </div>
            <ul className="mt-3 space-y-2 text-sm text-paper-800/90">
              <li>
                <Link href="/guardian" className="hover:underline">
                  Gelişim özeti
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-paper-800/60">
              Operasyon
            </div>
            <ul className="mt-3 space-y-2 text-sm text-paper-800/90">
              <li>
                <Link href="/uygulama" className="hover:underline">
                  Telefona ekle (PWA)
                </Link>
              </li>
              <li>
                <Link href="/yardim" className="hover:underline">
                  Yardım
                </Link>
              </li>
              <li>
                <Link href="/iletisim" className="hover:underline">
                  İletişim
                </Link>
              </li>
              <li>
                <Link href="/gizlilik" className="hover:underline">
                  Gizlilik
                </Link>
              </li>
              <li>
                <Link href="/kullanim-kosullari" className="hover:underline">
                  Kullanım koşulları
                </Link>
              </li>
              <li>
                <Link href="/admin/bank" className="hover:underline">
                  Havale onayı (admin)
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-2 border-t border-paper-200/80 pt-6 text-xs text-paper-800/60 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} BenimÖğretmenim</span>
          <span className="font-mono text-[10px] text-paper-800/45">API: {api}</span>
        </div>
      </div>
    </footer>
  );
}
