"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "../lib/api";
import { registerHrefWithReturn, safeInternalPath } from "../lib/authRedirect";
import { setToken } from "../lib/auth";

type LoginResponse = {
  token: string;
  user: { id: string; email: string; displayName: string; role: string };
};

function defaultDestForRole(role: string): string {
  if (role === "teacher") return "/teacher";
  if (role === "student") return "/student/panel";
  if (role === "guardian") return "/guardian";
  if (role === "admin") return "/admin";
  return "/";
}

function parseLoginApiError(err: unknown): { message: string; showRegisterHint: boolean } {
  const raw = err instanceof Error ? err.message : "login_failed";
  const noRid = raw.replace(/\s*\(requestId=[^)]+\)\s*$/i, "").trim();
  if (noRid.includes("invalid_credentials")) {
    return {
      message: "E-posta veya parola hatalı. Büyük/küçük harf ve boşluklara dikkat edin.",
      showRegisterHint: true,
    };
  }
  if (noRid.startsWith("[400]") && noRid.includes("validation:")) {
    return { message: "E-posta biçimi geçersiz.", showRegisterHint: false };
  }
  return { message: noRid, showRegisterHint: false };
}

/**
 * Tam seed (`npm run db:seed`) — apps/api/src/scripts/seed-dev.ts
 * Bootstrap admin (`npm run db:seed:admin`) — apps/api/src/scripts/seed-admin.ts
 * (web’deki varsayılanlar script ile aynı olmalı).
 */
const SEED_PASSWORD = "DevParola1";
/** Giriş “kullanıcı adı” = e-posta */
const BOOTSTRAP_ADMIN_EMAIL = "admin@benimogretmenim.local";
const BOOTSTRAP_ADMIN_PASSWORD = "BenimAdmin2026!";

type SeedPreset = {
  label: string;
  email: string;
  password: string;
  hint?: string;
};

const SEED_ROLE_PRESETS: readonly SeedPreset[] = [
  {
    label: "Admin",
    email: BOOTSTRAP_ADMIN_EMAIL,
    password: BOOTSTRAP_ADMIN_PASSWORD,
    hint: "→ /admin",
  },
  {
    label: "Admin (ilk seed)",
    email: "seed_dev@benimogretmenim.local",
    password: SEED_PASSWORD,
    hint: "db:seed sonrası",
  },
  { label: "Öğretmen", email: "teacher_dev@benimogretmenim.local", password: SEED_PASSWORD },
  { label: "Öğrenci", email: "student_dev@benimogretmenim.local", password: SEED_PASSWORD },
  { label: "Veli", email: "guardian_dev@benimogretmenim.local", password: SEED_PASSWORD },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showRegisterHint, setShowRegisterHint] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showRolePresets, setShowRolePresets] = useState(false);

  useEffect(() => {
    const envOn = process.env.NEXT_PUBLIC_DEV_LOGIN_PRESETS === "1";
    const isDev = process.env.NODE_ENV === "development";
    const h = typeof window !== "undefined" ? window.location.hostname : "";
    const local =
      h === "localhost" ||
      h === "127.0.0.1" ||
      h === "[::1]" ||
      h.endsWith(".local");
    setShowRolePresets(envOn || isDev || local);
  }, []);

  const returnUrl = useMemo(
    () =>
      safeInternalPath(searchParams.get("returnUrl")) ??
      safeInternalPath(searchParams.get("next")),
    [searchParams],
  );

  const canSubmit = useMemo(
    () => email.trim().length > 3 && password.trim().length > 0 && !loading,
    [email, password, loading],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setShowRegisterHint(false);
    setLoading(true);
    try {
      const r = await apiFetch<LoginResponse>("/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(r.token);
      const dest = returnUrl ?? defaultDestForRole(r.user.role);
      router.push(dest);
    } catch (err) {
      const parsed = parseLoginApiError(err);
      setError(parsed.message);
      setShowRegisterHint(parsed.showRegisterHint);
    } finally {
      setLoading(false);
    }
  }

  const showDevFooter = process.env.NODE_ENV !== "production";

  return (
    <div className="flex min-h-[calc(100vh-1px)] items-center justify-center bg-paper-50 px-6 py-10">
      <div className="w-full max-w-md rounded-2xl border border-paper-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Giriş yap</h1>
          <p className="mt-1 text-sm text-paper-800/75">E-posta ve parolanızla devam edin.</p>
          {showRolePresets ? (
            <div className="mt-4 rounded-xl border border-paper-200 bg-paper-50 p-3">
              <p className="text-xs text-paper-800/65">Yerel ortam — tek tıkla doldur</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SEED_ROLE_PRESETS.map((p) => (
                  <button
                    key={p.email}
                    type="button"
                    onClick={() => {
                      setEmail(p.email);
                      setPassword(p.password);
                      setError(null);
                      setShowRegisterHint(false);
                    }}
                    className="rounded-lg border border-paper-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-paper-900 hover:border-brand-300"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <details className="mt-3 text-xs text-paper-800/70">
                <summary className="cursor-pointer font-medium text-paper-800">Seed komutları ve parolalar</summary>
                <div className="mt-2 space-y-2 border-t border-paper-200 pt-2 font-mono text-[0.65rem] leading-relaxed">
                  <p>
                    Admin: <span className="select-all">{BOOTSTRAP_ADMIN_EMAIL}</span> —{" "}
                    <span className="select-all">{BOOTSTRAP_ADMIN_PASSWORD}</span>
                  </p>
                  <p>
                    Tam seed roller: <span className="select-all">{SEED_PASSWORD}</span>
                  </p>
                  <p className="font-sans text-paper-800/80">
                    <span className="font-mono">npm run db:seed:admin</span> /{" "}
                    <span className="font-mono">db:seed</span>. Admin için{" "}
                    <Link href="/admin" className="text-brand-800 underline">
                      /admin
                    </Link>
                    .
                  </p>
                </div>
              </details>
            </div>
          ) : (
            <p className="mt-3 text-xs text-paper-800/55">
              Hesabınız yok mu?{" "}
              <Link
                href={returnUrl ? registerHrefWithReturn(returnUrl) : "/kayit"}
                className="font-medium text-brand-800 underline"
              >
                Kayıt olun
              </Link>
              . Admin hesabı kayıtla oluşturulmaz.
            </p>
          )}
          {returnUrl && (
            <p className="mt-2 text-xs text-paper-800/50">
              Sonra: <span className="font-mono text-paper-800">{returnUrl}</span>
            </p>
          )}
          {showRolePresets ? (
            <p className="mt-3 text-sm">
              <Link
                href={returnUrl ? registerHrefWithReturn(returnUrl) : "/kayit"}
                className="font-medium text-brand-800 underline"
              >
                Yeni hesap oluştur
              </Link>
            </p>
          ) : null}
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <div className="mb-1 text-sm font-medium text-paper-800">E-posta</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
              autoComplete="email"
              inputMode="email"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-sm font-medium text-paper-800">Parola</div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
              type="password"
              autoComplete="current-password"
            />
          </label>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <p>{error}</p>
              {showRegisterHint ? (
                <p className="mt-2 text-red-800/90">
                  Hesabınız yoksa{" "}
                  <Link
                    href={returnUrl ? registerHrefWithReturn(returnUrl) : "/kayit"}
                    className="font-semibold text-brand-900 underline"
                  >
                    kayıt olun
                  </Link>
                  .
                </p>
              ) : null}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-xl bg-brand-800 px-3 py-2.5 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-50"
          >
            {loading ? "Giriş yapılıyor..." : "Giriş yap"}
          </button>

          {showDevFooter ? (
            <p className="text-center text-[0.65rem] text-paper-800/45">
              API{" "}
              <span className="font-mono">
                {process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3002"}
              </span>
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-1px)] items-center justify-center bg-paper-50 px-6">
          <p className="text-sm text-paper-800/55">Yükleniyor…</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
