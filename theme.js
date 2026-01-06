/**
 * Life Organizer - Centralized Theme System
 *
 * This file contains all color tokens for light and dark modes.
 * Import { getThemeColors } or { lightColors, darkColors } as needed.
 */

// Light Mode Colors
export const lightColors = {
  // Backgrounds
  background: '#faf9f6',
  surface: '#ffffff',
  surfaceElevated: '#f8f5f0',
  surfaceAlt: '#f3f0eb',

  // Text
  text: '#1f2933',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  textInverse: '#ffffff',

  // Accent (Warm Amber)
  accent: '#b45309',
  accentLight: '#fef3c7',
  accentMuted: '#fed7aa',
  accentDark: '#92400e',

  // Borders
  border: '#e5e7eb',
  borderStrong: '#d1d5db',
  borderWarm: '#d4c5b0',

  // Inputs
  inputBg: '#ffffff',
  inputBorder: '#e5e7eb',
  inputFocus: '#b45309',
  placeholder: '#a3a3a3',

  // Semantic Colors
  success: '#10b981',
  successLight: '#d1fae5',
  error: '#ef4444',
  errorLight: '#fee2e2',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  info: '#3b82f6',
  infoLight: '#dbeafe',

  // Category Colors
  categoryRestaurants: '#ef4444',
  categoryIdeas: '#8b5cf6',
  categoryGroceries: '#10b981',
  categoryTodo: '#2563eb',
  categoryActivities: '#f59e0b',

  // Priority Colors
  priorityLow: '#10b981',
  priorityMedium: '#f59e0b',
  priorityHigh: '#ef4444',
  priorityUrgent: '#7f1d1d',

  // Shadows & Overlays
  shadow: 'rgba(15, 23, 42, 0.08)',
  shadowMedium: 'rgba(15, 23, 42, 0.12)',
  shadowStrong: 'rgba(15, 23, 42, 0.18)',
  overlay: 'rgba(0, 0, 0, 0.5)',

  // Special
  divider: '#e5e7eb',
  skeleton: '#e5e7eb',
  badge: '#fef3c7',
  badgeText: '#92400e',

  // Tab Bar
  tabBarBg: '#ffffff',
  tabBarBorder: '#e5e7eb',
  tabActive: '#b45309',
  tabInactive: '#6b7280',

  // Cards
  cardBg: '#ffffff',
  cardBorder: '#e5e7eb',
  cardShadow: 'rgba(15, 23, 42, 0.08)',

  // Decorative (for auth screens)
  decorativeCircle1: '#fef3c7',
  decorativeCircle2: '#fed7aa',

  // Logo
  logoBg: '#1f2933',
  logoText: '#ffffff',

  // Status Bar
  statusBarStyle: 'dark-content',
};

// Dark Mode Colors
export const darkColors = {
  // Backgrounds
  background: '#121212',
  surface: '#1e1e1e',
  surfaceElevated: '#2a2a2a',
  surfaceAlt: '#333333',

  // Text
  text: '#f5f5f5',
  textSecondary: '#a3a3a3',
  textMuted: '#737373',
  textInverse: '#1f2933',

  // Accent (Warm Amber - brightened for dark mode)
  accent: '#d97706',
  accentLight: '#422006',
  accentMuted: '#78350f',
  accentDark: '#f59e0b',

  // Borders
  border: '#2e2e2e',
  borderStrong: '#404040',
  borderWarm: '#4a3728',

  // Inputs
  inputBg: '#1e1e1e',
  inputBorder: '#3d3d3d',
  inputFocus: '#d97706',
  placeholder: '#666666',

  // Semantic Colors (adjusted for dark backgrounds)
  success: '#22c55e',
  successLight: '#14532d',
  error: '#f87171',
  errorLight: '#7f1d1d',
  warning: '#fbbf24',
  warningLight: '#78350f',
  info: '#60a5fa',
  infoLight: '#1e3a5f',

  // Category Colors (brightened for dark mode)
  categoryRestaurants: '#f87171',
  categoryIdeas: '#a78bfa',
  categoryGroceries: '#34d399',
  categoryTodo: '#60a5fa',
  categoryActivities: '#fbbf24',

  // Priority Colors (adjusted for dark mode)
  priorityLow: '#22c55e',
  priorityMedium: '#fbbf24',
  priorityHigh: '#f87171',
  priorityUrgent: '#fca5a5',

  // Shadows & Overlays
  shadow: 'rgba(0, 0, 0, 0.3)',
  shadowMedium: 'rgba(0, 0, 0, 0.4)',
  shadowStrong: 'rgba(0, 0, 0, 0.5)',
  overlay: 'rgba(0, 0, 0, 0.7)',

  // Special
  divider: '#2e2e2e',
  skeleton: '#2a2a2a',
  badge: '#422006',
  badgeText: '#fbbf24',

  // Tab Bar
  tabBarBg: '#1e1e1e',
  tabBarBorder: '#2e2e2e',
  tabActive: '#d97706',
  tabInactive: '#737373',

  // Cards
  cardBg: '#1e1e1e',
  cardBorder: '#2e2e2e',
  cardShadow: 'rgba(0, 0, 0, 0.3)',

  // Decorative (for auth screens - muted for dark mode)
  decorativeCircle1: '#422006',
  decorativeCircle2: '#78350f',

  // Logo
  logoBg: '#d97706',
  logoText: '#ffffff',

  // Status Bar
  statusBarStyle: 'light-content',
};

/**
 * Get theme colors based on theme mode
 * @param {'light' | 'dark'} theme - The current theme mode
 * @returns {object} - The color tokens for the specified theme
 */
export const getThemeColors = (theme) => {
  return theme === 'dark' ? darkColors : lightColors;
};

/**
 * Get category color based on category name and theme
 * @param {string} category - The category name
 * @param {'light' | 'dark'} theme - The current theme mode
 * @returns {string} - The hex color for the category
 */
export const getCategoryColor = (category, theme = 'light') => {
  const colors = getThemeColors(theme);
  const categoryMap = {
    restaurants: colors.categoryRestaurants,
    ideas: colors.categoryIdeas,
    groceries: colors.categoryGroceries,
    todo: colors.categoryTodo,
    activities: colors.categoryActivities,
  };
  return categoryMap[category] || colors.categoryIdeas;
};

/**
 * Get priority color based on priority level and theme
 * @param {string} priority - The priority level
 * @param {'light' | 'dark'} theme - The current theme mode
 * @returns {string} - The hex color for the priority
 */
export const getPriorityColor = (priority, theme = 'light') => {
  const colors = getThemeColors(theme);
  const priorityMap = {
    low: colors.priorityLow,
    medium: colors.priorityMedium,
    high: colors.priorityHigh,
    urgent: colors.priorityUrgent,
  };
  return priorityMap[priority] || colors.priorityMedium;
};

export default {
  lightColors,
  darkColors,
  getThemeColors,
  getCategoryColor,
  getPriorityColor,
};
