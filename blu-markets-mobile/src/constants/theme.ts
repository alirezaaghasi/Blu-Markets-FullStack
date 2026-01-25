// Blu Markets Design System
// Based on PRD Section 10 - Design System

export const colors = {
  // Primary - ALIGNED WITH colors.ts
  primary: '#6FAAF8',
  primaryLight: '#8FBFFF',
  primaryDark: '#5B9AE8',  // Darker variant for pressed states

  // Background - ALIGNED WITH colors.ts
  bgLight: '#f6f6f8',
  bgDark: '#0E1420',       // Aligned with COLORS.background.primary

  // Surface - ALIGNED WITH colors.ts
  surfaceDark: '#151C28',  // Aligned with COLORS.background.surface
  cardDark: '#1C2433',     // Aligned with COLORS.background.elevated
  borderDark: '#1C2433',

  // Text - ALIGNED WITH colors.ts
  textPrimaryLight: '#0f172a',
  textPrimaryDark: '#FFFFFF',
  textSecondary: '#9CA3AF', // Aligned with COLORS.text.secondary
  textMuted: '#6B7280',

  // Semantic
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',

  // Layer Identity
  layerFoundation: '#3b82f6',  // Blue
  layerGrowth: '#a855f7',       // Purple
  layerUpside: '#10b981',       // Emerald

  // Boundary Indicators
  boundarySafe: '#22c55e',      // Green
  boundaryDrift: '#f59e0b',     // Yellow/Amber
  boundaryStructural: '#f97316', // Orange
  boundaryStress: '#ef4444',    // Red
} as const;

export const typography = {
  fontFamily: {
    display: 'System', // Will use Manrope when loaded
  },
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '4xl': 36,
    '5xl': 48,
  },
  fontWeight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
} as const;

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
} as const;

export const borderRadius = {
  sm: 8,
  default: 16,
  lg: 24,
  xl: 32,
  full: 9999,
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
} as const;

// Component-specific tokens
export const components = {
  button: {
    height: 56,
    radius: borderRadius.full,
  },
  card: {
    radius: borderRadius.default,
    padding: spacing[5],
  },
  bottomSheet: {
    radius: borderRadius.xl,
  },
  input: {
    height: 48,
    radius: borderRadius.default,
  },
  badge: {
    height: 32,
    radius: borderRadius.full,
    paddingHorizontal: spacing[4],
  },
  tabBar: {
    height: 64,
  },
} as const;

export default {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  components,
};
