import { describe, expect, it, vi } from "vitest";
import {
  defaultActionLabelForKind,
  defaultPriorityForKind,
  defaultHrefForKind,
  enrichParentNotificationPayload,
  notificationCategoryForKind,
  notifyUserInAppSmart,
} from "./inAppNotifications.js";

describe("inAppNotifications", () => {
  it("enriches parent payload with href and priority", () => {
    const enriched = enrichParentNotificationPayload({
      kind: "lesson_offer_received",
      requestId: "req-1",
      offerId: "off-1",
    });
    expect(enriched.href).toBe("/student/requests/req-1");
    expect(enriched.priority).toBe("high");
    expect(defaultHrefForKind("homework_new_post", {})).toBe("/teacher/odev-havuzu");
  });

  it("maps kind to priority and category", () => {
    expect(defaultPriorityForKind("lesson_reminder_2h")).toBe("urgent");
    expect(defaultPriorityForKind("lesson_offer_received")).toBe("high");
    expect(notificationCategoryForKind("homework_answered")).toBe("homework");
    expect(defaultActionLabelForKind("lesson_video_published")).toBe("Videoyu aç");
  });

  it("skips duplicate dedupeKey notifications", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ exists: true }] });
    const db = { query };
    const sent = await notifyUserInAppSmart(
      "user-1",
      "T",
      "B",
      { kind: "test", dedupeKey: "abc" },
      { kind: "test", dedupeKey: "abc" },
      db as import("pg").Pool,
    );
    expect(sent).toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("sends when dedupe allows", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ exists: false }] })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const db = { query };
    const sent = await notifyUserInAppSmart(
      "user-1",
      "T",
      "B",
      { kind: "lesson_video_published", dedupeKey: "v1" },
      { kind: "lesson_video_published", dedupeKey: "v1" },
      db as import("pg").Pool,
    );
    expect(sent).toBe(true);
    expect(query).toHaveBeenCalledTimes(2);
  });
});
