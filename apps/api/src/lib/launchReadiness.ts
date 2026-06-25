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
          "Render disk + HOMEWORK_STORAGE_DIR ve HOMEWORK_STORAGE_PUBLIC_BASE tanımlayın.",
          "GAP_DEPLOY_RUNBOOK.md",
        ),
  );

  gaps.push(
    process.env.RESEND_API_KEY?.trim()
      ? gap("email", "Veli e-posta (Resend)", "ok", "trust", "Aktif.")
      : gap(
          "email",
          "Veli e-posta (Resend) yok",
          "warning",
          "trust",
          "RESEND_API_KEY + EMAIL_FROM ekleyin; yoksa outbox kuyruğa yazar.",
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
          "GitHub + Render SMOKE_RUN_SECRET eşleştirin; CI smoke sonucu admin panelde görünür.",
          "GAP_DEPLOY_RUNBOOK.md",
        ),
  );

  gaps.push(
    gap(
      "dns_domains",
      "DNS / www → web servisi",
      "warning",
      "growth",
      "Render: www custom domain web servisinde; api'den kaldırın. Turhost apex→www yönlendirmesini kapatın.",
      "apps/web/DNS_FIX.md",
    ),
  );

  gaps.push(
    gap(
      "play_store",
      "Play Store + assetlinks",
      "open",
      "growth",
      "Play App Signing SHA-256 → apps/web/public/.well-known/assetlinks.json → TWA yayın.",
      "apps/twa-android/RELEASE_CHECKLIST.md",
    ),
  );

  const openCount = gaps.filter((g) => g.status === "open").length;
  const warningCount = gaps.filter((g) => g.status === "warning").length;
  const okCount = gaps.filter((g) => g.status === "ok").length;

  const score = Math.round(Math.max(4, Math.min(10, 4 + okCount * 1.1 - openCount * 1.4 - warningCount * 0.35)) * 10) / 10;

  return {
    score,
    readyForRevenue: paytrReady,
    readyForPublicLaunch: paytrReady && openCount <= 1,
    gaps,
    openCount,
    warningCount,
  };
}
