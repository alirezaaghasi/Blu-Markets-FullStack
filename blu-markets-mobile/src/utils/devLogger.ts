/**
 * Development Logger Utility
 *
 * Provides logging functions that are completely stripped in production builds.
 * This prevents accidental log leakage even if build configuration is wrong.
 *
 * Usage:
 * ```typescript
 * import { devLog, devWarn, devError } from '../utils/devLogger';
 *
 * devLog('[Component] Debug info:', data);
 * devWarn('[Component] Warning:', issue);
 * devError('[Component] Error:', error);
 * ```
 */

// No-op function for production
const noop = (): void => {};

/**
 * Development-only console.log
 * Completely stripped in production builds
 */
export const devLog: typeof console.log = __DEV__
  ? console.log.bind(console)
  : noop;

/**
 * Development-only console.warn
 * Completely stripped in production builds
 */
export const devWarn: typeof console.warn = __DEV__
  ? console.warn.bind(console)
  : noop;

/**
 * Development-only console.error
 * Completely stripped in production builds
 */
export const devError: typeof console.error = __DEV__
  ? console.error.bind(console)
  : noop;

/**
 * Development-only console.info
 * Completely stripped in production builds
 */
export const devInfo: typeof console.info = __DEV__
  ? console.info.bind(console)
  : noop;

/**
 * Development-only console.debug
 * Completely stripped in production builds
 */
export const devDebug: typeof console.debug = __DEV__
  ? console.debug.bind(console)
  : noop;

/**
 * Development-only console.table
 * Completely stripped in production builds
 */
export const devTable: typeof console.table = __DEV__
  ? console.table.bind(console)
  : noop;

/**
 * Development-only console.group/groupEnd
 */
export const devGroup: typeof console.group = __DEV__
  ? console.group.bind(console)
  : noop;

export const devGroupEnd: typeof console.groupEnd = __DEV__
  ? console.groupEnd.bind(console)
  : noop;

/**
 * Conditional logging with a tag prefix
 * Usage: taggedLog('Auth')('User logged in', userId)
 */
export const taggedLog = (tag: string) => {
  if (!__DEV__) return noop;
  return (...args: unknown[]) => console.log(`[${tag}]`, ...args);
};

/**
 * Time a function execution (dev only)
 */
export const devTime = (label: string): void => {
  if (__DEV__) console.time(label);
};

export const devTimeEnd = (label: string): void => {
  if (__DEV__) console.timeEnd(label);
};
