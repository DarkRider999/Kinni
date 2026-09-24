import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
const THEME_KEY = 'expertprompter.theme';

/** Dark/light mode: toggles the "dark" class on <html> and remembers the choice. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    // The inline script in _document already applied the class; read it back.
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.classList.toggle('dark', next === 'dark');
      try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return { theme, toggle };
}

/** Runs before paint to avoid a flash of the wrong theme. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;
