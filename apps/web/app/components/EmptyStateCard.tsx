import Link from "next/link";

type EmptyStateCardProps = {
  title: string;
  body: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  testId?: string;
  onPrimaryClick?: () => void;
};

export function EmptyStateCard({
  title,
  body,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  testId = "empty-state-card",
  onPrimaryClick,
}: EmptyStateCardProps) {
  return (
    <div
      className="rounded-2xl border border-dashed border-paper-300 bg-paper-50/80 p-6 text-center"
      data-testid={testId}
    >
      <h3 className="text-base font-semibold text-paper-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-paper-800/70">{body}</p>
      <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
        {onPrimaryClick ? (
          <button
            type="button"
            onClick={onPrimaryClick}
            className="inline-flex rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-900"
          >
            {primaryLabel}
          </button>
        ) : (
          <Link
            href={primaryHref}
            className="inline-flex rounded-xl bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-900"
          >
            {primaryLabel}
          </Link>
        )}
        {secondaryHref && secondaryLabel ? (
          <Link
            href={secondaryHref}
            className="inline-flex rounded-xl border border-paper-300 bg-white px-5 py-2.5 text-sm font-medium text-paper-900 hover:bg-paper-50"
          >
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
