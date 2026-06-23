"use client";

import Link from "next/link";
import {
  ADMIN_TRACKING_FOOTER_LINKS,
  ADMIN_TRACKING_SECTIONS,
  actionMetrics,
  metricValue,
  type AdminOverviewCounts,
  type AdminScope,
} from "../../lib/adminRegistry";

function StatCard({
  href,
  label,
  value,
  hint,
  urgent,
}: {
  href: string;
  label: string;
  value: string | number;
  hint?: string;
  urgent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-xl border p-4 transition hover:-translate-y-0.5 ${
        urgent
          ? "border-amber-300 bg-amber-50/80 hover:border-amber-400 hover:bg-amber-50"
          : "border-paper-200 bg-white hover:border-brand-200 hover:bg-paper-50/60"
      }`}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${urgent ? "text-amber-950" : "text-paper-900"}`}>
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-paper-800/55">{hint}</div> : null}
    </Link>
  );
}

export function AdminTrackingBoard({
  counts,
  roles,
  generatedAt,
  adminScope = "full",
}: {
  counts: AdminOverviewCounts;
  roles: Record<string, number>;
  generatedAt: string;
  adminScope?: AdminScope;
}) {
  const urgent = actionMetrics(counts, adminScope);

  return (
    <>
      {urgent.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-amber-950">Bugün önce bakılacaklar ({urgent.length})</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {urgent.map((m) => {
              const raw = metricValue(counts, m.key);
              const value = m.format ? m.format(raw, counts) : raw;
              return (
                <StatCard
                  key={m.key}
                  href={m.href}
                  label={m.label}
                  value={value}
                  hint={m.hint?.(counts)}
                  urgent
                />
              );
            })}
          </div>
        </section>
      ) : (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Kritik kuyruk boş görünüyor. Aşağıdaki envanter ve kontrol merkezinden rutin takibe devam edin.
        </div>
      )}

      {ADMIN_TRACKING_SECTIONS.slice(1).map((section) => (
        <section key={section.title} className="mt-8">
          <h2 className="text-sm font-semibold text-paper-900">{section.title}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {section.metrics.map((m) => {
              const raw = metricValue(counts, m.key);
              const value = m.format ? m.format(raw, counts) : raw;
              return (
                <StatCard
                  key={m.key}
                  href={m.href}
                  label={m.label}
                  value={value}
                  hint={m.hint?.(counts)}
                />
              );
            })}
          </div>
        </section>
      ))}

      <section className="mt-8 rounded-xl border border-paper-200 bg-white p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-paper-800/55">Rol dağılımı</div>
        <ul className="mt-2 grid gap-1 text-sm text-paper-800 sm:grid-cols-2">
          {Object.entries(roles).map(([role, n]) => (
            <li key={role} className="flex justify-between gap-2 rounded-md bg-paper-50 px-2 py-1">
              <span className="capitalize">{role}</span>
              <span className="font-mono tabular-nums text-paper-900">{n}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-4 text-xs text-paper-800/55">Veri anı: {new Date(generatedAt).toLocaleString("tr-TR")}</p>

      <section className="mt-8 border-t border-paper-200 pt-6">
        <h2 className="text-sm font-semibold text-paper-900">Tüm modüller</h2>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm leading-relaxed">
          {ADMIN_TRACKING_FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-paper-800/75 underline decoration-paper-300 underline-offset-4 hover:text-paper-900"
            >
              {link.label}
            </Link>
          ))}
        </p>
      </section>
    </>
  );
}
