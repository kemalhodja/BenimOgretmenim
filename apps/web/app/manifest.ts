import type { MetadataRoute } from "next";
import { publicSiteUrl } from "./lib/siteUrl";

/** Ana uygulama ikonuyla aynı PNG — ana ekran / kısayol döşemelerinde tutarlı görünüm */
const shortcutIcons: MetadataRoute.Manifest["icons"] = [
  {
    src: "/icon-192",
    sizes: "192x192",
    type: "image/png",
    purpose: "any",
  },
];

export default function manifest(): MetadataRoute.Manifest {
  const base = publicSiteUrl();

  return {
    id: `${base}/`,
    scope: "/",
    name: "BenimÖğretmenim",
    short_name: "BenimÖğretmenim",
    description:
      "Öğretmen bulun; teklifleri karşılaştırın, soru çözümü alın, canlı ders ve çalışma planınızı takip edin.",
    start_url: "/panel",
    display: "standalone",
    display_override: ["standalone", "browser"],
    orientation: "any",
    background_color: "#f4faf9",
    theme_color: "#2a9d8f",
    lang: "tr",
    categories: ["education", "productivity"],
    icons: [
      {
        src: "/icon-192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Panelim",
        short_name: "Panel",
        url: "/panel",
        description: "Oturum rolünüze göre öğrenci, öğretmen, veli veya yönetim paneli",
        icons: shortcutIcons,
      },
      {
        name: "Öğretmen ara",
        short_name: "Ara",
        url: "/ogretmenler",
        description: "Branş ve şehre göre öğretmen listesi",
        icons: shortcutIcons,
      },
      {
        name: "Soru / ödev gönder",
        short_name: "Soru sor",
        url: "/student/odev-sor",
        description: "Fotoğraflı soru gönderin ve çözüm sürecini takip edin",
        icons: shortcutIcons,
      },
      {
        name: "Öğretmen havuzu",
        short_name: "Havuz",
        url: "/teacher/odev-havuzu",
        description: "Öğretmenler için soru/ödev havuzu",
        icons: shortcutIcons,
      },
      {
        name: "Telefona ekle",
        short_name: "Kurulum",
        url: "/uygulama",
        description: "PWA kurulum rehberi ve rol bazlı kısayollar",
        icons: shortcutIcons,
      },
    ],
  };
}
