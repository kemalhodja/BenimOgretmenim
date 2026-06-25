"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    void caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("benimogretmenim-pwa-") && k !== "benimogretmenim-pwa-v4")
          .map((k) => caches.delete(k)),
      ),
    );

    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .catch(() => undefined);
    };

    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}

