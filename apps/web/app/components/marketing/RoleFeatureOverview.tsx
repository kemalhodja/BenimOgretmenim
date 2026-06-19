import Link from "next/link";
import { REGISTER_ROLE_CARDS, ROLE_FEATURE_CARDS, type RoleFeatureCard } from "../../lib/roleFeatures";

type Props = {
  /** Kayıt dışı admin kartını da göster */
  includeAdmin?: boolean;
  /** Kart başına maksimum yükseklik (kaydırılabilir liste) */
  maxListHeightClass?: string;
  showSubscription?: boolean;
};

function RoleFeatureCardBlock({
  card,
  maxListHeightClass,
  showSubscription,
}: {
  card: RoleFeatureCard;
  maxListHeightClass?: string;
  showSubscription: boolean;
}) {
  return (
    <article className="flex flex-col rounded-2xl border border-paper-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-brand-800/70">{card.role}</div>
      <h3 className="mt-2 text-base font-semibold text-paper-950">{card.title}</h3>
      <p className="mt-1 text-xs font-medium text-paper-800/60">{card.eyebrow}</p>
      <p className="mt-2 text-sm leading-relaxed text-paper-800/75">{card.summary}</p>
      <div
        className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-paper-800/55"
        data-testid="role-feature-count"
      >
        Tüm özellikler ({card.features.length})
      </div>
      <ul className={`mt-2 space-y-1.5 overflow-y-auto pr-1 ${maxListHeightClass ?? "max-h-72"}`}>
        {card.features.map((item) => (
          <li key={item} className="flex gap-2 text-xs leading-relaxed text-paper-800/75">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-700/75" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      {showSubscription && card.subscriptionWins.length > 0 ? (
        <div className="mt-3 rounded-lg border border-brand-100 bg-brand-50 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-brand-900/60">
            Abonelik / ek kazanımlar
          </div>
          <ul className="mt-1 space-y-1">
            {card.subscriptionWins.map((win) => (
              <li key={win} className="text-[11px] leading-relaxed text-brand-950/85">
                {win}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Link
        href={card.href}
        className="mt-4 inline-flex text-sm font-semibold text-brand-800 underline-offset-4 hover:underline"
      >
        {card.cta} →
      </Link>
    </article>
  );
}

export function RoleFeatureOverview({
  includeAdmin = false,
  maxListHeightClass,
  showSubscription = true,
}: Props) {
  const cards = includeAdmin ? ROLE_FEATURE_CARDS : REGISTER_ROLE_CARDS;
  return (
    <div className={`grid gap-4 ${includeAdmin ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-2 lg:grid-cols-3"}`}>
      {cards.map((card) => (
        <RoleFeatureCardBlock
          key={card.role}
          card={card}
          maxListHeightClass={maxListHeightClass}
          showSubscription={showSubscription}
        />
      ))}
    </div>
  );
}

export function subscriptionWinsForRole(role: "student" | "teacher" | "guardian"): readonly string[] {
  const card = REGISTER_ROLE_CARDS.find((c) => c.registerRole === role);
  return card?.subscriptionWins ?? [];
}
