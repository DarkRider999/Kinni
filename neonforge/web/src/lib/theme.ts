export type Theme = "dark" | "light" | "system";

const KEY = "nf.theme";

export function applyTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore */
  }
  const resolved =
    theme === "system" ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : theme;
  document.documentElement.dataset.theme = resolved;
}

export function initTheme(): void {
  let saved: Theme = "dark";
  try {
    saved = (localStorage.getItem(KEY) as Theme | null) ?? "dark";
  } catch {
    /* ignore */
  }
  applyTheme(saved);
}
