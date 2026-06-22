import type { QuickStartStep } from "../components/QuickStartBanner";
import { panelPathForRole, type UserRole } from "./auth";

export type PageAction = {
  href: string;
  label: string;
};

export type PageQuickStartConfig = {
  title: string;
  body: string;
  href: string;
  cta: string;
  steps?: readonly QuickStartStep[];
};

export const STUDENT_REQUEST_FORM_STEPS: readonly QuickStartStep[] = [
  { label: "Branş seç", body: "Ders alanınızı seçin (ör. Matematik, Türkçe)." },
  { label: "Konu yaz", body: "Sınıf, hedef sınav ve uygun zamanı ekleyin." },
  { label: "İlan aç", body: "Gönderin; öğretmenler teklif versin." },
] as const;

export const STUDENT_ODEV_SOR_FORM_STEPS: readonly QuickStartStep[] = [
  { label: "Fotoğraf ekle", body: "Soruyu net çekin veya galeriden seçin." },
  { label: "Branş ve konu", body: "Ders ve neyi anlamadığınızı yazın." },
  { label: "Gönder", body: "Öğretmen havuzuna düşer; çözümü takip edin." },
] as const;

export function studentRequestsQuickStart(): PageQuickStartConfig {
  return {
    title: "Öğretmenlerden teklif toplayın",
    body: "Branş ve konuyu yazın; uygun öğretmenler size özel teklif göndersin.",
    href: "#request-form",
    cta: "İlan formuna git",
    steps: STUDENT_REQUEST_FORM_STEPS,
  };
}

export function studentOdevSorQuickStart(): PageQuickStartConfig {
  return {
    title: "Takıldığınız soruyu gönderin",
    body: "Fotoğraf, branş ve kısa açıklama yeterli. Çözümü gönderilerimden takip edersiniz.",
    href: "#step-foto",
    cta: "Forma başla",
    steps: STUDENT_ODEV_SOR_FORM_STEPS,
  };
}

export function postPaymentOkActions(role: UserRole | null): {
  primary: PageAction;
  secondary: PageAction;
  hint: string;
} {
  if (role === "teacher") {
    return {
      primary: { href: "/teacher", label: "Öğretmen paneline git" },
      secondary: { href: "/teacher/cuzdan", label: "Cüzdan ve abonelik" },
      hint: "Öğretmen aboneliği birkaç dakika içinde aktifleşir.",
    };
  }
  if (role === "guardian") {
    return {
      primary: { href: "/guardian", label: "Veli paneline git" },
      secondary: { href: "/guardian/requests", label: "Ders ilanları" },
      hint: "Ödeme onaylandıysa veli panelinde görünür.",
    };
  }
  if (role === "admin") {
    return {
      primary: { href: "/admin", label: "Yönetim paneline git" },
      secondary: { href: "/", label: "Ana sayfa" },
      hint: "İşlem admin kayıtlarına yansır.",
    };
  }
  return {
    primary: { href: "/student/panel#bakiye", label: "Cüzdanı kontrol et" },
    secondary: { href: "/student/requests", label: "Ders taleplerim" },
    hint: "Bakiye veya abonelik birkaç saniye içinde güncellenir.",
  };
}

export function postPaymentFailActions(role: UserRole | null): {
  primary: PageAction;
  secondary: PageAction;
  hint: string;
} {
  if (role === "teacher") {
    return {
      primary: { href: "/teacher", label: "Aboneliği tekrar dene" },
      secondary: { href: "/iletisim", label: "Destek" },
      hint: "Kart reddedildiyse farklı kart deneyin veya havale seçeneğini kullanın.",
    };
  }
  if (role === "guardian") {
    return {
      primary: { href: "/guardian", label: "Veli paneline dön" },
      secondary: { href: "/iade", label: "İade politikası" },
      hint: "Ödeme tamamlanmadı; bakiye veya abonelik değişmedi.",
    };
  }
  return {
    primary: { href: panelPathForRole(role ?? "student"), label: "Panele dön" },
    secondary: { href: "/student/panel#bakiye", label: "Bakiye yükle" },
    hint: "Kart işlemi iptal veya doğrulama hatası olabilir. Havale/EFT de kullanılabilir.",
  };
}
