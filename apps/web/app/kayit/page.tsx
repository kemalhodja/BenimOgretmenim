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
  if (role === "teacher") return "/teacher?onboarding=1";
  if (role === "student") return "/student/panel?onboarding=1";
  if (role === "guardian") return "/guardian?onboarding=1";
  return "/";
}

function parseRegisterApiError(err: unknown): { message: string; emailTaken: boolean } {
  const raw = err instanceof Error ? err.message : "register_failed";
  const emailTaken = /email_already_registered/.test(raw);
  const noRid = raw.replace(/\s*\(requestId=[^)]+\)\s*$/i, "").trim();
  if (emailTaken) {
    return {
      message: "Bu e-posta adresi zaten kayıtlı. Giriş yapın veya farklı bir adres kullanın.",
      emailTaken: true,
    };
  }
  if (noRid.startsWith("[400]") && noRid.includes("validation:")) {
    const parts = noRid.replace(/^\[400\]\s*/, "").split(":");
    const hint = parts.length >= 3 ? parts.slice(2).join(":") : "";
    return {
      message: hint ? `Geçersiz bilgi: ${hint}` : "Bilgileri kontrol edin (e-posta, parola, görünen ad).",
      emailTaken: false,
    };
  }
  return { message: noRid, emailTaken: false };
}

function KayitForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = searchParams.get("role");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [role, setRole] = useState<"student" | "teacher" | "guardian">(
    initialRole === "teacher" || initialRole === "guardian" ? initialRole : "student",
  );
  const [error, setError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);
  const [loading, setLoading] = useState(false);

  const returnUrl = useMemo(
    () =>
      safeInternalPath(searchParams.get("returnUrl")) ??
      safeInternalPath(searchParams.get("next")),
    [searchParams],
  );

  const loginHref = returnUrl ? loginHrefWithReturn(returnUrl) : "/login";
  const roleHint =
    role === "teacher"
      ? "Öğretmen hesabı ile profilinizi tamamlayıp teklif ve ders akışlarına katılabilirsiniz."
      : role === "guardian"
        ? "Veli hesabı ile öğrencinizin ders, çalışma ve bildirim özetlerini takip edebilirsiniz."
        : "Öğrenci hesabı ile öğretmen arayabilir, soru sorabilir ve çalışma planı oluşturabilirsiniz.";

  const canSubmit = useMemo(
    () =>
      email.trim().length > 3 &&
      password.length >= 8 &&
      password === passwordConfirm &&
      displayName.trim().length >= 1 &&
      acceptedTerms &&
      !loading,
    [email, password, passwordConfirm, displayName, acceptedTerms, loading],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEmailTaken(false);
    if (password !== passwordConfirm) {
      setError("Parola tekrarı eşleşmiyor.");
      return;
    }
    if (!acceptedTerms) {
      setError("Devam etmek için kullanım koşulları ve KVKK bilgilendirmesini kabul etmelisiniz.");
      return;
    }
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
      const parsed = parseRegisterApiError(err);
      setError(parsed.message);
      setEmailTaken(parsed.emailTaken);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-paper-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-paper-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-paper-900">Kayıt ol</h1>
          <p className="mt-1 text-sm text-paper-800/75">Öğrenci, öğretmen veya veli hesabı</p>
          <p className="mt-2 rounded-xl bg-brand-50 px-3 py-2 text-xs font-medium text-brand-900">
            {roleHint}
          </p>
          <p className="mt-3 text-sm text-paper-800/85">
            Zaten hesabınız var mı?{" "}
            <Link href={loginHref} className="font-medium text-brand-800 underline">
              Giriş yap
            </Link>
          </p>
          {returnUrl && (
            <p className="mt-2 text-xs text-paper-800/50">
              Sonra: <span className="font-mono text-paper-800">{returnUrl}</span>
            </p>
          )}
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <div className="mb-1 text-sm font-medium text-paper-800">Rol</div>
            <select
              value={role}
              onChange={(e) =>
                setRole(e.target.value as "student" | "teacher" | "guardian")
              }
              className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            >
              <option value="student">Öğrenci</option>
              <option value="teacher">Öğretmen</option>
              <option value="guardian">Veli</option>
            </select>
          </label>

          <label className="block">
            <div className="mb-1 text-sm font-medium text-paper-800">
              Görünen ad
            </div>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
              placeholder="Ad Soyad"
              autoComplete="name"
            />
          </label>

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
              autoComplete="new-password"
              minLength={8}
            />
            <p className="mt-1 text-xs text-paper-800/55">En az 8 karakter.</p>
          </label>

          <label className="block">
            <div className="mb-1 text-sm font-medium text-paper-800">Parola tekrar</div>
            <input
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
              type="password"
              autoComplete="new-password"
              minLength={8}
            />
            {passwordConfirm && passwordConfirm !== password ? (
              <p className="mt-1 text-xs text-red-700">Parola tekrarı eşleşmiyor.</p>
            ) : null}
          </label>

          <label className="flex items-start gap-2 rounded-xl border border-paper-200 bg-paper-50 px-3 py-2 text-xs leading-relaxed text-paper-800/75">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-paper-300"
            />
            <span>
              <Link href="/kullanim-kosullari" className="font-semibold text-brand-800 underline-offset-4 hover:underline">
                Kullanım koşullarını
              </Link>{" "}
              ve{" "}
              <Link href="/gizlilik" className="font-semibold text-brand-800 underline-offset-4 hover:underline">
                Gizlilik/KVKK bilgilendirmesini
              </Link>{" "}
              okudum, kabul ediyorum.
            </span>
          </label>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <p>{error}</p>
              {emailTaken ? (
                <p className="mt-2">
                  <Link href={loginHref} className="font-semibold text-brand-900 underline">
                    Giriş sayfasına git
                  </Link>
                </p>
              ) : null}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-xl bg-brand-800 px-3 py-2.5 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-50"
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
        <div className="flex min-h-[60vh] items-center justify-center bg-paper-50 px-4">
          <p className="text-sm text-paper-800/55">Yükleniyor…</p>
        </div>
      }
    >
      <KayitForm />
    </Suspense>
  );
}
