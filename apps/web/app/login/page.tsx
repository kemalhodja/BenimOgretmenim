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
  if (role === "student") return "/student/requests";
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

  return (
    <div className="flex min-h-[calc(100vh-1px)] items-center justify-center bg-zinc-50 px-6 py-10">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <div className="text-sm font-medium text-zinc-500">
            BenimÖğretmenim
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
            Giriş
          </h1>
          {showRolePresets ? (
            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3">
              <p className="text-xs font-medium text-zinc-600">
                Hızlı doldur — API’de{" "}
                <span className="font-mono">npm run db:seed:admin</span> (admin) ve{" "}
                <span className="font-mono">npm run db:seed</span> (diğer roller)
              </p>
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
                    className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm transition hover:border-brand-300 hover:text-brand-900"
                  >
                    {p.label}
                    {"hint" in p && p.hint ? (
                      <span className="ml-1 font-normal text-zinc-500">{p.hint}</span>
                    ) : null}
                  </button>
                ))}
              </div>
              <p className="mt-2 font-mono text-[0.65rem] leading-snug text-zinc-500">
                Admin parola: <span className="select-all">{BOOTSTRAP_ADMIN_PASSWORD}</span>
                <br />
                Tam seed (öğretmen/öğrenci/veli): <span className="select-all">{SEED_PASSWORD}</span>
              </p>
              <p className="mt-2 text-[0.65rem] leading-snug text-zinc-600">
                <strong className="text-zinc-800">Admin:</strong> kayıt formunda admin yoktur.{" "}
                <span className="font-mono">npm run db:seed:admin</span> ile{" "}
                <span className="font-mono">{BOOTSTRAP_ADMIN_EMAIL}</span> oluşturulur veya parolası yenilenir.
                Girişten sonra <Link href="/admin" className="font-medium text-brand-800 underline">/admin</Link>;
                havale proxy için <span className="font-mono">ADMIN_API_SECRET</span>.
              </p>
            </div>
          ) : (
            <div className="mt-2 space-y-1 text-xs text-zinc-500">
              <p>
                Seed / hızlı giriş: yerelde açın,{" "}
                <span className="font-mono">NEXT_PUBLIC_DEV_LOGIN_PRESETS=1</span> veya{" "}
                <span className="font-mono">next dev</span> kullanın.
              </p>
              <p>
                <strong className="text-zinc-700">Admin girişi:</strong> üretimde{" "}
                <span className="font-mono">role = admin</span> kullanıcı DB ile tanımlanır. Yerelde:{" "}
                <span className="font-mono">npm run db:seed:admin</span> →{" "}
                <span className="font-mono">{BOOTSTRAP_ADMIN_EMAIL}</span> /{" "}
                <span className="font-mono">{BOOTSTRAP_ADMIN_PASSWORD}</span>. Eski tam seed admin:{" "}
                <span className="font-mono">seed_dev@benimogretmenim.local</span> /{" "}
                <span className="font-mono">{SEED_PASSWORD}</span>.
              </p>
            </div>
          )}
          {returnUrl && (
            <p className="mt-2 text-xs text-zinc-500">
              Girişten sonra: <span className="font-mono text-zinc-700">{returnUrl}</span>
            </p>
          )}
          <p className="mt-2 text-sm">
            <Link
              href={returnUrl ? registerHrefWithReturn(returnUrl) : "/kayit"}
              className="font-medium text-brand-800 underline"
            >
              Kayıt ol
            </Link>
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <div className="mb-1 text-sm font-medium text-zinc-700">E-posta</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              autoComplete="email"
              inputMode="email"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-sm font-medium text-zinc-700">Parola</div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
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
                  . Canlı ortamda örnek <span className="font-mono">*_dev@benimogretmenim.local</span> hesapları
                  yalnızca veritabanına seed uygulandıysa vardır.
                </p>
              ) : null}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-xl bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "Giriş yapılıyor..." : "Giriş yap"}
          </button>

          <div className="text-xs text-zinc-500">
            API:{" "}
            <span className="font-mono">
              {process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3002"}
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-1px)] items-center justify-center bg-zinc-50 px-6">
          <p className="text-sm text-zinc-500">Yükleniyor…</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
