import Link from "next/link";
import { AuthEntryLink } from "./AuthEntryLink";
import { RegisterNavLink } from "./AuthNavLinks";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-paper-200 bg-paper-50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-paper-800/50">
              Panele git
            </div>
            <ul className="mt-3 space-y-2 text-sm text-paper-800">
              <li>
                <AuthEntryLink path="/student/panel" className="hover:underline">
                  Öğrenci
                </AuthEntryLink>
              </li>
              <li>
                <AuthEntryLink path="/teacher" className="hover:underline">
                  Öğretmen
                </AuthEntryLink>
              </li>
              <li>
                <AuthEntryLink path="/guardian" className="hover:underline">
                  Veli
                </AuthEntryLink>
              </li>
              <li>
                <RegisterNavLink className="hover:underline">Öğretmen kaydı</RegisterNavLink>
              </li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-paper-800/50">
              Keşfet
            </div>
            <ul className="mt-3 space-y-2 text-sm text-paper-800">
              <li>
                <Link href="/ogretmenler" className="hover:underline">
                  Öğretmen ara
                </Link>
              </li>
              <li>
                <Link href="/courses" className="hover:underline">
                  Kurslar
                </Link>
              </li>
              <li>
                <Link href="/kampanyalar" className="hover:underline">
                  Öğretmen kampanyaları
                </Link>
              </li>
              <li>
                <Link href="/fiyatlar" className="hover:underline">
                  Fiyatlar
                </Link>
              </li>
              <li>
                <Link href="/guven" className="hover:underline">
                  Güven merkezi
                </Link>
              </li>
              <li>
                <Link href="/kampanya" className="hover:underline">
                  Kampanya
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-paper-800/50">
              Yardım ve yasal
            </div>
            <ul className="mt-3 space-y-2 text-sm text-paper-800">
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
                <Link href="/uygulama" className="hover:underline">
                  Uygulamayı yükle
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-10 border-t border-paper-200 pt-6 text-center text-xs text-paper-800/55">
          © {new Date().getFullYear()} BenimÖğretmenim
        </p>
      </div>
    </footer>
  );
}
