"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RegisterNavLink } from "./AuthNavLinks";
import { getRoleFromToken, getToken, panelNavLabel, panelPathForRole, type UserRole } from "../lib/auth";

const btnPrimary =
  "inline-flex items-center justify-center rounded-xl bg-brand-800 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-900/15 ring-1 ring-brand-900/20 transition hover:bg-brand-900";
const btnSecondary =
  "inline-flex items-center justify-center rounded-xl border-2 border-paper-200 bg-white px-6 py-3 text-sm font-semibold text-paper-900 shadow-sm transition hover:border-brand-200 hover:bg-brand-50/40";
const btnGhost =
  "inline-flex items-center justify-center rounded-xl border border-paper-200 bg-white px-6 py-3 text-sm font-semibold text-paper-900 shadow-sm transition hover:bg-paper-50";
const btnLink =
  "inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold text-brand-800 underline decoration-brand-300 underline-offset-4 hover:text-brand-950";

function roleLead(role: UserRole): string {
  if (role === "teacher") {
    return "Öğretmen hesabınızla giriş yaptınız. Taleplere teklif vermek ve aboneliğinizi yönetmek için panele gidin.";
  }
  if (role === "student") {
    return "Öğrenci hesabınızla giriş yaptınız. Talepleriniz, cüzdanınız ve kurslarınız panelden devam eder.";
  }
  if (role === "guardian") {
    return "Veli hesabınızla giriş yaptınız. Bağlı öğrenci özeti ve bildirimler veli panelindedir.";
  }
  return "Yönetim hesabıyla giriş yaptınız. Havale onayı ve operasyon işlemleri admin panelindedir.";
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
      <div className="mt-9 flex min-h-[52px] flex-col gap-3 sm:flex-row sm:flex-wrap">
        <span className="h-12 w-40 rounded-xl bg-paper-200/70" aria-hidden />
        <span className="h-12 w-44 rounded-xl bg-paper-200/50" aria-hidden />
        <span className="h-12 w-32 rounded-xl bg-paper-200/50" aria-hidden />
      </div>
    );
  }

  const role = getRoleFromToken(token);
  if (!role) {
    return (
      <>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link href="/ogretmenler" className={btnPrimary}>
            Öğretmen ara
          </Link>
          <Link href="/student/requests" className={btnSecondary}>
            Ders talebi
          </Link>
          <Link href="/courses" className={btnGhost}>
            Kurslar
          </Link>
          <RegisterNavLink className={btnLink}>Öğretmen kaydı</RegisterNavLink>
        </div>
      </>
    );
  }

  const panel = panelPathForRole(role);
  const panelLabel = panelNavLabel(role);

  return (
    <>
      <p className="mt-4 max-w-xl rounded-xl border border-brand-100/80 bg-brand-50/50 px-3 py-2 text-sm leading-relaxed text-brand-950/90">
        {roleLead(role)}
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link href={panel} className={btnPrimary}>
          {panelLabel}
        </Link>
        {role === "teacher" && (
          <>
            <Link href="/teacher/requests" className={btnSecondary}>
              Talep gelen kutusu
            </Link>
            <Link href="/ogretmenler" className={btnGhost}>
              Öğretmen ara
            </Link>
            <Link href="/courses" className={btnGhost}>
              Kurslar
            </Link>
          </>
        )}
        {role === "student" && (
          <>
            <Link href="/student/requests" className={btnSecondary}>
              Taleplerim
            </Link>
            <Link href="/student/panel" className={btnGhost}>
              Cüzdan & abonelik
            </Link>
            <Link href="/courses" className={btnGhost}>
              Kurslar
            </Link>
            <Link href="/ogretmenler" className={btnGhost}>
              Öğretmen ara
            </Link>
          </>
        )}
        {role === "guardian" && (
          <>
            <Link href="/guardian" className={btnSecondary}>
              Veli paneli
            </Link>
            <Link href="/student/requests" className={btnGhost}>
              Öğrenci talepleri
            </Link>
            <Link href="/courses" className={btnGhost}>
              Kurslar
            </Link>
          </>
        )}
        {role === "admin" && (
          <>
            <Link href="/admin" className={btnSecondary}>
              Admin işlemleri
            </Link>
            <Link href="/ogretmenler" className={btnGhost}>
              Öğretmen ara
            </Link>
          </>
        )}
      </div>
    </>
  );
}
