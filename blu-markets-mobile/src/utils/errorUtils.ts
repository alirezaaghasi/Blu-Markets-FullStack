// Error Utilities
// src/utils/errorUtils.ts

/**
 * Backend error response format from API
 */
interface BackendError {
  error?: {
    code?: string;
    message?: string;
  };
  message?: string;
}

/**
 * Extracts a user-friendly error message from various error formats.
 * Handles:
 * - Backend structured errors: { error: { code, message } }
 * - Standard Error instances
 * - String errors
 * - Unknown error types
 */
export function getErrorMessage(err: unknown, fallback = 'An unexpected error occurred'): string {
  // Backend structured error: { error: { code, message } }
  if (err && typeof err === 'object' && 'error' in err) {
    const backendError = err as BackendError;
    if (backendError.error?.message) {
      return backendError.error.message;
    }
  }

  // Direct message property (some API responses)
  if (err && typeof err === 'object' && 'message' in err) {
    const errorWithMessage = err as { message: string };
    if (typeof errorWithMessage.message === 'string') {
      return errorWithMessage.message;
    }
  }

  // Standard Error instance
  if (err instanceof Error) {
    return err.message;
  }

  // String error
  if (typeof err === 'string') {
    return err;
  }

  return fallback;
}
