"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "../lib/api";
import { loginHrefWithReturn, safeInternalPath } from "../lib/authRedirect";
import { setToken } from "../lib/auth";
import { trackEvent } from "../lib/trackEvent";
import {
  REGISTER_ROLE_CARDS,
  type RegisterRole,
  roleCardByRegisterRole,
} from "../lib/roleFeatures";
import { RoleFeatureList } from "../components/marketing/RoleFeatureOverview";

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

const roleOnboarding = {
  student: {
    title: "Öğrenci — 3 adım",
    steps: ["Talep aç veya soru gönder", "Teklifleri karşılaştır", "Panelden takip et"],
  },
  teacher: {
    title: "Öğretmen — 3 adım",
    steps: ["Profili tamamla", "Taleplere teklif ver", "Dersleri yönet"],
  },
  guardian: {
    title: "Veli — 3 adım",
    steps: ["Öğrenciyi bağla", "Bildirimleri oku", "Planı takip et"],
  },
} as const;

function KayitForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = searchParams.get("role");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [role, setRole] = useState<RegisterRole>(
    initialRole === "teacher" || initialRole === "guardian" ? initialRole : "student",
  );
  const [error, setError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);

  const returnUrl = useMemo(
    () =>
      safeInternalPath(searchParams.get("returnUrl")) ??
      safeInternalPath(searchParams.get("next")),
    [searchParams],
  );

  const loginHref = returnUrl ? loginHrefWithReturn(returnUrl) : "/login";
  const roleHint =
    role === "teacher"
      ? "Öğretmen hesabı ile profilinizi web siteniz gibi kurup öğrenciye profesyonel görünebilirsiniz; abonelikle sınırsız teklif, tam profil, WhatsApp/telefon tercihi ve kampanya görünürlüğü kazanabilirsiniz."
      : role === "guardian"
        ? "Veli hesabı ile öğrencinizin ders, çalışma, ödeme ve abonelikten doğan kullanım haklarını güvenli şekilde takip edebilirsiniz."
        : "Öğrenci hesabı ile öğretmen arayabilir, soru sorabilir, kurslara katılabilir; yıllık abonelikle günlük ilan ve soru hakkınızı büyütebilirsiniz.";

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
      trackEvent("registration_completed", { entityType: "user", entityId: r.user.id, metadata: { role: r.user.role } });
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

  const onboarding = roleOnboarding[role];
  const selectedRoleDiscovery = roleCardByRegisterRole(role);
  const activeOnboardingStep = onboarding.steps[Math.min(onboardingStep, onboarding.steps.length - 1)];

  function selectRegisterRole(nextRole: RegisterRole) {
    setRole(nextRole);
    setOnboardingStep(0);
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-paper-50 px-4 py-12">
      <div className="grid w-full max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
        <aside className="rounded-2xl border border-brand-200 bg-brand-50 p-6 text-brand-950">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-900/70">
            Kayıt olmadan önce gör
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">{onboarding.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-brand-950/80">
            Öğrenci, veli ve öğretmen kendi hesabında hangi araçları bulacağını daha kayıt ekranındayken görebilir.
          </p>
          <div className="mt-5 rounded-2xl border border-brand-200 bg-white/80 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-900/60">
              {selectedRoleDiscovery.eyebrow}
            </div>
            <h3 className="mt-2 text-lg font-semibold text-brand-950">
              {selectedRoleDiscovery.role} hesabında ne bulacaksınız?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-brand-950/80">{selectedRoleDiscovery.summary}</p>
            <RoleFeatureList
              features={selectedRoleDiscovery.features}
              subscriptionWins={selectedRoleDiscovery.subscriptionWins}
              subscriptionLabel="Abonelikle güçlenen taraf"
              maxListHeightClass="max-h-72"
              size="sm"
              variant="brand"
            />
            <p className="mt-4 rounded-xl bg-brand-50 px-3 py-2 text-xs font-semibold leading-relaxed text-brand-950">
              {selectedRoleDiscovery.nextStep}
            </p>
          </div>
          <div className="mt-5 rounded-2xl bg-white/75 p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-brand-900/70">
              <span>Adım {onboardingStep + 1}/{onboarding.steps.length}</span>
              <span>{Math.round(((onboardingStep + 1) / onboarding.steps.length) * 100)}%</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-brand-100">
              <div
                className="h-2 rounded-full bg-brand-800"
                style={{ width: `${((onboardingStep + 1) / onboarding.steps.length) * 100}%` }}
              />
            </div>
            <p className="mt-4 text-sm leading-relaxed">{activeOnboardingStep}</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setOnboardingStep((step) => Math.max(0, step - 1))}
                disabled={onboardingStep === 0}
                className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-xs font-semibold text-brand-900 disabled:opacity-45"
              >
                Geri
              </button>
              <button
                type="button"
                onClick={() => setOnboardingStep((step) => Math.min(onboarding.steps.length - 1, step + 1))}
                disabled={onboardingStep >= onboarding.steps.length - 1}
                className="rounded-xl bg-brand-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-45"
              >
                İleri
              </button>
            </div>
          </div>
          <ol className="mt-4 space-y-2">
            {onboarding.steps.map((step, index) => (
              <li key={step} className={`flex gap-3 rounded-xl p-3 text-sm leading-relaxed ${index === onboardingStep ? "bg-white text-brand-950 ring-2 ring-brand-300" : "bg-white/55 text-brand-900/70"}`}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-800 text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <Link href="/guven" className="mt-5 inline-flex text-sm font-semibold text-brand-900 underline">
            Güven ve ödeme süreçlerini incele
          </Link>
        </aside>
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
              onChange={(e) => {
                selectRegisterRole(e.target.value as RegisterRole);
              }}
              className="w-full rounded-xl border border-paper-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            >
              <option value="student">Öğrenci</option>
              <option value="teacher">Öğretmen</option>
              <option value="guardian">Veli</option>
            </select>
          </label>

          <section className="rounded-2xl border border-paper-200 bg-paper-50 p-3" aria-labelledby="role-discovery-title">
            <div id="role-discovery-title" className="text-sm font-semibold text-paper-900">
              Bu platformda ne bulacaksınız?
            </div>
            <p className="mt-1 text-xs leading-relaxed text-paper-800/65">
              Rolünüzü seçin; öğrenci, veli ve öğretmen için sunulan alanları kayıt olmadan önce görün.
            </p>
            <div className="mt-3 grid gap-2">
              {REGISTER_ROLE_CARDS.map((info) => {
                const typedRole = info.registerRole;
                const selected = typedRole === role;
                return (
                  <button
                    key={typedRole}
                    type="button"
                    onClick={() => {
                      selectRegisterRole(typedRole);
                    }}
                    aria-label={`${info.role} hesabını incele`}
                    className={`rounded-xl border px-3 py-3 text-left transition ${
                      selected
                        ? "border-brand-300 bg-white shadow-sm ring-2 ring-brand-100"
                        : "border-paper-200 bg-white/70 hover:border-brand-200"
                    }`}
                    aria-pressed={selected}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-paper-950">{info.role}</div>
                        <div className="mt-0.5 text-xs font-medium text-brand-800">{info.eyebrow}</div>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${selected ? "bg-brand-800 text-white" : "bg-paper-100 text-paper-800/65"}`}>
                        {selected ? "Seçili" : "İncele"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-paper-800/70">{info.summary}</p>
                    <RoleFeatureList
                      features={info.features}
                      subscriptionWins={info.subscriptionWins}
                      subscriptionLabel="Abonelikle açılanlar"
                      maxListHeightClass="max-h-56 sm:max-h-none"
                      variant="default"
                    />
                    <p className="mt-2 rounded-lg bg-paper-50 px-2 py-1.5 text-xs font-medium leading-relaxed text-paper-800/70">
                      {info.nextStep}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

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
