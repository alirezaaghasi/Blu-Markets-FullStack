// Date Utility Functions
// Safe relative time formatting that handles invalid dates

/**
 * Format a timestamp as relative time (e.g., "5m ago", "2h ago", "Yesterday")
 * Returns "Just now" for invalid/missing timestamps to prevent NaN display
 */
export const formatRelativeTime = (timestamp: string | null | undefined): string => {
  // Handle missing or empty timestamps
  if (!timestamp) {
    return 'Just now';
  }

  const now = Date.now();
  const time = new Date(timestamp).getTime();

  // Check for invalid date (NaN)
  if (isNaN(time)) {
    return 'Just now';
  }

  const diff = now - time;

  // Handle future dates or very small differences
  if (diff < 0 || diff < 60000) {
    return 'Just now';
  }

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  // Validate calculated values
  if (isNaN(minutes) || isNaN(hours) || isNaN(days)) {
    return 'Just now';
  }

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;

  // For older dates, show the actual date
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * Format a date for display (e.g., "Jan 15, 2026")
 */
export const formatDate = (timestamp: string | null | undefined): string => {
  if (!timestamp) return '--';

  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '--';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Format a date with time (e.g., "Jan 15, 2026 at 2:30 PM")
 */
export const formatDateTime = (timestamp: string | null | undefined): string => {
  if (!timestamp) return '--';

  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '--';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};
