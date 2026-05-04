"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getRoleFromToken, getToken, panelPathForRole } from "../lib/auth";
import { loginHrefWithReturn } from "../lib/authRedirect";

export default function PanelRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    const role = getRoleFromToken(token);
    if (!role) {
      router.replace(loginHrefWithReturn("/panel"));
      return;
    }
    router.replace(panelPathForRole(role));
  }, [router]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <p className="text-sm font-medium text-zinc-500">Yönlendirme</p>
      <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-900">Panele yönlendiriliyorsunuz</h1>
      <p className="mt-2 text-sm text-zinc-600">Lütfen bekleyin…</p>
    </div>
  );
}
