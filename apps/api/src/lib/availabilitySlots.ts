const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type SlotOffer = {
  start: string;
  end: string;
  label: string;
};

function parseTimeRange(range: string): { startMin: number; endMin: number } | null {
  const trimmed = range.trim();
  const m = trimmed.match(/^(\d{1,2}):(\d{2})(?:-(\d{1,2}):(\d{2}))?$/);
  if (!m) return null;
  const sh = Number(m[1]);
  const sm = Number(m[2]);
  const eh = m[3] ? Number(m[3]) : sh + 1;
  const em = m[4] ? Number(m[4]) : sm;
  if (![sh, sm, eh, em].every((n) => Number.isFinite(n))) return null;
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (endMin <= startMin) return null;
  return { startMin, endMin };
}

function dayKeyForDate(date: Date): (typeof DAY_KEYS)[number] {
  return DAY_KEYS[date.getDay()];
}

function formatSlotLabel(start: Date, end: Date): string {
  const fmt = new Intl.DateTimeFormat("tr-TR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const endFmt = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" });
  return `${fmt.format(start)} – ${endFmt.format(end)}`;
}

export function generateSlotsFromAvailability(
  availability: unknown,
  options?: { daysAhead?: number; slotMinutes?: number; now?: Date },
): SlotOffer[] {
  if (!availability || typeof availability !== "object" || Array.isArray(availability)) {
    return [];
  }
  const record = availability as Record<string, unknown>;
  const daysAhead = options?.daysAhead ?? 14;
  const slotMinutes = options?.slotMinutes ?? 60;
  const now = options?.now ?? new Date();
  const slots: SlotOffer[] = [];

  for (let offset = 0; offset < daysAhead; offset++) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + offset);
    const key = dayKeyForDate(day);
    const ranges = record[key];
    if (!Array.isArray(ranges)) continue;

    for (const raw of ranges) {
      const parsed = parseTimeRange(String(raw));
      if (!parsed) continue;
      for (let min = parsed.startMin; min + slotMinutes <= parsed.endMin; min += slotMinutes) {
        const start = new Date(day);
        start.setHours(Math.floor(min / 60), min % 60, 0, 0);
        if (start.getTime() <= now.getTime() + 30 * 60 * 1000) continue;
        const end = new Date(start.getTime() + slotMinutes * 60 * 1000);
        slots.push({
          start: start.toISOString(),
          end: end.toISOString(),
          label: formatSlotLabel(start, end),
        });
      }
    }
  }

  return slots.slice(0, 48);
}
