"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getCachedRole, getRoleFromToken, getToken, panelNavLabel, panelPathForRole, refreshSessionFromServer, type UserRole } from "../lib/auth";
import { loginHrefWithReturn, registerHrefWithReturn } from "../lib/authRedirect";

const btnPrimary =
  "inline-flex items-center justify-center rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-900";
const btnSecondary =
  "inline-flex items-center justify-center rounded-xl border border-paper-300 bg-white px-5 py-2.5 text-sm font-semibold text-paper-900 hover:bg-paper-50";

function roleLead(role: UserRole): { line: string; next: string } {
  if (role === "teacher") {
    return {
      line: "Öğretmen panelinde sıradaki işlem üstte gösterilir.",
      next: "Profil, teklif ve dersler tek menüde.",
    };
  }
  if (role === "student") {
    return {
      line: "Öğrenci panelinde bugün yapmanız gereken adım üstte yazar.",
      next: "Talep, soru ve plan aynı yerden.",
    };
  }
  if (role === "guardian") {
    return {
      line: "Veli panelinde önce öğrenci bağlantısı, sonra bildirim takibi.",
      next: "Ders ve plan özeti burada.",
    };
  }
  return { line: "Yönetim işlemleri admin panelindedir.", next: "Kontrol merkezinden devam edin." };
}

export function HomeHeroPersonalized() {
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [sessionRole, setSessionRole] = useState(() => getCachedRole());

  const sync = useCallback(() => {
    setToken(getToken());
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

  const role = getRoleFromToken(token) ?? sessionRole;
  if (!role) {
    return (
      <div className="mt-6 rounded-2xl border border-paper-200 bg-white/80 p-4">
        <p className="text-sm font-medium text-paper-900">Zaten hesabınız var mı?</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Link href={loginHrefWithReturn("/panel")} className={btnPrimary}>
            Giriş yap — panele git
          </Link>
          <Link href={registerHrefWithReturn("/student/panel?onboarding=1")} className={btnSecondary}>
            Yeni hesap aç
          </Link>
        </div>
      </div>
    );
  }

  const panel = panelPathForRole(role);
  const panelLabel = panelNavLabel(role);
  const lead = roleLead(role);

  return (
    <div className="mt-6 rounded-2xl border border-brand-200 bg-brand-50/80 p-4">
      <p className="text-sm font-medium text-brand-950">{lead.line}</p>
      <p className="mt-1 text-sm text-brand-900/80">{lead.next}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link href={panel} className={btnPrimary} data-testid="home-hero-panel-cta">
          {panelLabel} — devam et
        </Link>
        {role === "teacher" ? (
          <Link href="/teacher/requests" className={btnSecondary}>
            Açık talepler
          </Link>
        ) : null}
        {role === "student" ? (
          <Link href="/student/requests" className={btnSecondary}>
            Taleplerim
          </Link>
        ) : null}
        {role === "guardian" ? (
          <Link href="/guardian/requests" className={btnSecondary}>
            İlanlar
          </Link>
        ) : null}
      </div>
    </div>
  );
}
