// CSV Export Utility
// Based on PRD Section 9.5 - History Tab CSV Export
import { Paths, File } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { ActionLogEntry } from '../types';

// Escape CSV value (handle commas, quotes, newlines)
const escapeCSVValue = (value: string | number | undefined): string => {
  if (value === undefined || value === null) return '';
  const stringValue = String(value);
  // If contains comma, quote, or newline, wrap in quotes and escape existing quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

// Generate CSV content from action log entries
export const generateCSV = (entries: ActionLogEntry[]): string => {
  // CSV headers
  const headers = [
    'Transaction ID',
    'Date',
    'Time',
    'Type',
    'Message',
    'Amount (IRR)',
    'Asset',
    'Boundary',
  ];

  // CSV rows
  const rows = entries.map((entry) => {
    const date = new Date(entry.timestamp);
    return [
      entry.id.toString(36).toUpperCase(),
      date.toLocaleDateString('en-US'),
      date.toLocaleTimeString('en-US', { hour12: false }),
      entry.type.replace(/_/g, ' '),
      entry.message,
      entry.amountIRR?.toString() || '',
      entry.assetId || '',
      entry.boundary,
    ].map(escapeCSVValue);
  });

  // Combine headers and rows
  const csvContent = [
    headers.map(escapeCSVValue).join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');

  return csvContent;
};

// Export CSV file and share
export const exportToCSV = async (entries: ActionLogEntry[]): Promise<{ success: boolean; error?: string }> => {
  try {
    // Check if sharing is available
    const sharingAvailable = await isAvailableAsync();
    if (!sharingAvailable) {
      return { success: false, error: 'Sharing is not available on this device' };
    }

    // Generate CSV content
    const csvContent = generateCSV(entries);

    // Create file name with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `blu_markets_history_${timestamp}.csv`;

    // Create file in cache directory using new expo-file-system API
    const file = new File(Paths.cache, fileName);

    // Write content to file
    await file.write(csvContent);

    // Share file
    await shareAsync(file.uri, {
      mimeType: 'text/csv',
      dialogTitle: 'Export Transaction History',
      UTI: 'public.comma-separated-values-text',
    });

    // Clean up file after sharing
    try {
      await file.delete();
    } catch {
      // Ignore cleanup errors
    }

    return { success: true };
  } catch (error) {
    console.error('CSV export error:', error);
    return { success: false, error: (error as Error).message };
  }
};
