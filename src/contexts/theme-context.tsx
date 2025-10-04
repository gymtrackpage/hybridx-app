'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'auto';
type ColorTheme = 'yellow' | 'pink';

interface ThemeContextType {
  theme: Theme;
  colorTheme: ColorTheme;
  setTheme: (theme: Theme) => void;
  setColorTheme: (colorTheme: ColorTheme) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('auto');
  const [colorTheme, setColorThemeState] = useState<ColorTheme>('yellow');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  // Load saved preferences
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    const savedColorTheme = localStorage.getItem('color-theme') as ColorTheme;

    if (savedTheme) setThemeState(savedTheme);
    if (savedColorTheme) setColorThemeState(savedColorTheme);
  }, []);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;

    // Remove existing theme classes
    root.classList.remove('light', 'dark', 'theme-pink');

    // Determine resolved theme
    let resolved: 'light' | 'dark' = 'light';

    if (theme === 'auto') {
      // Use system preference
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      resolved = mediaQuery.matches ? 'dark' : 'light';

      // Listen for system theme changes
      const handleChange = (e: MediaQueryListEvent) => {
        const newResolved = e.matches ? 'dark' : 'light';
        setResolvedTheme(newResolved);
        root.classList.remove('light', 'dark');
        root.classList.add(newResolved);

        // Re-apply color theme after mode change
        if (colorTheme === 'pink') {
          root.classList.add('theme-pink');
        }
      };

      mediaQuery.addEventListener('change', handleChange);

      // Apply initial auto theme
      setResolvedTheme(resolved);
      root.classList.add(resolved);
      if (colorTheme === 'pink') {
        root.classList.add('theme-pink');
      }

      // Cleanup
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      resolved = theme;
      setResolvedTheme(resolved);
      root.classList.add(resolved);
      if (colorTheme === 'pink') {
        root.classList.add('theme-pink');
      }
    }
  }, [theme, colorTheme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const setColorTheme = (newColorTheme: ColorTheme) => {
    setColorThemeState(newColorTheme);
    localStorage.setItem('color-theme', newColorTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, colorTheme, setTheme, setColorTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
