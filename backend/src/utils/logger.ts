/**
 * Structured logger for Blu Markets
 * In development: Pretty console output
 * In production: JSON format for log aggregation
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogContext = Record<string, unknown>;

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Use process.env directly to avoid circular dependency with env.ts
const NODE_ENV = process.env.NODE_ENV || 'development';
const CURRENT_LEVEL: LogLevel = NODE_ENV === 'production' ? 'info' : 'debug';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LEVEL];
}

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();

  if (NODE_ENV === 'production') {
    return JSON.stringify({ timestamp, level, message, ...context });
  }

  const prefix: Record<LogLevel, string> = {
    debug: '[DEBUG]',
    info: '[INFO]',
    warn: '[WARN]',
    error: '[ERROR]',
  };
  const contextStr = context ? ` ${JSON.stringify(context)}` : '';
  return `${prefix[level]} [${timestamp}] ${message}${contextStr}`;
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    if (shouldLog('debug')) console.log(formatMessage('debug', message, context));
  },
  info(message: string, context?: LogContext): void {
    if (shouldLog('info')) console.log(formatMessage('info', message, context));
  },
  warn(message: string, context?: LogContext): void {
    if (shouldLog('warn')) console.warn(formatMessage('warn', message, context));
  },
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (shouldLog('error')) {
      const errorContext = error instanceof Error
        ? { errorName: error.name, errorMessage: error.message, stack: error.stack }
        : error !== undefined
          ? { error }
          : {};
      console.error(formatMessage('error', message, { ...errorContext, ...context }));
    }
  },
};

export type Logger = typeof logger;
