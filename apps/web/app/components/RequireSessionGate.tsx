"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getCachedRole, getToken, refreshSessionFromServer } from "../lib/auth";
import { loginHrefWithReturn } from "../lib/authRedirect";

/** Oturum yoksa girişe yönlendirir; varsa içeriği gösterir. */
export function RequireSessionGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      if (getToken()) {
        if (alive) setReady(true);
        return;
      }
      const role = await refreshSessionFromServer();
      if (!alive) return;
      if (role || getCachedRole()) {
        setReady(true);
        return;
      }
      router.replace(loginHrefWithReturn(pathname));
    };
    void check();
    return () => {
      alive = false;
    };
  }, [router, pathname]);

  if (!ready) return null;
  return children;
}
