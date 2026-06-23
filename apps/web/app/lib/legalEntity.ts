/** Veri sorumlusu ve yasal iletişim — Render env ile özelleştirilebilir. */
export function legalEntityName(): string {
  return process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME?.trim() || "BenimÖğretmenim";
}

export function legalEntityAddress(): string {
  return (
    process.env.NEXT_PUBLIC_LEGAL_ENTITY_ADDRESS?.trim() ||
    "İstanbul, Türkiye (güncel adres için iletişim sayfasına bakın)"
  );
}

export function supportEmail(): string {
  return process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "destek@benimogretmenim.com.tr";
}

export function kvkkEmail(): string {
  return process.env.NEXT_PUBLIC_KVKK_EMAIL?.trim() || "destek@benimogretmenim.com.tr";
}
