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
      "Branş ve şehre göre öğretmen bulun; talep açın, teklifleri karşılaştırın, güvenle eşleşin.",
    start_url: "/",
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
        name: "Öğretmen ara",
        short_name: "Ara",
        url: "/ogretmenler",
        description: "Branş ve şehre göre öğretmen listesi",
        icons: shortcutIcons,
      },
      {
        name: "Talep oluştur",
        short_name: "Talep",
        url: "/student/requests",
        description: "Ders talebi açın; teklifleri karşılaştırın",
        icons: shortcutIcons,
      },
      {
        name: "Telefona ekle",
        short_name: "Kurulum",
        url: "/uygulama",
        description: "PWA kurulum rehberi",
        icons: shortcutIcons,
      },
    ],
  };
}
