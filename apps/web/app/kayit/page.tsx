"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "../lib/api";
import { loginHrefWithReturn, safeInternalPath } from "../lib/authRedirect";
import { setToken } from "../lib/auth";

type RegResponse = {
  token: string;
  user: { id: string; email: string; displayName: string; role: string };
};

function defaultDestForRole(role: string): string {
  if (role === "teacher") return "/teacher";
  if (role === "student") return "/student/requests";
  if (role === "guardian") return "/guardian";
  return "/";
}

function KayitForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"student" | "teacher" | "guardian">(
    "student",
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const returnUrl = useMemo(
    () =>
      safeInternalPath(searchParams.get("returnUrl")) ??
      safeInternalPath(searchParams.get("next")),
    [searchParams],
  );

  const loginHref = returnUrl ? loginHrefWithReturn(returnUrl) : "/login";

  const canSubmit = useMemo(
    () =>
      email.trim().length > 3 &&
      password.length >= 8 &&
      displayName.trim().length >= 1 &&
      !loading,
    [email, password, displayName, loading],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await apiFetch<RegResponse>("/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          password,
          displayName: displayName.trim(),
          role,
        }),
      });
      setToken(r.token);
      const dest = returnUrl ?? defaultDestForRole(r.user.role);
      router.push(dest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "register_failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <div className="text-sm font-medium text-zinc-500">Hesap oluştur</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
            Kayıt ol
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Zaten hesabın var mı?{" "}
            <Link href={loginHref} className="font-medium text-brand-800 underline">
              Giriş yap
            </Link>
          </p>
          {returnUrl && (
            <p className="mt-2 text-xs text-zinc-500">
              Kayıttan sonra: <span className="font-mono text-zinc-700">{returnUrl}</span>
            </p>
          )}
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <div className="mb-1 text-sm font-medium text-zinc-700">Rol</div>
            <select
              value={role}
              onChange={(e) =>
                setRole(e.target.value as "student" | "teacher" | "guardian")
              }
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
            >
              <option value="student">Öğrenci</option>
              <option value="teacher">Öğretmen</option>
              <option value="guardian">Veli</option>
            </select>
          </label>

          <label className="block">
            <div className="mb-1 text-sm font-medium text-zinc-700">
              Görünen ad
            </div>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              placeholder="Ad Soyad"
              autoComplete="name"
            />
          </label>

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
              autoComplete="new-password"
              minLength={8}
            />
            <p className="mt-1 text-xs text-zinc-500">En az 8 karakter.</p>
          </label>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-xl bg-brand-700 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Kaydediliyor…" : "Kayıt ol"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function KayitPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <p className="text-sm text-zinc-500">Yükleniyor…</p>
        </div>
      }
    >
      <KayitForm />
    </Suspense>
  );
}
