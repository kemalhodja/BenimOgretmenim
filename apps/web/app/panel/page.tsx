"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getCachedRole,
  getRoleFromToken,
  getToken,
  panelNavLabel,
  panelPathForRole,
  refreshSessionFromServer,
  type UserRole,
} from "../lib/auth";
import { loginHrefWithReturn } from "../lib/authRedirect";

export default function PanelRedirectPage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    let alive = true;
    const redirect = async () => {
      const token = getToken();
      const resolved = getRoleFromToken(token) ?? getCachedRole() ?? (await refreshSessionFromServer());
      if (!alive) return;
      if (!resolved) {
        router.replace(loginHrefWithReturn("/panel"));
        return;
      }
      setRole(resolved);
      router.replace(panelPathForRole(resolved));
    };
    void redirect();
    return () => {
      alive = false;
    };
  }, [router]);

  const label = role ? panelNavLabel(role) : "Panel";

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-xl font-semibold tracking-tight text-paper-900">{label} açılıyor</h1>
        <p className="mt-2 text-sm text-paper-800/75">
          Rolünüze uygun özete yönlendiriliyorsunuz. Birkaç saniye sürebilir.
        </p>
      </div>
    </div>
  );
}
