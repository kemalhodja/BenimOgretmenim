"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
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
  if (role === "admin") return "/admin/bank";
  return "/";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("teacher_dev@benimogretmenim.local");
  const [password, setPassword] = useState("DevParola1");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      setError(err instanceof Error ? err.message : "login_failed");
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
          <p className="mt-1 text-xs text-zinc-500">
            Yerel deneme: <span className="font-mono text-zinc-600">teacher_dev / student_dev / guardian_dev</span>
            @benimogretmenim.local · <span className="font-mono">DevParola1</span>
          </p>
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
              {error}
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
