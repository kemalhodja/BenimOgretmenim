import Link from "next/link";

const faq = [
  {
    q: "Öğretmen nasıl seçilir?",
    a: "Öğretmen bul sayfasından branş ve şehir filtreleyin; profili ve yorumları inceleyin. Ders talebi oluşturduğunuzda uygun öğretmenler size teklif gönderir.",
  },
  {
    q: "Teklif ve eşleşme nasıl işler?",
    a: "Talebiniz açıkken birden fazla öğretmen teklif verebilir. Mesajlar bölümünden iletişim kurup uygun teklifi kabul edebilirsiniz.",
  },
  {
    q: "Doğrudan ders anlaşması ve cüzdan nedir?",
    a: "Öğretmen profilinde toplam tutar üzerinden anlaşma kurabilirsiniz; ödeme öğrenci cüzdanından bloke edilir, dersi öğretmen tamamlayınca öğretmene aktarılır. Bakiye ve hareketler öğrenci panelindeki cüzdan bölümünden izlenir.",
  },
  {
    q: "Online kurslar (dershane) nasıl çalışır?",
    a: "Yayınlanmış kurslar herkese açık listede yer alır. Kursa kayıt olduktan sonra grubunuz (cohort) için planlanan canlı oturumlara katılım linkleri öğrenci kurs sayfasında görünür; öğretmen tarafında kurs ve oturum yönetimi panelden yapılır.",
  },
  {
    q: "Öğretmen aboneliği neden var?",
    a: "Belirli süre içinde sınırlı teklif hakkı vardır; abonelik ile daha fazla talebe erişim ve platform özellikleri açılır. Ödeme PayTR veya havale ile yapılabilir.",
  },
  {
    q: "Veli ne görür?",
    a: "Öğrencinizle ilişkilendirildiğinizde gelişim özetleri ve ders sonu bildirimleri veli panelinde listelenir.",
  },
];

export default function YardimPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
        Yardım
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        Sık sorulan sorular. Destek talepleri için iletişim kanalınızı
        yapılandırınca buraya ekleyebilirsiniz.
      </p>
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
          Doğrudan ders anlaşmalarım
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
