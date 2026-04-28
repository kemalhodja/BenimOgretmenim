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
    <div className="mx-auto max-w-2xl px-6 py-10 text-sm text-zinc-600">
      Yönlendiriliyor…
    </div>
  );
}

