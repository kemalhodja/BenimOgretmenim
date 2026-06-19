import Link from "next/link";
import {
  FEATURE_COUNT_LABEL,
  REGISTER_ROLE_CARDS,
  ROLE_FEATURE_CARDS,
  SUBSCRIPTION_WINS_LABEL,
  type RoleFeatureCard,
} from "../../lib/roleFeatures";

export { subscriptionWinsForRole } from "../../lib/roleFeatures";

type ListProps = {
  features: readonly string[];
  subscriptionWins?: readonly string[];
  subscriptionLabel?: string;
  maxListHeightClass?: string;
  size?: "xs" | "sm";
  variant?: "default" | "brand" | "edu";
  showCount?: boolean;
};

const listVariantStyles = {
  default: {
    bullet: "bg-brand-700/75",
    subscriptionBox: "border-brand-100 bg-brand-50",
    subscriptionTitle: "text-brand-900/60",
    subscriptionItem: "text-brand-950/85",
  },
  brand: {
    bullet: "bg-brand-700",
    subscriptionBox: "border-brand-200 bg-brand-50",
    subscriptionTitle: "text-brand-900/65",
    subscriptionItem: "text-brand-950",
  },
  edu: {
    bullet: "bg-edu-success-500",
    subscriptionBox: "border-edu-blue-100 bg-edu-blue-50/60",
    subscriptionTitle: "text-edu-indigo-700/70",
    subscriptionItem: "text-paper-800/70",
  },
} as const;

export function RoleFeatureList({
  features,
  subscriptionWins = [],
  subscriptionLabel = SUBSCRIPTION_WINS_LABEL,
  maxListHeightClass = "max-h-72",
  size = "xs",
  variant = "default",
  showCount = true,
}: ListProps) {
  const styles = listVariantStyles[variant];
  const textSize = size === "sm" ? "text-sm" : "text-xs";
  const subSize = size === "sm" ? "text-xs" : "text-[11px]";

  return (
    <>
      {showCount ? (
        <div
          className="text-[11px] font-semibold uppercase tracking-wide text-paper-800/55"
          data-testid="role-feature-count"
        >
          {FEATURE_COUNT_LABEL} ({features.length})
        </div>
      ) : null}
      <ul className={`mt-2 space-y-1.5 overflow-y-auto pr-1 ${maxListHeightClass} ${textSize} leading-relaxed text-paper-800/75`}>
        {features.map((item) => (
          <li key={item} className="flex gap-2">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${styles.bullet}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      {subscriptionWins.length > 0 ? (
        <div className={`mt-3 rounded-lg border px-3 py-2 ${styles.subscriptionBox}`}>
          <div className={`text-[10px] font-semibold uppercase tracking-wide ${styles.subscriptionTitle}`}>
            {subscriptionLabel}
          </div>
          <ul className="mt-1 space-y-1">
            {subscriptionWins.map((win) => (
              <li key={win} className={`${subSize} leading-relaxed ${styles.subscriptionItem}`}>
                {win}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

type Props = {
  /** Kayıt dışı admin kartını da göster */
  includeAdmin?: boolean;
  /** Kart başına maksimum yükseklik (kaydırılabilir liste) */
  maxListHeightClass?: string;
  showSubscription?: boolean;
  /** Ana sayfa eğitim teması */
  variant?: "default" | "edu";
  /** Kartın tamamını CTA linkine sar (ana sayfa) */
  cardAsLink?: boolean;
  className?: string;
};

function RoleFeatureCardBlock({
  card,
  maxListHeightClass,
  showSubscription,
  variant,
  cardAsLink,
}: {
  card: RoleFeatureCard;
  maxListHeightClass?: string;
  showSubscription: boolean;
  variant: "default" | "edu";
  cardAsLink: boolean;
}) {
  const isEdu = variant === "edu";
  const articleClass = isEdu
    ? "group flex flex-col rounded-2xl border border-edu-blue-100 bg-white/90 p-5 transition hover:-translate-y-0.5 hover:border-edu-indigo-200 hover:bg-white hover:shadow-[0_18px_50px_rgba(79,70,229,0.13)]"
    : "flex flex-col rounded-2xl border border-paper-200 bg-white p-5 shadow-sm";

  const body = (
    <>
      <div className={`text-xs font-semibold uppercase tracking-wide ${isEdu ? "text-edu-indigo-700/70" : "text-brand-800/70"}`}>
        {card.role}
      </div>
      <h3 className="mt-2 text-base font-semibold text-paper-950">{card.title}</h3>
      <p className={`mt-1 text-xs font-medium ${isEdu ? "text-paper-800/65" : "text-paper-800/60"}`}>{card.eyebrow}</p>
      <p className="mt-2 text-sm leading-relaxed text-paper-800/75">{card.summary}</p>
      <RoleFeatureList
        features={card.features}
        subscriptionWins={showSubscription ? card.subscriptionWins : []}
        maxListHeightClass={maxListHeightClass}
        variant={isEdu ? "edu" : "default"}
      />
      {cardAsLink ? (
        <span className={`mt-4 inline-flex text-sm font-semibold transition ${isEdu ? "text-edu-indigo-700 group-hover:translate-x-1" : "text-brand-800"}`}>
          {card.cta} →
        </span>
      ) : (
        <Link
          href={card.href}
          className={`mt-4 inline-flex text-sm font-semibold underline-offset-4 hover:underline ${isEdu ? "text-edu-indigo-700" : "text-brand-800"}`}
        >
          {card.cta} →
        </Link>
      )}
    </>
  );

  if (cardAsLink) {
    return (
      <Link href={card.href} className={articleClass}>
        {body}
      </Link>
    );
  }

  return <article className={articleClass}>{body}</article>;
}

export function RoleFeatureOverview({
  includeAdmin = false,
  maxListHeightClass,
  showSubscription = true,
  variant = "default",
  cardAsLink = false,
  className,
}: Props) {
  const cards = includeAdmin ? ROLE_FEATURE_CARDS : REGISTER_ROLE_CARDS;
  const gridClass = includeAdmin ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-2 lg:grid-cols-3";

  return (
    <div className={`grid gap-4 ${gridClass}${className ? ` ${className}` : ""}`}>
      {cards.map((card) => (
        <RoleFeatureCardBlock
          key={card.role}
          card={card}
          maxListHeightClass={maxListHeightClass}
          showSubscription={showSubscription}
          variant={variant}
          cardAsLink={cardAsLink}
        />
      ))}
    </div>
  );
}
