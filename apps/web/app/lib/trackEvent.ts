import { apiFetch } from "./api";
import { getToken } from "./auth";

export type FunnelEventName =
  | "teacher_search"
  | "teacher_profile_view"
  | "teacher_shortlist"
  | "demo_request_start"
  | "teacher_profile_share"
  | "teacher_profile_intro_copy"
  | "teacher_profile_share_asset_copy"
  | "lesson_request_created"
  | "registration_completed"
  | "payment_checkout_start"
  | "campaign_application_created"
  | "homework_post_created"
  | "student_subscription_purchase_start";

export function trackEvent(
  eventName: FunnelEventName,
  opts: {
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  } = {},
) {
  if (typeof window === "undefined") return;
  const token = getToken();
  void apiFetch("/v1/analytics/events", {
    method: "POST",
    token: token ?? undefined,
    body: JSON.stringify({
      eventName,
      entityType: opts.entityType,
      entityId: opts.entityId,
      metadata: {
        path: window.location.pathname,
        search: window.location.search,
        ...(opts.metadata ?? {}),
      },
    }),
  }).catch(() => {
    /* Analytics must never block the product flow. */
  });
}
