"use client";

import { useEffect } from "react";
import { getCachedRole, renewAuthSession, syncAuthSession } from "../lib/auth";

const KEEPALIVE_INTERVAL_MS = 20 * 60 * 1000;

/** Uygulama arka plandan dönünce ve periyodik olarak oturumu yeniler. */
export function SessionKeepAlive() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const tick = (renew: boolean) => {
      if (!getCachedRole()) return;
      if (renew) {
        void renewAuthSession(true);
      } else {
        void renewAuthSession();
      }
    };

    void syncAuthSession({ renew: true });

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void syncAuthSession({ renew: true });
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        void syncAuthSession({ renew: true });
      }
    };

    const onFocus = () => {
      void syncAuthSession({ renew: true });
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onFocus);

    const interval = window.setInterval(() => tick(false), KEEPALIVE_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
