"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCachedRole,
  getRoleFromToken,
  getToken,
  panelNavLabel,
  panelPathForRole,
  refreshSessionFromServer,
  type UserRole,
} from "../lib/auth";
import { loginHrefWithReturn } from "../lib/authRedirect";
import {
  filterBenefits,
  filterQuickAccess,
  filterTips,
  POST_INSTALL_STEPS,
  primaryQuickLink,
  ROLE_META,
  roleDisplayName,
  roleIntro,
  type UygulamaQuickAccess,
} from "../lib/uygulamaContent";

function RoleBadge({ role }: { role: UserRole }) {
  const meta = ROLE_META[role];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${meta.badgeClass}`}
    >
      {meta.label}
    </span>
  );
}

function QuickAccessCard({
  item,
  role,
  compact,
}: {
  item: UygulamaQuickAccess;
  role?: UserRole;
  compact?: boolean;
}) {
  const cardRole = role ?? item.roles[0];
  const meta = ROLE_META[cardRole];
  const primary = item.links.find((l) => l.primary) ?? item.links[0];

  return (
    <article
      className={`rounded-2xl border border-paper-200 bg-white p-4 shadow-sm ring-1 ${meta.cardRingClass} ${compact ? "" : "sm:p-5"}`}
      data-testid={role ? "uygulama-quick-access-active" : `uygulama-quick-access-${cardRole}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <RoleBadge role={cardRole} />
        <h2 className="text-base font-semibold text-paper-950">{item.title}</h2>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-paper-800/75">{item.body}</p>
      {primary ? (
        <Link
          href={primary.href}
          className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900 sm:w-auto"
        >
          {primary.label}
        </Link>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {item.links
          .filter((l) => l.href !== primary?.href)
          .map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-900 hover:bg-brand-100"
            >
              {link.label}
            </Link>
          ))}
      </div>
    </article>
  );
}

export function RoleBasedUygulamaSections() {
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

  const role = mounted ? getRoleFromToken(token) ?? sessionRole : null;
  const loggedIn = mounted && Boolean(token || sessionRole);
  const quickAccess = useMemo(() => filterQuickAccess(role, loggedIn), [loggedIn, role]);
  const benefits = useMemo(() => filterBenefits(role, loggedIn), [loggedIn, role]);
  const tips = useMemo(() => filterTips(role, loggedIn), [loggedIn, role]);
  const panelHref = role ? panelPathForRole(role) : "/";
  const panelLabel = role ? panelNavLabel(role) : "Ana sayfa";
  const heroLink = useMemo(() => primaryQuickLink(quickAccess), [quickAccess]);
  const postInstall = role ? POST_INSTALL_STEPS[role] : null;

  if (!mounted) {
    return (
      <div data-testid="uygulama-loading" className="mt-6 space-y-4">
        <div className="h-20 animate-pulse rounded-2xl bg-paper-200/60" aria-hidden />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-paper-200/50" aria-hidden />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div data-testid="uygulama-role-sections" className="mt-6 space-y-8">
      {loggedIn && role ? (
        <div
          data-testid="uygulama-role-banner"
          className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-center gap-2">
            <RoleBadge role={role} />
            <span className="text-xs font-medium text-paper-800/70">Kişiselleştirilmiş görünüm</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-brand-950">{roleIntro(role)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={panelHref}
              className="inline-flex rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900"
            >
              {panelLabel}
            </Link>
            {heroLink && heroLink.href !== panelHref ? (
              <Link
                href={heroLink.href}
                className="inline-flex rounded-xl border border-brand-300 bg-white px-4 py-2 text-sm font-semibold text-brand-900 hover:bg-brand-50"
              >
                {heroLink.label}
              </Link>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-paper-200 bg-white p-4 text-sm text-paper-800/85">
          <p>
            <strong>Oturum açık değil.</strong> Aşağıda öğrenci, öğretmen ve veli için önizleme
            kartları var. Giriş yaptığınızda yalnızca kendi panelinize uygun menü görünür.
          </p>
          <Link
            href={loginHrefWithReturn("/uygulama")}
            className="mt-3 inline-flex text-sm font-semibold text-brand-800 underline underline-offset-2"
          >
            Giriş yap — size özel görünüm
          </Link>
        </div>
      )}

      <nav
        aria-label="Kurulum bölümleri"
        className="flex flex-wrap gap-2 text-xs font-medium"
      >
        {[
          { href: "#hizli-erisim", label: "Hızlı erişim" },
          { href: "#android", label: "Android" },
          { href: "#ios", label: "iPhone" },
          { href: "#play", label: "Play Store" },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="rounded-full border border-paper-200 bg-white px-3 py-1.5 text-paper-800 hover:border-brand-200 hover:bg-brand-50"
          >
            {item.label}
          </a>
        ))}
      </nav>

      <section className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
        <h2 className="text-lg font-semibold text-brand-950">
          {loggedIn && role ? `${roleDisplayName(role)} için mobil avantajlar` : "Mobil kullanım neden önemli?"}
        </h2>
        <div
          className={`mt-4 grid gap-3 ${benefits.length >= 3 ? "sm:grid-cols-3" : benefits.length === 2 ? "sm:grid-cols-2" : ""}`}
        >
          {benefits.map((benefit) => (
            <div key={benefit.title} className="rounded-xl border border-brand-100 bg-white/90 p-3">
              <h3 className="text-sm font-semibold text-paper-950">{benefit.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-paper-800/70">{benefit.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="hizli-erisim" className="scroll-mt-24" aria-label="Hızlı erişim">
        <h2 className="text-lg font-semibold text-paper-950">
          {loggedIn && role ? "Panel kısayollarınız" : "Rol bazlı hızlı erişim önizlemesi"}
        </h2>
        <p className="mt-1 text-sm text-paper-800/70">
          {loggedIn && role
            ? "Ana ekrana ekledikten sonra bu sayfalara alt menüden de ulaşırsınız."
            : "Her rol için tipik ilk adımlar; giriş sonrası yalnızca sizinkiler kalır."}
        </p>
        <div
          className={`mt-4 grid gap-4 ${quickAccess.length === 1 ? "max-w-xl" : "md:grid-cols-3"}`}
        >
          {quickAccess.map((item) => (
            <QuickAccessCard
              key={item.title}
              item={item}
              role={loggedIn && role ? role : undefined}
              compact={quickAccess.length > 1}
            />
          ))}
        </div>
      </section>

      {postInstall ? (
        <section
          data-testid="uygulama-post-install"
          className="rounded-2xl border border-paper-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-paper-950">Kurulumdan sonra — {roleDisplayName(role!)}</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-paper-800/90">
            {postInstall.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
        <h2 className="text-lg font-semibold text-brand-950">Telefonda en iyi kullanım</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-brand-900/90">
          {tips.map((tip) => (
            <li key={tip.body}>{tip.body}</li>
          ))}
        </ul>
      </section>

      <div className="rounded-xl border border-paper-200 bg-white p-5 text-sm">
        <div className="font-medium text-paper-900">Hazır mısınız?</div>
        <p className="mt-1 text-paper-800/75">
          Kurulum adımları aşağıda. Android&apos;de tek dokunuş; iPhone&apos;da Safari ile ana ekrana
          ekleme yeterli.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={loggedIn && role ? panelHref : "/"}
            className="inline-flex rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900"
          >
            {loggedIn && role ? panelLabel : "Ana sayfa"}
          </Link>
          <a
            href="#android"
            className="inline-flex rounded-xl border border-paper-300 bg-white px-4 py-2 text-sm font-semibold text-paper-900 hover:bg-paper-50"
          >
            Kurulum adımları
          </a>
        </div>
      </div>
    </div>
  );
}
