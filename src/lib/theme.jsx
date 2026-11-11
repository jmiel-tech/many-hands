import { createContext, useContext, useEffect, useMemo, useState } from 'react';

// The choice is per device. With no choice saved, the app follows the system setting.
// index.html runs the same logic before first paint, so there's no white flash in dark mode.
const KEY = 'many-hands-theme';
const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches;

function saved() {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}

function apply(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#121214' : '#1F5E4E');
}

const ThemeContext = createContext(null);
export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => saved() || (systemDark() ? 'dark' : 'light'));

  useEffect(() => apply(theme), [theme]);

  // Follow system changes until the user picks a theme themselves.
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return undefined;
    const onChange = () => {
      if (!saved()) setTheme(media.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const value = useMemo(() => ({
    theme,
    dark: theme === 'dark',
    toggle() {
      const next = theme === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(KEY, next);
      } catch {
        // Private mode: the choice just won't be remembered.
      }
      setTheme(next);
    },
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
