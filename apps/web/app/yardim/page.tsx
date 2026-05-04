import Link from "next/link";

const faq = [
  {
    q: "Öğretmen nasıl seçilir?",
    a: "Branş ve şehir filtreleyin; profili okuyun. Talep açınca öğretmenler teklif gönderir.",
  },
  {
    q: "Teklif ve eşleşme",
    a: "Açık talebe birden fazla teklif gelir. Mesajlaşın, uygun olanı kabul edin.",
  },
  {
    q: "Doğrudan ders ve cüzdan",
    a: "Profilde anlaşma kurarsınız. Tutar cüzdandan bloke olur; ders bitince öğretmene geçer. Hareketler öğrenci panelinde.",
  },
  {
    q: "Online kurslar",
    a: "Kurs listesinden kayıt olun. Canlı oturum linkleri öğrenci kurs sayfasında; yönetim öğretmen panelinde.",
  },
  {
    q: "Öğretmen aboneliği",
    a: "Ücretsiz planda sınırlı teklif vardır. Abonelikle sınırsız teklif. Ödeme: PayTR (kart) veya doğrudan havale/EFT; havalede admin onayı sonrası abonelik açılır.",
  },
  {
    q: "Veli paneli",
    a: "Bağlandığınız öğrenci için özet ve bildirimler listelenir.",
  },
];

export default function YardimPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-sm font-medium text-zinc-500">Site</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">Yardım</h1>
      <p className="mt-2 text-sm text-zinc-600">Sık sorulan sorular.</p>
      <ul className="mt-10 space-y-8">
        {faq.map((item) => (
          <li key={item.q} className="border-b border-zinc-200 pb-8 last:border-0">
            <h2 className="text-base font-semibold text-zinc-900">{item.q}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{item.a}</p>
          </li>
        ))}
      </ul>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/ogretmenler"
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          Öğretmen ara
        </Link>
        <Link
          href="/student/requests"
          className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800"
        >
          Talep oluştur
        </Link>
        <Link
          href="/courses"
          className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800"
        >
          Online kurslar
        </Link>
        <Link
          href="/student/dogrudan-dersler"
          className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800"
        >
          Doğrudan dersler
        </Link>
        <Link
          href="/iletisim"
          className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800"
        >
          İletişim
        </Link>
      </div>
    </div>
  );
}
