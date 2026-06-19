import { ROLE_FEATURES_PATH } from "./roleFeatures";

export { ROLE_FEATURES_PATH };

export const roleFeaturesLink = { href: ROLE_FEATURES_PATH, label: "Rol özellikleri" } as const;

export const panelSupportLinks = [
  roleFeaturesLink,
  { href: "/yardim", label: "Yardım" },
  { href: "/fiyatlar", label: "Fiyatlar" },
  { href: "/iletisim", label: "İletişim" },
] as const;
