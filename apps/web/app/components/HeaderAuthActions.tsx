"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  clearToken,
  getCachedRole,
  getRoleFromToken,
  getToken,
  isOnRolePanel,
  panelNavLabel,
  panelPathForRole,
  refreshSessionFromServer,
} from "../lib/auth";
import { loginHrefWithReturn, registerHrefWithReturn } from "../lib/authRedirect";

export function HeaderAuthActions() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [token, setTokenState] = useState<string | null>(null);
  const [sessionRole, setSessionRole] = useState(() => getCachedRole());
  const [mounted, setMounted] = useState(false);

  const sync = useCallback(() => {
    setTokenState(getToken());
    setSessionRole(getCachedRole());
  }, []);

  useEffect(() => {
    let alive = true;
    setMounted(true);
    sync();
    void refreshSessionFromServer().then(() => {
      if (alive) sync();
    });
    return () => {
      alive = false;
    };
  }, [sync, pathname]);

  useEffect(() => {
    const on = () => sync();
    window.addEventListener("bo:auth-changed", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("bo:auth-changed", on);
      window.removeEventListener("storage", on);
    };
  }, [sync]);

  if (!mounted) {
    return (
      <div
        className="flex h-9 min-w-[11rem] shrink-0 items-center justify-end gap-2"
        aria-hidden
      >
        <span className="h-8 w-16 rounded-lg bg-paper-200/60" />
        <span className="h-8 w-20 rounded-lg bg-paper-200/60" />
      </div>
    );
  }

  const role = getRoleFromToken(token) ?? sessionRole;
  if (role) {
    const panelHref = role ? panelPathForRole(role) : "/panel";
    const panelLabel = role ? panelNavLabel(role) : "Panele git";
    const onPanel = role ? isOnRolePanel(role, pathname) : false;
    return (
      <div className="flex shrink-0 items-center gap-2">
        {!onPanel ? (
          <Link
            href={panelHref}
            className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-800"
          >
            {panelLabel}
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => {
            clearToken();
            sync();
            router.push("/");
          }}
          className="rounded-lg border border-paper-300 bg-white px-3 py-1.5 text-sm font-medium text-paper-800 hover:bg-paper-50"
        >
          Çıkış
        </button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Link
        href={loginHrefWithReturn(pathname)}
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-paper-800/80 hover:bg-paper-100/80"
      >
        Giriş
      </Link>
      <Link
        href={registerHrefWithReturn(pathname)}
        className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-800"
      >
        Kayıt ol
      </Link>
    </div>
  );
}
