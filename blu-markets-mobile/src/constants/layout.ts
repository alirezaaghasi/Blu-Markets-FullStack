/**
 * Layout Constants for iPhone 16 Pro
 * 393 x 852 points
 */

export const DEVICE = {
  // iPhone 16 Pro dimensions
  width: 393,
  height: 852,

  // Safe areas
  safeTop: 59,
  safeBottom: 34,

  // Status bar
  statusBarHeight: 54,

  // Dynamic Island
  dynamicIslandWidth: 126,
  dynamicIslandHeight: 37,
} as const;

export const LAYOUT = {
  // Screen padding
  screenPaddingH: 16,
  contentWidth: 361, // 393 - 32

  // Bottom navigation
  bottomNavHeight: 64,
  bottomNavPaddingBottom: 34, // Safe area
  totalBottomSpace: 98, // 64 + 34

  // Usable content area
  usableHeight: 695, // 852 - 59 - 98

  // Bottom sheet snap points
  sheetMaxHeight: 767, // 90% of 852
  sheetMidHeight: 426, // 50% of 852
  sheetSnapPoints: ['50%', '90%'],

  // Modal
  modalMaxWidth: 343, // 393 - 50
  modalPadding: 24,
  modalRadius: 24,

  // Header
  headerHeight: 56,
} as const;

export const HIT_SLOP = {
  small: { top: 8, bottom: 8, left: 8, right: 8 },
  medium: { top: 12, bottom: 12, left: 12, right: 12 },
  large: { top: 16, bottom: 16, left: 16, right: 16 },
} as const;
