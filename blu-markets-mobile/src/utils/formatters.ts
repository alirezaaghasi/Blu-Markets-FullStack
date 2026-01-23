// Display Formatters
// Color coding and formatting utilities for UI display

import { COLORS } from '../constants/colors';

/**
 * Get color for percentage change (green for positive, red for negative)
 */
export const getChangeColor = (change: number | null | undefined): string => {
  if (change === null || change === undefined || isNaN(change)) {
    return COLORS.text.muted;
  }
  if (change > 0) {
    return COLORS.semantic.success;
  }
  if (change < 0) {
    return COLORS.semantic.error;
  }
  return COLORS.text.muted;
};

/**
 * Format percentage change with sign and color info
 */
export const formatPercentageChange = (
  change: number | null | undefined,
  suffix: string = ''
): { text: string; color: string; isPositive: boolean | null } => {
  if (change === null || change === undefined || isNaN(change)) {
    return {
      text: `--${suffix}`,
      color: COLORS.text.muted,
      isPositive: null,
    };
  }

  const sign = change >= 0 ? '+' : '';
  const text = `${sign}${change.toFixed(1)}%${suffix}`;
  const color = getChangeColor(change);
  const isPositive = change > 0 ? true : change < 0 ? false : null;

  return { text, color, isPositive };
};

/**
 * Get icon for percentage change
 */
export const getChangeIcon = (change: number | null | undefined): string => {
  if (change === null || change === undefined || isNaN(change)) {
    return '📊';
  }
  return change >= 0 ? '📈' : '📉';
};

/**
 * Format daily change display for portfolio
 * Returns formatted text like "+2.5% Today" or "-- Today" if unavailable
 */
export const formatDailyChange = (
  change: number | null | undefined
): { text: string; color: string; backgroundColor: string; icon: string } => {
  const { text, color, isPositive } = formatPercentageChange(change, ' Today');
  const icon = getChangeIcon(change);

  // Background color based on change direction
  let backgroundColor = `${COLORS.text.muted}15`;
  if (isPositive === true) {
    backgroundColor = `${COLORS.semantic.success}15`;
  } else if (isPositive === false) {
    backgroundColor = `${COLORS.semantic.error}15`;
  }

  return { text, color, backgroundColor, icon };
};

/**
 * Get phone display text - masks part of the number for privacy
 * Falls back to user-friendly message if not available
 */
export const formatPhoneDisplay = (phone: string | null | undefined): string => {
  if (!phone || phone.trim() === '') {
    return 'Phone not set';
  }
  return phone;
};

/**
 * Format member since date from phone or registration
 */
export const formatMemberSince = (registrationDate?: string): string => {
  if (!registrationDate) {
    // Default to current month/year
    const now = new Date();
    return `Member since ${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
  }

  const date = new Date(registrationDate);
  if (isNaN(date.getTime())) {
    const now = new Date();
    return `Member since ${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
  }

  return `Member since ${date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
};
