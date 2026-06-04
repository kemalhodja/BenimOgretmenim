"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { getRoleFromToken, getToken, panelPathForRole, type UserRole } from "../lib/auth";
import { loginHrefWithReturn } from "../lib/authRedirect";

type PlanRow = {
  code: string;
  title: string;
  duration_months: number;
  price_minor: number;
  currency: string;
};

type StudentSubscription = {
  active: boolean;
  subscription: { expires_at?: string; months_count?: number } | null;
  pricePerMonthMinor: number;
};

function minorToTl(n: number): string {
  return (n / 100).toFixed(2);
}

function roleName(role: UserRole): string {
  if (role === "student") return "Öğrenci";
  if (role === "teacher") return "Öğretmen";
  if (role === "guardian") return "Veli";
  return "Admin";
}

export function RoleBasedPricing() {
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [studentSub, setStudentSub] = useState<StudentSubscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sync = useCallback(() => setToken(getToken()), []);

  useEffect(() => {
    setMounted(true);
    sync();
    const on = () => sync();
    window.addEventListener("bo:auth-changed", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("bo:auth-changed", on);
      window.removeEventListener("storage", on);
    };
  }, [sync]);

  const role = getRoleFromToken(token);

  useEffect(() => {
    if (!mounted || !token || !role) return;
    setLoading(true);
    setError(null);
    setPlans([]);
    setStudentSub(null);

    const req =
      role === "teacher" || role === "admin"
        ? apiFetch<{ plans: PlanRow[] }>("/v1/subscriptions/plans", { token }).then((r) => setPlans(r.plans ?? []))
        : role === "student"
          ? apiFetch<StudentSubscription>("/v1/student-platform/subscription/me", { token }).then(setStudentSub)
          : Promise.resolve();

    req
      .catch((e) => setError(e instanceof Error ? e.message : "Fiyat bilgisi yüklenemedi."))
      .finally(() => setLoading(false));
  }, [mounted, role, token]);

  if (!mounted) {
    return (
      <section className="mt-10 rounded-2xl border border-paper-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold tracking-tight text-paper-900">Üyeliğe özel fiyatlar</h2>
        <p className="mt-2 text-sm text-paper-800/65">Fiyat alanı hazırlanıyor…</p>
      </section>
    );
  }

  if (!token || !role) {
    return (
      <section className="mt-10 rounded-2xl border border-brand-200 bg-brand-50 p-6 shadow-sm">
        <h2 className="text-xl font-semibold tracking-tight text-brand-950">Fiyatlar üyelikten sonra görünür</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand-900">
          Abonelik tutarları herkese açık vitrinde gösterilmez. Öğrenci, öğretmen veya veli hesabı açtıktan sonra
          sadece kendi rolünüze uygun fiyat ve ödeme seçeneklerini panelinizde görürsünüz.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/kayit?role=student" className="rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white">
            Öğrenci hesabı aç
          </Link>
          <Link
            href="/kayit?role=teacher"
            className="rounded-xl border border-brand-200 bg-white px-4 py-2 text-sm font-semibold text-brand-900"
          >
            Öğretmen başvurusu
          </Link>
          <Link
            href={loginHrefWithReturn("/fiyatlar")}
            className="rounded-xl border border-paper-300 bg-white px-4 py-2 text-sm font-medium text-paper-900"
          >
            Giriş yap
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-10 rounded-2xl border border-paper-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-paper-900">
            {roleName(role)} hesabınıza uygun fiyatlar
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-paper-800/70">
            Bu bölüm sadece oturum açmış kullanıcının rolüne göre fiyat gösterir; diğer rollerin abonelik tutarları
            listelenmez.
          </p>
        </div>
        <Link
          href={panelPathForRole(role)}
          className="w-fit rounded-xl border border-paper-300 bg-paper-50 px-4 py-2 text-sm font-semibold text-paper-900"
        >
          Panelime git
        </Link>
      </div>

      {loading ? <p className="mt-5 text-sm text-paper-800/55">Fiyat bilgisi yükleniyor…</p> : null}
      {error ? (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</div>
      ) : null}

      {role === "student" && studentSub ? (
        <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50 p-5">
          <div className="text-sm font-medium text-brand-900">Öğrenci platform aboneliği</div>
          <div className="mt-2 text-2xl font-semibold text-brand-950">
            {minorToTl(studentSub.pricePerMonthMinor)} TL / ay
          </div>
          <p className="mt-2 text-sm text-brand-900">
            Soru çözüm havuzu, çalışma planı, canlı ders akışı ve öğrenci paneli özellikleri için kullanılır.
          </p>
          <Link
            href="/student/panel"
            className="mt-4 inline-flex rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white"
          >
            Öğrenci panelinde yönet
          </Link>
        </div>
      ) : null}

      {(role === "teacher" || role === "admin") && plans.length > 0 ? (
        <ul className="mt-5 grid gap-3 md:grid-cols-2">
          {plans.map((p) => (
            <li key={p.code} className="rounded-xl border border-paper-200 bg-paper-50 p-5">
              <div className="text-lg font-semibold text-paper-900">{p.title}</div>
              <div className="mt-1 text-sm text-paper-800/55">
                {p.duration_months} ay · {p.code}
              </div>
              <div className="mt-3 text-2xl font-semibold text-brand-800">
                {minorToTl(p.price_minor)} {p.currency}
              </div>
              <Link
                href="/teacher"
                className="mt-4 inline-flex rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white"
              >
                Öğretmen panelinde satın al
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {role === "guardian" ? (
        <div className="mt-5 rounded-xl border border-paper-200 bg-paper-50 p-5">
          <div className="text-sm font-semibold text-paper-900">Veli hesabı takip hesabıdır</div>
          <p className="mt-2 text-sm text-paper-800/70">
            Veli panelinde bağlı öğrencinin ders, bildirim ve çalışma ilerlemesini takip edersiniz. Öğrenci aboneliği
            öğrencinin kendi panelinde görünür ve yönetilir.
          </p>
          <Link
            href="/guardian"
            className="mt-4 inline-flex rounded-xl border border-paper-300 bg-white px-4 py-2 text-sm font-semibold text-paper-900"
          >
            Veli paneline git
          </Link>
        </div>
      ) : null}
    </section>
  );
}
