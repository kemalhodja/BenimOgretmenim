/** API ve istemci hata kodlarını kullanıcıya gösterilecek Türkçe metne çevirir. */

const ERROR_CODE_TR: Record<string, string> = {
  load_failed: "Veriler yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.",
  create_failed: "Kayıt oluşturulamadı. Bilgileri kontrol edip tekrar deneyin.",
  send_failed: "Mesaj gönderilemedi. Tekrar deneyin.",
  cancel_failed: "İptal işlemi tamamlanamadı.",
  decide_failed: "Seçiminiz kaydedilemedi. Tekrar deneyin.",
  topup_failed: "Cüzdan yükleme başlatılamadı.",
  purchase_failed: "Satın alma başlatılamadı.",
  usage_pack_purchase_failed: "Ek hak paketi alınamadı.",
  guardian_invite_failed: "Veli davet kodu oluşturulamadı.",
  login_failed: "Giriş yapılamadı. Bilgilerinizi kontrol edin.",
  register_failed: "Kayıt tamamlanamadı. Bilgilerinizi kontrol edin.",
  request_failed: "İstek tamamlanamadı. Lütfen tekrar deneyin.",
  meta_load_failed: "Liste bilgileri yüklenemedi.",
  approve_failed: "Onay işlemi tamamlanamadı.",
  enroll_failed: "Kayıt işlemi tamamlanamadı.",
  application_failed: "Başvuru gönderilemedi.",
  schedule_failed: "Ders planlanamadı.",
  complete_failed: "Tamamlama işlemi yapılamadı.",
  evaluation_failed: "Değerlendirme kaydedilemedi.",
  accept_failed: "Kabul işlemi tamamlanamadı.",
  fund_failed: "Ödeme aktarılamadı.",
  instant_ready_failed: "Anlık ders durumu güncellenemedi.",
  messages_failed: "Mesajlar yüklenemedi.",
  message_send_failed: "Mesaj gönderilemedi.",
  classroom_load_failed: "Sınıf oturumu yüklenemedi.",
  learning_load_failed: "Çalışma planı yüklenemedi.",
  curriculum_test_load_failed: "Kazanım testleri yüklenemedi.",
  ops_load_failed: "Operasyon verileri yüklenemedi.",
  overview_failed: "Özet yüklenemedi.",
  system_health_failed: "Sistem durumu alınamadı.",
  weekly_report_failed: "Haftalık rapor yüklenemedi.",
  reminders_failed: "Hatırlatma gönderimi başarısız.",
  apply_failed: "Başvuru tamamlanamadı.",
  status_failed: "Durum güncellenemedi.",
  applications_failed: "Başvurular yüklenemedi.",
  application_status_failed: "Başvuru durumu güncellenemedi.",
  on_kayit_guncellenemedi: "Ön kayıt güncellenemedi.",
  kampanya_olusturulamadi: "Kampanya oluşturulamadı.",
  basvurular_yuklenemedi: "Başvurular yüklenemedi.",
  basvuru_guncellenemedi: "Başvuru güncellenemedi.",
  credit_allocate_failed: "Kredi aktarımı yapılamadı.",
  invite_accept_failed: "Davet kodu kabul edilemedi.",
  load_package_sessions_failed: "Ders oturumları yüklenemedi.",
  submit_failed: "Gönderim tamamlanamadı.",
  unauthorized: "Bu işlem için oturum açmanız gerekir.",
  forbidden: "Bu işlem için yetkiniz yok.",
  not_found: "İstenen kayıt bulunamadı.",
  paytr_not_configured: "Kartla ödeme henüz aktif değil. Havale/EFT veya destek ile devam edebilirsiniz.",
  insufficient_balance: "Cüzdan bakiyeniz yeterli değil.",
  insufficient_wallet_available: "Kullanılabilir cüzdan bakiyeniz yeterli değil.",
  daily_lesson_request_quota_exceeded: "Bugünkü ders ilanı hakkınız doldu.",
  daily_homework_quota_exceeded: "Bugünkü soru gönderme hakkınız doldu.",
  invalid_credentials: "E-posta veya parola hatalı.",
  already_used: "Bu kod daha önce kullanılmış.",
  smoke_run_secret_not_configured: "Sistem yapılandırması eksik. Destek ekibi bilgilendirilmeli.",
};

const HTTP_STATUS_TR: Record<number, string> = {
  400: "Gönderdiğiniz bilgiler geçersiz.",
  401: "Oturumunuz sona ermiş olabilir. Tekrar giriş yapın.",
  403: "Bu işlem için yetkiniz yok.",
  404: "İstenen kayıt bulunamadı.",
  409: "Bu işlem mevcut durumla çakışıyor.",
  422: "Gönderdiğiniz bilgiler işlenemedi.",
  429: "Çok fazla istek gönderdiniz. Biraz bekleyip tekrar deneyin.",
  500: "Sunucu geçici olarak yanıt veremiyor.",
  503: "Hizmet geçici olarak kullanılamıyor.",
};

const WALLET_LEDGER_KIND_TR: Record<string, string> = {
  topup: "Bakiye yükleme",
  withdrawal: "Çekim talebi",
  hold: "Güvenceye alma",
  release: "Güvence serbest",
  capture: "Tahsilat",
  refund: "İade",
  grant: "Yönetici yükleme",
  lesson_payment: "Ders ödemesi",
  homework_reward: "Ödev ödülü",
  subscription: "Abonelik",
  usage_pack: "Ek hak paketi",
  course_enrollment: "Kurs kaydı",
  group_lesson: "Grup dersi",
  direct_booking: "Doğrudan ders",
  teacher_payout: "Öğretmen hak edişi",
  adjustment: "Düzeltme",
};

function stripRequestId(raw: string): string {
  return raw.replace(/\s*\(requestId=[^)]+\)\s*$/i, "").trim();
}

function humanizeSnakeCase(code: string): string {
  return code
    .split("_")
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === "id") return "kimlik";
      if (lower === "api") return "API";
      return lower;
    })
    .join(" ");
}

export function translateUserFacingError(raw: string): string {
  const cleaned = stripRequestId(raw);
  const statusMatch = cleaned.match(/^\[(\d{3})]\s*(.*)$/);
  if (statusMatch) {
    const status = Number(statusMatch[1]);
    const rest = (statusMatch[2] ?? "").trim();
    const code = rest.split(/\s+/)[0]?.replace(/[.,;:!?]+$/g, "") ?? "";

    if (code && ERROR_CODE_TR[code]) {
      return ERROR_CODE_TR[code];
    }
    if (code.startsWith("validation:")) {
      return "Gönderdiğiniz bilgilerde eksik veya hatalı alan var.";
    }
    if (HTTP_STATUS_TR[status] && (!rest || ERROR_CODE_TR[rest])) {
      return HTTP_STATUS_TR[status];
    }
    if (rest && ERROR_CODE_TR[rest]) {
      return ERROR_CODE_TR[rest];
    }
    if (HTTP_STATUS_TR[status]) {
      return HTTP_STATUS_TR[status];
    }
  }

  const bareCode = cleaned.replace(/[.,;:!?]+$/g, "");
  if (ERROR_CODE_TR[bareCode]) {
    return ERROR_CODE_TR[bareCode];
  }
  if (/^[a-z][a-z0-9_]*$/i.test(bareCode)) {
    return `İşlem tamamlanamadı (${humanizeSnakeCase(bareCode)}).`;
  }
  return cleaned;
}

/** catch bloklarında: API hatası veya yedek kod → Türkçe mesaj */
export function userErrorMessage(err: unknown, fallbackCode = "request_failed"): string {
  const raw = err instanceof Error ? err.message : fallbackCode;
  return translateUserFacingError(raw);
}

export function walletLedgerKindLabelTr(kind: string): string {
  const key = kind.trim().toLowerCase();
  if (WALLET_LEDGER_KIND_TR[key]) return WALLET_LEDGER_KIND_TR[key];
  if (key.includes("topup")) return "Bakiye yükleme";
  if (key.includes("refund")) return "İade";
  if (key.includes("subscription")) return "Abonelik";
  if (key.includes("homework")) return "Ödev işlemi";
  if (key.includes("lesson")) return "Ders işlemi";
  if (key.includes("grant")) return "Yönetici yükleme";
  return humanizeSnakeCase(key).replace(/^\w/, (c) => c.toUpperCase());
}
