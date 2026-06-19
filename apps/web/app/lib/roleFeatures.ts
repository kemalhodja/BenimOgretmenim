export type RegisterRole = "student" | "teacher" | "guardian";

/** Kamu vitrin referans sayfası — tüm rol özellik listelerinin tek kaynağı */
export const ROLE_FEATURES_PATH = "/roller" as const;

export type RoleFeatureCard = {
  role: string;
  registerRole?: RegisterRole;
  title: string;
  eyebrow: string;
  summary: string;
  features: readonly string[];
  subscriptionWins: readonly string[];
  nextStep: string;
  href: string;
  cta: string;
};

export const SUBSCRIPTION_WINS_LABEL = "Abonelik / ek kazanımlar" as const;
export const FEATURE_COUNT_LABEL = "Tüm özellikler" as const;

export const ROLE_FEATURE_CARDS: readonly RoleFeatureCard[] = [
  {
    role: "Öğrenci",
    registerRole: "student",
    title: "Ders almak, soru sormak ve ilerlemeni takip etmek",
    eyebrow: "Öğretmen, soru desteği ve çalışma planı",
    summary:
      "Öğrenci hesabı ile öğretmen bulur, ders talebi açar, soru gönderir, kurslara katılır ve tüm süreci tek panelden izlersiniz.",
    features: [
      "Özet panel: bugün ne yapmalıyım, haftalık plan, başarı özeti",
      "Öğretmen arama ve karşılaştırma (branş, şehir, ücret, doğrulama, yorum)",
      "Ders talebinde öğretmen kısa listesi (favori öğretmenlere öncelikli ilan)",
      "AI destekli öğretmen eşleşme önerisi (çalışma sayfası)",
      "Ders talebi, demo ders, gelen teklifleri karşılaştırma ve kabul",
      "Ders paketleri: oturum planlama, canlı sınıfa giriş, ders geçmişi",
      "Doğrudan ders: profilden slot seçerek rezervasyon ve cüzdan ile ödeme",
      "Anlık ders: hazır öğretmenden 10–15 dk kısa oturum (cüzdan ile)",
      "Grup ders talebi oluşturma ve takip",
      "Soru / ödev gönderme (fotoğraf, konu, aciliyet), durum ve memnuniyet",
      "Çalışma planı, kazanım testleri (ünite bazlı), deneme sınavı kayıtları",
      "Online kurslara kayıt, kohort takibi, canlı oturum bağlantıları",
      "Kampanya başvuruları ve durum takibi",
      "Mesajlaşma: öğretmen, ders talebi ve rezervasyon konuşmaları",
      "Canlı sınıf: tahta, notlar, PDF paylaşımı, kayıt tekrarı (varsa)",
      "Ders sonrası değerlendirme ve öğretmen yorumu",
      "Cüzdan: bakiye, kart/havale yükleme, hareket geçmişi",
      "Platform aboneliği: günlük ders ilanı ve soru kotası yönetimi",
      "Veli davet kodu oluşturma (veli hesabını bağlama)",
      "Bildirimler ve hesap ayarları (KVKK talebi dahil)",
      "Canlı destek, iade ve itiraz süreçlerine erişim",
    ],
    subscriptionWins: [
      "Ücretsiz: günlük 1 ders ilanı ve 5 soru",
      "Yıllık abonelik: günlük 5 ders ilanı ve 10 soru",
      "Daha çok öğretmenden teklif ve daha hızlı soru çözümü",
    ],
    nextStep:
      "Kayıttan sonra öğrenci paneliniz açılır. Ücretsiz haklarınızı kullanabilir veya yıllık abonelikle kotanızı büyütebilirsiniz.",
    href: "/kayit?role=student",
    cta: "Öğrenci olarak başla",
  },
  {
    role: "Öğretmen",
    registerRole: "teacher",
    title: "Öğrenci bulmak, ders vermek ve kazancını yönetmek",
    eyebrow: "Profil, talepler, kurs ve kazanç",
    summary:
      "Öğretmen hesabı ile profilinizi vitrin gibi sunar, taleplere teklif verir, derslerinizi yönetir ve kazancınızı cüzdandan takip edersiniz.",
    features: [
      "Özet panel: bekleyen işler, anlık ders hazır modu, performans özeti",
      "Profil düzenleme: bio, video, branş, ücret, şehir, iletişim tercihleri",
      "Kazanım etiketleri (hangi konularda güçlü olduğunuzu gösterme)",
      "Belge yükleme ve doğrulama süreci",
      "Açık ders taleplerine teklif, mesajlaşma ve teklif geri çekme",
      "Tekliflerim listesi ve kabul edilen paketler",
      "Ders oturumları: planlama, canlı sınıf, tahta/not arşivi",
      "Doğrudan ders anlaşmaları ve takvim slotları",
      "Grup ders taleplerine yanıt",
      "Ödev / soru havuzu: talep alma, cevaplama, ödül kazancı",
      "Kurs oluşturma, kohort açma, oturum planlama",
      "Kampanya oluşturma, başvuruları görme, moderasyon durumu",
      "Anlık ders: çevrimiçi hazır olma ve kısa soru çözümü oturumları",
      "Zigo: ipucu, formül ve video linki paylaşımı (vitrin akışı)",
      "Öğrenci mesajları (birleşik mesajlaşma)",
      "Cüzdan: kazanç, para çekme talebi, SLA bilgisi",
      "Öğretmen aboneliği (30 / 60 ay erken erişim paketleri)",
      "Ders sonrası değerlendirme formu (öğrenci ilerlemesi)",
      "Canlı destek",
    ],
    subscriptionWins: [
      "Sınırsız teklif; abonesizken günde 1 normal teklif ücretsiz",
      "Public profiliniz tam açılır: bio, video, kanıtlar, fiyat, telefon ve WhatsApp tercihi görünür",
      "Profilinizi web siteniz gibi kurup reklam kampanyasıyla öğrenci çekme",
      "İlk kampanya ilanı ücretsiz",
    ],
    nextStep:
      "Kayıttan sonra öğretmen paneliniz açılır. Profilinizi tamamlayıp abonelikle tam görünürlük ve sınırsız teklif açabilirsiniz.",
    href: "/kayit?role=teacher",
    cta: "Öğretmen olarak başla",
  },
  {
    role: "Veli",
    registerRole: "guardian",
    title: "Çocuğunuzun ders, ödev ve ödeme sürecini izlemek",
    eyebrow: "Çocuğunuzun ders sürecini görün",
    summary:
      "Veli hesabı ile öğrencinin ders, kurs, ödev, çalışma ve ödeme sürecini tek panelden takip edersiniz; ayrı bir ödeme planı değildir.",
    features: [
      "Öğrenci hesabı eşleştirme (davet kodu veya bağlantı)",
      "Veli özeti: ders, ödev, deneme ve çalışma planı durumu",
      "Ders talepleri ve ilan geçmişi görüntüleme",
      "Kazanım testi ve deneme sonuçları takibi",
      "Sınıf notları ve ders değerlendirme özetleri",
      "Veli bildirimleri (e-posta / panel)",
      "E-posta bildirim tercihlerini yönetme",
      "Güvenli havuz: aylık ders kredisi tanımlama (cüzdan bütçesi ile)",
      "Kredi kullanımı ve kalan ders hakkı takibi",
      "AI haftalık gelişim raporları (test, tahta, yorum özeti)",
      "Zayıf kazanımda öğretmen desteği önerisi (panel uyarısı ve yönlendirme)",
      "Öğrenci aboneliğinden doğan ilan / soru kotası kullanımını görme",
      "Ödeme, destek ve itiraz kayıtlarına şeffaf erişim",
      "Canlı destek",
    ],
    subscriptionWins: [
      "Öğrenci aboneliğiyle artan ders ilanı ve soru haklarını takip",
      "Ders, ödev, ödeme ve destek kayıtlarının tek yerden görünmesi",
      "Güvenli ödeme, destek ve sorun çözümünde şeffaf kayıt",
      "Çocuğunuzun ilerlemesini dağınık mesajlar yerine panelden izleme",
    ],
    nextStep:
      "Kayıttan sonra veli paneliniz açılır. Öğrencinizi eşleştirip bildirimleri, kredi havuzunu ve raporları izleyebilirsiniz.",
    href: "/kayit?role=guardian",
    cta: "Veli olarak başla",
  },
  {
    role: "Yönetici",
    title: "Platform operasyonu, finans ve kalite yönetimi",
    eyebrow: "Yalnızca yetkili ekip — kayıtla açılmaz",
    summary:
      "Admin hesabı platformun güvenli çalışması, ödeme mutabakatı, içerik moderasyonu ve destek operasyonu içindir.",
    features: [
      "Kontrol merkezi: canlı metrikler, sistem sağlığı, haftalık kalite raporu",
      "Kullanıcı yönetimi: arama, rol atama, hesap askıya alma, KVKK silme",
      "Öğretmen doğrulama onayı / reddi",
      "Canlı destek thread’leri ve SLA takibi",
      "Havale onayı, abonelik ödemeleri, PayTR mutabakatı",
      "Cüzdan: manuel işlem, hareketler, öğrenci/öğretmen yüklemeleri",
      "Öğretmen para çekme onayı, otomatik çekim kuralları",
      "Kurs durumu, kayıt, iade kararları, kurs muhasebesi",
      "Ders talepleri, paketler, doğrudan ders ve grup ders yönetimi",
      "Ödev / soru havuzu moderasyonu ve kalite kuyruğu",
      "Canlı sınıf notları, kayıtlar, mesaj arşivi",
      "Veli davet kodları ve veli bildirimleri",
      "Dönüşüm (funnel) raporu ve smoke test kayıtları",
      "Ders hatırlatma ve haftalık veli raporu işlerini tetikleme",
      "Sorun merkezi (itiraz / dispute) kararları",
    ],
    subscriptionWins: [],
    nextStep: "Yetkili admin hesabınız varsa giriş yaparak /admin merkezine erişin.",
    href: "/login?returnUrl=%2Fadmin%2Fmerkez",
    cta: "Admin girişi",
  },
] as const;

export const REGISTER_ROLE_CARDS = ROLE_FEATURE_CARDS.filter(
  (c): c is RoleFeatureCard & { registerRole: RegisterRole } => c.registerRole != null,
);

export function roleCardByRegisterRole(role: RegisterRole): RoleFeatureCard & { registerRole: RegisterRole } {
  const card = REGISTER_ROLE_CARDS.find((c) => c.registerRole === role);
  if (!card) throw new Error(`unknown register role: ${role}`);
  return card;
}

export function subscriptionWinsForRole(role: RegisterRole): readonly string[] {
  return roleCardByRegisterRole(role).subscriptionWins;
}

export function featureCountForRole(role: RegisterRole): number {
  return roleCardByRegisterRole(role).features.length;
}
