/**
 * Blu Markets Design System Tokens
 * 
 * This file contains all design tokens for the Blu Markets mobile app.
 * Import these constants throughout the app for consistent styling.
 */

// =============================================================================
// COLORS
// =============================================================================

export const COLORS = {
  // Backgrounds
  background: {
    primary: '#0E1420',      // Main app background
    surface: '#151C28',      // Cards, bottom sheets
    elevated: '#1C2433',     // Modals, elevated surfaces
    input: '#1C2433',        // Input field backgrounds
  },
  
  // Text
  text: {
    primary: '#FFFFFF',
    secondary: '#9CA3AF',    // Gray-400
    muted: '#6B7280',        // Gray-500
    disabled: '#4B5563',     // Gray-600
    inverse: '#0E1420',      // For light backgrounds
  },
  
  // Brand
  brand: {
    primary: '#6FAAF8',      // Primary blue (buttons, links, active states)
    primaryHover: '#5B9AE8',
    primaryPressed: '#4A89D7',
    primaryMuted: 'rgba(111, 170, 248, 0.15)', // For backgrounds
  },
  
  // Layers (Portfolio Allocation)
  layers: {
    foundation: '#3B82F6',   // Blue - Stable assets
    growth: '#A855F7',       // Purple - Moderate risk
    upside: '#10B981',       // Green/Emerald - High risk
  },
  
  // Layer backgrounds (15% opacity versions)
  layersBg: {
    foundation: 'rgba(59, 130, 246, 0.15)',
    growth: 'rgba(168, 85, 247, 0.15)',
    upside: 'rgba(16, 185, 129, 0.15)',
  },
  
  // Semantic
  semantic: {
    success: '#22C55E',      // Green - Positive actions, gains
    warning: '#F59E0B',      // Amber - Warnings, drift
    error: '#EF4444',        // Red - Errors, stress
    info: '#3B82F6',         // Blue - Information
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
    safe: '#22C55E',         // Green dot/badge
    drift: '#F59E0B',        // Amber dot/badge
    structural: '#F97316',   // Orange dot/badge
    stress: '#EF4444',       // Red dot/badge
  },
  
  // Utility
  border: '#1C2433',
  divider: '#1C2433',
  overlay: 'rgba(0, 0, 0, 0.5)',
  shimmer: '#2A3441',        // For skeleton loading
} as const;

// =============================================================================
// TYPOGRAPHY
// =============================================================================

export const TYPOGRAPHY = {
  // Font Family (use system fonts as fallback)
  fontFamily: {
    regular: 'System',       // Replace with BluSans-Regular if available
    medium: 'System',        // Replace with BluSans-Medium if available
    semibold: 'System',      // Replace with BluSans-SemiBold if available
    bold: 'System',          // Replace with BluSans-Bold if available
  },
  
  // Font Sizes (in pixels, convert to sp for React Native)
  fontSize: {
    xs: 11,     // Labels, captions
    sm: 12,     // Small text, timestamps
    base: 14,   // Body text
    md: 16,     // Emphasized body
    lg: 18,     // Subheadings
    xl: 20,     // Section titles
    '2xl': 24,  // Card titles
    '3xl': 28,  // Page titles
    '4xl': 32,  // Large numbers
    '5xl': 40,  // Hero numbers (portfolio value)
  },
  
  // Font Weights (for system fonts)
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  
  // Line Heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  
  // Letter Spacing
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 1,
  },
} as const;

// =============================================================================
// SPACING
// =============================================================================

export const SPACING = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  11: 44,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
} as const;

// =============================================================================
// BORDER RADIUS
// =============================================================================

export const RADIUS = {
  none: 0,
  sm: 8,       // Small elements, chips
  md: 12,      // Buttons, inputs
  lg: 16,      // Cards, sheets
  xl: 24,      // Large cards, modals
  '2xl': 32,   // Extra large
  full: 9999,  // Pills, avatars
} as const;

// =============================================================================
// SHADOWS
// =============================================================================

export const SHADOWS = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 16,
  },
} as const;

// =============================================================================
// COMPONENT SIZES
// =============================================================================

export const SIZES = {
  // Buttons
  button: {
    sm: { height: 36, paddingHorizontal: 12, fontSize: 14 },
    md: { height: 44, paddingHorizontal: 16, fontSize: 16 },
    lg: { height: 52, paddingHorizontal: 20, fontSize: 16 },
  },
  
  // Icons
  icon: {
    xs: 12,
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
    '2xl': 48,
  },
  
  // Avatars
  avatar: {
    xs: 20,
    sm: 24,
    md: 32,
    lg: 48,
    xl: 64,
    '2xl': 80,
  },
  
  // Bottom Navigation
  bottomNav: {
    height: 64,
    iconSize: 24,
    labelSize: 11,
  },
  
  // Bottom Sheet
  bottomSheet: {
    dragIndicatorWidth: 36,
    dragIndicatorHeight: 4,
    maxHeight: '90%',
  },
  
  // Input Fields
  input: {
    height: 48,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  
  // Cards
  card: {
    padding: 16,
    borderRadius: 16,
  },
  
  // Activity Feed Entry
  activityEntry: {
    dotSize: 12,
    lineWidth: 2,
    padding: 12,
  },
  
  // FAB (Floating Action Button)
  fab: {
    size: 56,
    iconSize: 24,
  },
} as const;

// =============================================================================
// ANIMATION DURATIONS
// =============================================================================

export const ANIMATION = {
  duration: {
    instant: 0,
    fast: 150,
    normal: 300,
    slow: 500,
  },
  easing: {
    // Use React Native Animated easing functions
    linear: 'linear',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
  },
} as const;

// =============================================================================
// Z-INDEX
// =============================================================================

export const Z_INDEX = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  modalBackdrop: 40,
  modal: 50,
  popover: 60,
  toast: 70,
} as const;

// =============================================================================
// BREAKPOINTS (for responsive design if needed)
// =============================================================================

export const BREAKPOINTS = {
  sm: 360,   // Small phones
  md: 390,   // Standard phones
  lg: 428,   // Large phones
  xl: 768,   // Tablets
} as const;

// =============================================================================
// LAYER CONFIGURATION
// =============================================================================

export const LAYERS = {
  FOUNDATION: {
    id: 'FOUNDATION',
    name: 'Foundation',
    nameFa: 'پایه',
    color: COLORS.layers.foundation,
    bgColor: COLORS.layersBg.foundation,
    description: 'Stable assets like stablecoins',
    riskLevel: 'Low',
  },
  GROWTH: {
    id: 'GROWTH',
    name: 'Growth',
    nameFa: 'رشد',
    color: COLORS.layers.growth,
    bgColor: COLORS.layersBg.growth,
    description: 'Blue-chip cryptocurrencies',
    riskLevel: 'Medium',
  },
  UPSIDE: {
    id: 'UPSIDE',
    name: 'Upside',
    nameFa: 'پتانسیل',
    color: COLORS.layers.upside,
    bgColor: COLORS.layersBg.upside,
    description: 'High-growth potential assets',
    riskLevel: 'High',
  },
} as const;

// =============================================================================
// BOUNDARY CONFIGURATION
// =============================================================================

export const BOUNDARIES = {
  SAFE: {
    id: 'SAFE',
    label: 'SAFE',
    color: COLORS.boundary.safe,
    bgColor: COLORS.semanticBg.success,
    description: 'Action aligns with target allocation',
  },
  DRIFT: {
    id: 'DRIFT',
    label: 'DRIFT',
    color: COLORS.boundary.drift,
    bgColor: COLORS.semanticBg.warning,
    description: 'Minor deviation from target',
  },
  STRUCTURAL: {
    id: 'STRUCTURAL',
    label: 'DRIFT', // Show as DRIFT to user (less alarming)
    color: COLORS.boundary.structural,
    bgColor: 'rgba(249, 115, 22, 0.15)',
    description: 'Major deviation from target',
  },
  STRESS: {
    id: 'STRESS',
    label: 'RISK',
    color: COLORS.boundary.stress,
    bgColor: COLORS.semanticBg.error,
    description: 'High risk action',
  },
} as const;

// =============================================================================
// EXPORT TYPES
// =============================================================================

export type ColorKey = keyof typeof COLORS;
export type SpacingKey = keyof typeof SPACING;
export type RadiusKey = keyof typeof RADIUS;
export type LayerId = keyof typeof LAYERS;
export type BoundaryId = keyof typeof BOUNDARIES;
