// Appearance: 'system' follows the device, 'light' or 'dark' overrides it.
// index.html runs the same logic inline before React mounts, so the page never flashes the wrong theme.
import { useCallback, useState } from 'react';

const KEY = 'mh-theme';
const BAR = { light: '#ffffff', dark: '#000000' };
const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export function readTheme() {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(choice) {
  const root = document.documentElement;
  if (choice === 'light' || choice === 'dark') root.setAttribute('data-theme', choice);
  else root.removeAttribute('data-theme');
  const resolved = choice === 'system' ? (systemDark() ? 'dark' : 'light') : choice;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[resolved]);
}

export function useTheme() {
  const [theme, setThemeState] = useState(readTheme);
  const setTheme = useCallback((choice) => {
    try {
      if (choice === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, choice);
    } catch {
      // Storage can be blocked; the choice still applies for this visit.
    }
    applyTheme(choice);
    setThemeState(choice);
  }, []);
  return [theme, setTheme];
}

// Keeps the status bar color in step when the device switches between light and dark.
export function watchSystemTheme() {
  const query = window.matchMedia?.('(prefers-color-scheme: dark)');
  query?.addEventListener?.('change', () => applyTheme(readTheme()));
}
