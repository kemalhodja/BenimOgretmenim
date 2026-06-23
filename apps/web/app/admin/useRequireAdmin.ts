"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getRoleFromToken, getToken, refreshSessionFromServer } from "../lib/auth";
import { loginHrefWithReturn } from "../lib/authRedirect";

/** Admin rotalarında: token yoksa giriş, rol admin değilse `/panel`. Token döner veya henüz `null`. */
export function useRequireAdmin(): string | null {
  const router = useRouter();
  const pathname = usePathname() ?? "/admin";
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refreshSessionFromServer();
      if (cancelled) return;
      const t = getToken();
      if (!t) {
        router.replace(loginHrefWithReturn(pathname));
        return;
      }
      if (getRoleFromToken(t) !== "admin") {
        router.replace("/panel");
        return;
      }
      setToken(t);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  return token;
}

/** Layout seviyesinde admin oturumu ve rol kontrolü. */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const token = useRequireAdmin();
  if (!token) return null;
  return children;
}
