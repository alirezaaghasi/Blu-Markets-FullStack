/**
 * Blu Markets Design System - Colors
 * Based on design-tokens.ts from handoff
 */

export const COLORS = {
  // Backgrounds
  background: {
    primary: '#0E1420', // Main app background
    surface: '#151C28', // Cards, bottom sheets
    elevated: '#1C2433', // Modals, elevated surfaces
    input: '#1C2433', // Input field backgrounds
  },

  // Text
  text: {
    primary: '#FFFFFF',
    secondary: '#9CA3AF', // Gray-400
    muted: '#6B7280', // Gray-500
    disabled: '#4B5563', // Gray-600
    inverse: '#0E1420', // For light backgrounds
  },

  // Brand
  brand: {
    primary: '#6FAAF8', // Primary blue (buttons, links, active states)
    primaryHover: '#5B9AE8',
    primaryPressed: '#4A89D7',
    primaryMuted: 'rgba(111, 170, 248, 0.15)', // For backgrounds
  },

  // Layers (Portfolio Allocation)
  layers: {
    foundation: '#3B82F6', // Blue - Stable assets
    growth: '#A855F7', // Purple - Moderate risk
    upside: '#10B981', // Green/Emerald - High risk
  },

  // Layer backgrounds (15% opacity versions)
  layersBg: {
    foundation: 'rgba(59, 130, 246, 0.15)',
    growth: 'rgba(168, 85, 247, 0.15)',
    upside: 'rgba(16, 185, 129, 0.15)',
  },

  // Semantic
  semantic: {
    success: '#22C55E', // Green - Positive actions, gains
    warning: '#F59E0B', // Amber - Warnings, drift
    error: '#EF4444', // Red - Errors, stress
    info: '#3B82F6', // Blue - Information
  },

  // Semantic backgrounds (15% opacity versions)
  semanticBg: {
    success: 'rgba(34, 197, 94, 0.15)',
    warning: 'rgba(245, 158, 11, 0.15)',
    error: 'rgba(239, 68, 68, 0.15)',
    info: 'rgba(59, 130, 246, 0.15)',
  },

  // Boundary Indicators (Activity Feed)
  boundary: {
    safe: '#22C55E', // Green dot/badge
    drift: '#F59E0B', // Amber dot/badge
    structural: '#F97316', // Orange dot/badge
    stress: '#EF4444', // Red dot/badge
  },

  // Utility
  border: '#1C2433',
  divider: '#1C2433',
  overlay: 'rgba(0, 0, 0, 0.5)',
  shimmer: '#2A3441', // For skeleton loading
} as const;

// Boundary badge background colors (15% opacity)
export const BOUNDARY_BG = {
  safe: 'rgba(34, 197, 94, 0.15)',
  drift: 'rgba(245, 158, 11, 0.15)',
  structural: 'rgba(249, 115, 22, 0.15)',
  stress: 'rgba(239, 68, 68, 0.15)',
} as const;

// Boundary configuration for easy lookup
export const BOUNDARY_CONFIG = {
  SAFE: {
    color: COLORS.boundary.safe,
    bg: BOUNDARY_BG.safe,
    label: 'SAFE',
  },
  DRIFT: {
    color: COLORS.boundary.drift,
    bg: BOUNDARY_BG.drift,
    label: 'DRIFT',
  },
  STRUCTURAL: {
    color: COLORS.boundary.structural,
    bg: BOUNDARY_BG.structural,
    label: 'DRIFT', // Show as DRIFT to user per handoff
  },
  STRESS: {
    color: COLORS.boundary.stress,
    bg: BOUNDARY_BG.stress,
    label: 'RISK',
  },
} as const;

// Layer configuration for easy lookup
export const LAYER_CONFIG = {
  FOUNDATION: {
    color: COLORS.layers.foundation,
    bg: COLORS.layersBg.foundation,
    label: 'Foundation',
    labelFa: 'پایه',
  },
  GROWTH: {
    color: COLORS.layers.growth,
    bg: COLORS.layersBg.growth,
    label: 'Growth',
    labelFa: 'رشد',
  },
  UPSIDE: {
    color: COLORS.layers.upside,
    bg: COLORS.layersBg.upside,
    label: 'Upside',
    labelFa: 'پتانسیل',
  },
} as const;

// Button styles
export const BUTTON_COLORS = {
  primary: {
    background: '#6FAAF8',
    text: '#FFFFFF',
    pressed: '#5B9AE8',
  },
  secondary: {
    background: '#1C2433',
    text: '#FFFFFF',
    pressed: '#252D3D',
  },
  outline: {
    background: 'transparent',
    text: '#6FAAF8',
    border: '#6FAAF8',
    pressed: 'rgba(111, 170, 248, 0.1)',
  },
  ghost: {
    background: 'transparent',
    text: '#6FAAF8',
    pressed: 'rgba(111, 170, 248, 0.1)',
  },
  danger: {
    background: '#EF4444',
    text: '#FFFFFF',
    pressed: '#DC2626',
  },
} as const;

export type Boundary = keyof typeof BOUNDARY_CONFIG;
export type Layer = keyof typeof LAYER_CONFIG;
export type ButtonVariant = keyof typeof BUTTON_COLORS;

export default COLORS;
