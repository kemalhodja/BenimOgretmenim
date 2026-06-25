import { isHomeworkObjectStorageConfigured } from "./homeworkObjectStorage.js";
import {
  isPaytrFullyConfigured,
  paytrOptionalInProduction,
} from "./systemHealth.js";

export type LaunchGapStatus = "ok" | "warning" | "open";

export type LaunchGap = {
  id: string;
  title: string;
  status: LaunchGapStatus;
  impact: "revenue" | "trust" | "ops" | "growth";
  action: string;
  docPath: string | null;
};

export type LaunchReadiness = {
  score: number;
  readyForRevenue: boolean;
  readyForPublicLaunch: boolean;
  gaps: LaunchGap[];
  openCount: number;
  warningCount: number;
};

/** Play Console App Signing SHA-256 — placeholder değilse TWA doğrulanır. */
export const ASSETLINKS_PLACEHOLDER_SHA =
  "09:02:64:56:B4:02:1C:CD:60:BD:01:B6:08:37:1E:94:E7:BE:D0:99:16:89:22:BC:78:39:59:AF:69:85:D4:F7";

function gap(
  id: string,
  title: string,
  status: LaunchGapStatus,
  impact: LaunchGap["impact"],
  action: string,
  docPath: string | null = null,
): LaunchGap {
  return { id, title, status, impact, action, docPath };
}

export function isDnsProxyBridgeActive(): boolean {
  return Boolean(process.env.WEB_UPSTREAM_ORIGIN?.trim());
}

export function isPublicWebUrlCanonical(): boolean {
  const url = process.env.PUBLIC_WEB_URL?.trim();
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "benimogretmenim.com.tr" || host === "www.benimogretmenim.com.tr";
  } catch {
    return false;
  }
}

export function isPlayStoreShaConfigured(): boolean {
  const sha = process.env.PLAY_STORE_SHA256?.trim();
  if (!sha) return false;
  const normalized = sha.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  const placeholder = ASSETLINKS_PLACEHOLDER_SHA.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  return normalized.length >= 64 && normalized !== placeholder;
}

export function isEmailDeliveryConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

export function computeLaunchReadiness(): LaunchReadiness {
  const gaps: LaunchGap[] = [];

  const paytrReady = isPaytrFullyConfigured() && !paytrOptionalInProduction();
  gaps.push(
    paytrReady
      ? gap("paytr", "PayTR kart ödemesi", "ok", "revenue", "Aktif.")
      : gap(
          "paytr",
          "PayTR kart ödemesi kapalı",
          "open",
          "revenue",
          paytrOptionalInProduction()
            ? "Render → benimogretmenim-api: PAYTR_MERCHANT_* + URL env'leri girin; PAYTR_OPTIONAL silin veya 0 yapın."
            : "Render → benimogretmenim-api: eksik PAYTR_* env'lerini tamamlayın.",
          "DEPLOYMENT.md",
        ),
  );

  gaps.push(
    isHomeworkObjectStorageConfigured()
      ? gap("homework_storage", "Ödev görsel depolama", "ok", "ops", "Yapılandırıldı.")
      : gap(
          "homework_storage",
          "Ödev görsel depolama yok",
          "warning",
          "ops",
          "Render disk + HOMEWORK_STORAGE_DIR=/var/data/homework + HOMEWORK_STORAGE_PUBLIC_BASE=https://api.benimogretmenim.com.tr/v1/homework-media",
          "GAP_DEPLOY_RUNBOOK.md",
        ),
  );

  gaps.push(
    isEmailDeliveryConfigured()
      ? gap("email", "Veli e-posta (Resend)", "ok", "trust", "Aktif.")
      : gap(
          "email",
          "Veli e-posta (Resend) yok",
          "warning",
          "trust",
          "RESEND_API_KEY + EMAIL_FROM ekleyin; outbox kuyruğa yazar (cron ile yeniden dener).",
          "GAP_DEPLOY_RUNBOOK.md",
        ),
  );

  gaps.push(
    process.env.SMOKE_RUN_SECRET?.trim()
      ? gap("smoke_runs", "Deploy smoke kaydı", "ok", "ops", "SMOKE_RUN_SECRET tanımlı.")
      : gap(
          "smoke_runs",
          "Deploy smoke kaydı eksik",
          "warning",
          "ops",
          "GitHub Secrets + Render SMOKE_RUN_SECRET eşleştirin; CI smoke admin panelde görünür.",
          "GAP_DEPLOY_RUNBOOK.md",
        ),
  );

  if (process.env.LAUNCH_DNS_VERIFIED?.trim() === "1") {
    gaps.push(gap("dns_domains", "DNS / www → web servisi", "ok", "growth", "Doğrulandı (LAUNCH_DNS_VERIFIED=1)."));
  } else if (isDnsProxyBridgeActive()) {
    gaps.push(
      gap(
        "dns_domains",
        "DNS köprüsü aktif (geçici)",
        "warning",
        "growth",
        "WEB_UPSTREAM_ORIGIN proxy çalışıyor. Kalıcı: Render'da www'yi web servisine taşıyın; sonra LAUNCH_DNS_VERIFIED=1.",
        "apps/web/DNS_FIX.md",
      ),
    );
  } else if (!isPublicWebUrlCanonical()) {
    gaps.push(
      gap(
        "dns_domains",
        "PUBLIC_WEB_URL eksik/yanlış",
        "warning",
        "growth",
        "PUBLIC_WEB_URL=https://benimogretmenim.com.tr ayarlayın; www API'den kaldırın.",
        "apps/web/DNS_FIX.md",
      ),
    );
  } else {
    gaps.push(
      gap(
        "dns_domains",
        "DNS doğrulama bekleniyor",
        "warning",
        "growth",
        "www HTML döndürüyor mu kontrol edin; tamamsa Render'da LAUNCH_DNS_VERIFIED=1 ekleyin.",
        "apps/web/DNS_FIX.md",
      ),
    );
  }

  gaps.push(
    isPlayStoreShaConfigured()
      ? gap("play_store", "Play Store + assetlinks", "ok", "growth", "PLAY_STORE_SHA256 tanımlı; assetlinks.json güncelleyin.")
      : gap(
          "play_store",
          "Play Store + assetlinks",
          "open",
          "growth",
          "Play App Signing SHA-256 → PLAY_STORE_SHA256 env + write-assetlinks.ps1 → TWA yayın.",
          "apps/twa-android/RELEASE_CHECKLIST.md",
        ),
  );

  const openCount = gaps.filter((g) => g.status === "open").length;
  const warningCount = gaps.filter((g) => g.status === "warning").length;
  const okCount = gaps.filter((g) => g.status === "ok").length;

  const score =
    Math.round(Math.max(4, Math.min(10, 4 + okCount * 1.1 - openCount * 1.4 - warningCount * 0.35)) * 10) / 10;

  const nonPaytrOpen = gaps.filter((g) => g.status === "open" && g.id !== "paytr").length;

  return {
    score,
    readyForRevenue: paytrReady,
    readyForPublicLaunch: nonPaytrOpen === 0 && warningCount <= 2,
    gaps,
    openCount,
    warningCount,
  };
}
