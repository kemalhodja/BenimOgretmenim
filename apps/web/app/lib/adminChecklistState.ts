const STORAGE_KEY = "bo:admin-checklist:v1";

type ChecklistState = {
  date: string;
  checkedIds: string[];
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function readState(): ChecklistState {
  if (typeof window === "undefined") return { date: todayKey(), checkedIds: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { date: todayKey(), checkedIds: [] };
    const parsed = JSON.parse(raw) as ChecklistState;
    if (parsed.date !== todayKey()) return { date: todayKey(), checkedIds: [] };
    return { date: parsed.date, checkedIds: Array.isArray(parsed.checkedIds) ? parsed.checkedIds : [] };
  } catch {
    return { date: todayKey(), checkedIds: [] };
  }
}

function writeState(state: ChecklistState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function isChecklistItemDone(id: string): boolean {
  return readState().checkedIds.includes(id);
}

export function toggleChecklistItem(id: string): boolean {
  const state = readState();
  const next = state.checkedIds.includes(id)
    ? state.checkedIds.filter((x) => x !== id)
    : [...state.checkedIds, id];
  writeState({ date: todayKey(), checkedIds: next });
  return next.includes(id);
}

export function checklistProgress(total: number): { done: number; total: number } {
  const state = readState();
  return { done: state.checkedIds.length, total };
}
