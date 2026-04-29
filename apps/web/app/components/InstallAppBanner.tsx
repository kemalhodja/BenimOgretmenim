"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "pwa-install-banner-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    nav.standalone === true
  );
}

function detectIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function detectAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

export function InstallAppBanner() {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [android, setAndroid] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setDismissed(false);
    }
    setStandalone(isStandalone());
    setIos(detectIos());
    setAndroid(detectAndroid());

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* ignore */
    }
    setDeferred(null);
  }, [deferred]);

  if (!mounted || dismissed || standalone) return null;

  const showIos = ios;
  const showAndroidInstall = android && deferred;
  const showAndroidHint = android && !deferred;

  if (!showIos && !showAndroidInstall && !showAndroidHint) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[60] border-t border-paper-200/90 bg-paper-50/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(22,34,51,0.12)] backdrop-blur-md"
      role="region"
      aria-label="Uygulamayı ana ekrana ekle"
    >
      <div className="mx-auto flex max-w-lg flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 text-sm text-paper-900">
          {showIos ? (
            <>
              <div className="font-semibold text-paper-950">iPhone / iPad’e ekle</div>
              <div className="mt-0.5 text-paper-800/85">
                <span className="font-medium">Paylaş</span> (kare ve ok) →{" "}
                <span className="font-medium">Ana Ekrana Ekle</span>.{" "}
                <Link href="/uygulama#ios" className="text-brand-800 underline">
                  Adımlar
                </Link>
              </div>
            </>
          ) : showAndroidInstall ? (
            <>
              <div className="font-semibold text-paper-950">BenimÖğretmenim’i telefona ekle</div>
              <div className="mt-0.5 text-paper-800/85">
                Tek dokunuşla ana ekrana kısayol; tam ekran açılır (Chrome).
              </div>
            </>
          ) : (
            <>
              <div className="font-semibold text-paper-950">Ana ekrana ekle</div>
              <div className="mt-0.5 text-paper-800/85">
                Chrome menüsü (⋮) → <span className="font-medium">Ana ekrana ekle</span> veya{" "}
                <Link href="/uygulama" className="font-medium text-brand-800 underline">
                  rehber
                </Link>
                .
              </div>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:justify-end">
          {!showIos && showAndroidInstall ? (
            <button
              type="button"
              onClick={() => void install()}
              className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-800"
            >
              Yükle
            </button>
          ) : null}
          <button
            type="button"
            onClick={dismiss}
            className="rounded-xl border border-paper-300 bg-white px-3 py-2 text-sm font-medium text-paper-800 hover:bg-paper-50"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
