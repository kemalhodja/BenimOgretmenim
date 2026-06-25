"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  getCachedRole,
  panelPathForRole,
  refreshSessionFromServer,
  type UserRole,
} from "../lib/auth";
import { isPathAllowedForRole } from "../lib/roleAccess";

/**
 * Oturum açıkken yanlış rol alanına girilirse kullanıcıyı kendi paneline yönlendirir.
 * Örn. öğrenci /teacher → /student/panel
 */
export function RoleRouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const role = (getCachedRole() ?? (await refreshSessionFromServer())) as UserRole | null;
      if (!alive) return;
      if (!role) {
        setReady(true);
        return;
      }
      if (isPathAllowedForRole(pathname, role)) {
        setReady(true);
        return;
      }
      router.replace(panelPathForRole(role));
    };
    setReady(false);
    void check();
    return () => {
      alive = false;
    };
  }, [pathname, router]);

  if (!ready) return null;
  return children;
}
