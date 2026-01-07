/**
 * Life Organizer - Theme Context
 *
 * Provides app-wide theme state management with AsyncStorage persistence.
 * Wrap your app with ThemeProvider and use useTheme() hook in components.
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors, getThemeColors } from './theme';

const THEME_STORAGE_KEY = '@life_organizer_theme';

// Theme options: 'light', 'dark', 'system'
const ThemeContext = createContext({
  theme: 'light',
  themeMode: 'system', // 'light', 'dark', or 'system'
  colors: lightColors,
  isDark: false,
  setThemeMode: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState('system'); // 'light', 'dark', 'system'
  const [isLoading, setIsLoading] = useState(true);

  // Load saved theme preference on mount
  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
        setThemeModeState(savedTheme);
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Resolve the actual theme based on mode and system preference
  // IMPORTANT: This must be defined BEFORE toggleTheme to avoid TDZ error
  const resolvedTheme = useMemo(() => {
    if (themeMode === 'system') {
      return systemColorScheme || 'light';
    }
    return themeMode;
  }, [themeMode, systemColorScheme]);

  // Save theme preference when it changes - wrapped with useCallback
  const setThemeMode = useCallback(async (mode) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      setThemeModeState(mode);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  }, []);

  // Toggle between light and dark (skips system) - wrapped with useCallback
  const toggleTheme = useCallback(() => {
    const newMode = resolvedTheme === 'dark' ? 'light' : 'dark';
    setThemeMode(newMode);
  }, [resolvedTheme, setThemeMode]);

  // Get the color palette for the resolved theme
  const colors = useMemo(() => {
    return getThemeColors(resolvedTheme);
  }, [resolvedTheme]);

  const isDark = resolvedTheme === 'dark';

  const value = useMemo(() => ({
    theme: resolvedTheme,
    themeMode,
    colors,
    isDark,
    setThemeMode,
    toggleTheme,
    isLoading,
  }), [resolvedTheme, themeMode, colors, isDark, setThemeMode, toggleTheme, isLoading]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access theme context
 * @returns {object} Theme context value with colors, theme, and control functions
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/**
 * Hook to create theme-aware styles
 * @param {function} styleCreator - Function that receives colors and returns StyleSheet
 * @returns {object} StyleSheet object
 */
export function useThemedStyles(styleCreator) {
  const { colors, isDark } = useTheme();
  return useMemo(() => styleCreator(colors, isDark), [colors, isDark, styleCreator]);
}

export default ThemeContext;
