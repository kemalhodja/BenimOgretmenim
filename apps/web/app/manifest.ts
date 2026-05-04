import type { MetadataRoute } from "next";
import { publicSiteUrl } from "./lib/siteUrl";

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
    background_color: "#f7f4ee",
    theme_color: "#335096",
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
      },
      {
        name: "Panel",
        short_name: "Panel",
        url: "/panel",
        description: "Rolünüze göre yönlendirme",
      },
      {
        name: "Telefona ekle",
        short_name: "Kurulum",
        url: "/uygulama",
        description: "PWA kurulum rehberi",
      },
    ],
  };
}
