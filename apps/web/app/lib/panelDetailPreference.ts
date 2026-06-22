export type PanelDetailMode = "simple" | "detailed";

const STORAGE_KEY = "bo:panel-detail";

export function getPanelDetailMode(): PanelDetailMode {
  if (typeof window === "undefined") return "simple";
  return window.localStorage.getItem(STORAGE_KEY) === "detailed" ? "detailed" : "simple";
}

export function setPanelDetailMode(mode: PanelDetailMode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, mode);
}
