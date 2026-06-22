import Link from "next/link";
import { AuthEntryLink } from "../AuthEntryLink";

export function StudentAudienceCard() {
  return (
    <div className="rounded-2xl border border-paper-200 bg-white p-8 shadow-sm">
      <h2 className="text-xl font-semibold text-paper-900">Öğrenci ve veli</h2>
      <p className="mt-3 text-sm leading-relaxed text-paper-800/85">
        Talep açın, teklifleri karşılaştırın. Veliler bağlı öğrencinin özetini görür.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <AuthEntryLink
          path="/student/panel"
          className="rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-900"
        >
          Öğrenci paneli
        </AuthEntryLink>
        <AuthEntryLink
          path="/student/requests"
          className="rounded-xl border border-paper-300 bg-white px-4 py-2.5 text-sm font-medium text-paper-900 hover:bg-paper-50"
        >
          Talep oluştur
        </AuthEntryLink>
        <AuthEntryLink
          path="/guardian"
          className="rounded-xl border border-paper-300 bg-white px-4 py-2.5 text-sm font-medium text-paper-900 hover:bg-paper-50"
        >
          Veli paneli
        </AuthEntryLink>
      </div>
      <p className="mt-5 text-sm text-paper-800/70">
        <Link href="/courses" className="font-medium text-brand-800 underline underline-offset-2">
          Kurs vitrini
        </Link>
        {" · "}
        <AuthEntryLink path="/student/panel" className="font-medium text-brand-800 underline underline-offset-2">
          Abonelik
        </AuthEntryLink>
      </p>
    </div>
  );
}

export function TeacherAudienceCard() {
  return (
    <div className="rounded-2xl border border-paper-200 bg-white p-8 shadow-sm">
      <h2 className="text-xl font-semibold text-paper-900">Öğretmen</h2>
      <p className="mt-3 text-sm leading-relaxed text-paper-800/85">
        Taleplere teklif verin. Abonelikle sınırsız teklif; ödeme kart veya havale.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <AuthEntryLink
          path="/teacher"
          className="rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-900"
        >
          Panele git
        </AuthEntryLink>
        <AuthEntryLink
          path="/teacher/requests"
          className="rounded-xl border border-paper-300 bg-white px-4 py-2.5 text-sm font-medium text-paper-900 hover:bg-paper-50"
        >
          Açık talepler
        </AuthEntryLink>
      </div>
      <p className="mt-5 text-sm text-paper-800/70">
        <AuthEntryLink path="/fiyatlar" className="font-medium text-brand-800 underline underline-offset-2">
          Abonelik fiyatları
        </AuthEntryLink>
        {" · "}
        <AuthEntryLink path="/teacher/kurslar" className="font-medium text-brand-800 underline underline-offset-2">
          Kurslarım
        </AuthEntryLink>
      </p>
    </div>
  );
}
