"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getRoleFromToken, getToken, panelNavLabel, panelPathForRole, type UserRole } from "../lib/auth";
import { loginHrefWithReturn, registerHrefWithReturn } from "../lib/authRedirect";

const btnPrimary =
  "inline-flex items-center justify-center rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-900";
const btnSecondary =
  "inline-flex items-center justify-center rounded-xl border border-paper-300 bg-white px-5 py-2.5 text-sm font-semibold text-paper-900 hover:bg-paper-50";

function roleLead(role: UserRole): string {
  if (role === "teacher") return "Panele giderek taleplere teklif verebilir ve aboneliğinizi yönetebilirsiniz.";
  if (role === "student")
    return "Öğretmenlerden teklif almak için talep açın veya açık taleplerinizi takip edin.";
  if (role === "guardian") return "Bağlı öğrencinin özeti ve bildirimleri veli panelindedir.";
  return "Yönetim işlemleri için admin panelini kullanın.";
}

export function HomeHeroPersonalized() {
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const sync = useCallback(() => setToken(getToken()), []);

  useEffect(() => {
    setMounted(true);
    sync();
  }, [sync]);

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
      <div className="mt-8 flex min-h-[44px] flex-wrap gap-3">
        <span className="h-11 w-36 rounded-xl bg-paper-200/70" aria-hidden />
        <span className="h-11 w-36 rounded-xl bg-paper-200/50" aria-hidden />
      </div>
    );
  }

  const role = getRoleFromToken(token);
  if (!role) {
    return (
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Link href={registerHrefWithReturn("/student/requests")} className={btnPrimary}>
          Talep oluştur
        </Link>
        <Link href="/ogretmenler" className={btnSecondary}>
          Öğretmen ara
        </Link>
        <Link
          href={loginHrefWithReturn("/student/requests")}
          className="text-sm font-medium text-brand-800 underline decoration-brand-400 underline-offset-4"
        >
          Zaten hesabım var — giriş
        </Link>
      </div>
    );
  }

  const panel = panelPathForRole(role);
  const panelLabel = panelNavLabel(role);

  return (
    <>
      <p className="mt-4 max-w-lg rounded-lg border border-paper-200 bg-paper-50 px-3 py-2 text-sm text-paper-800">
        {roleLead(role)}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link href={panel} className={btnPrimary}>
          {panelLabel}
        </Link>
        {role === "teacher" ? (
          <Link href="/teacher/requests" className={btnSecondary}>
            Talepler
          </Link>
        ) : null}
        {role === "student" ? (
          <Link href="/student/requests" className={btnSecondary}>
            Taleplerim
          </Link>
        ) : null}
        {role === "guardian" ? (
          <Link href="/guardian" className={btnSecondary}>
            Veli özeti
          </Link>
        ) : null}
        {role === "admin" ? (
          <Link href="/admin" className={btnSecondary}>
            Yönetim
          </Link>
        ) : null}
      </div>
    </>
  );
}
