"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCachedRole, getRoleFromToken, getToken, panelPathForRole, refreshSessionFromServer } from "../lib/auth";
import { loginHrefWithReturn } from "../lib/authRedirect";

export default function PanelRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    const redirect = async () => {
      const token = getToken();
      const role = getRoleFromToken(token) ?? getCachedRole() ?? (await refreshSessionFromServer());
      if (!alive) return;
      if (!role) {
        router.replace(loginHrefWithReturn("/panel"));
        return;
      }
      router.replace(panelPathForRole(role));
    };
    void redirect();
    return () => {
      alive = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-xl font-semibold tracking-tight text-paper-900">Panele yönlendiriliyorsunuz</h1>
        <p className="mt-2 text-sm text-paper-800/75">Lütfen bekleyin…</p>
      </div>
    </div>
  );
}
