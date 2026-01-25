/**
 * Graceful Shutdown Handler
 * Ensures all resources are properly cleaned up on process termination
 */

import { logger } from './logger.js';

type ShutdownHandler = () => Promise<void> | void;

// Store all registered shutdown handlers
const shutdownHandlers: Array<{ name: string; handler: ShutdownHandler; priority: number }> = [];

// Track if shutdown is in progress
let isShuttingDown = false;

/**
 * Register a shutdown handler with optional priority.
 * Lower priority numbers run first (0 = highest priority).
 * Use this for clearing intervals, closing connections, etc.
 */
export function registerShutdownHandler(
  name: string,
  handler: ShutdownHandler,
  priority = 10
): void {
  shutdownHandlers.push({ name, handler, priority });
  logger.debug('Registered shutdown handler', { name, priority });
}

/**
 * Execute all shutdown handlers in priority order.
 * Called automatically on SIGINT/SIGTERM, but can be called manually.
 */
export async function executeShutdown(): Promise<void> {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress');
    return;
  }
  isShuttingDown = true;

  logger.info('Executing graceful shutdown');

  // Sort by priority (lower first)
  const sorted = [...shutdownHandlers].sort((a, b) => a.priority - b.priority);

  for (const { name, handler } of sorted) {
    try {
      logger.debug('Running shutdown handler', { name });
      await handler();
      logger.debug('Shutdown handler completed', { name });
    } catch (error) {
      logger.error('Shutdown handler failed', error, { name });
    }
  }

  logger.info('Graceful shutdown complete');
}

/**
 * Register signal handlers for graceful shutdown.
 * Call this once at application startup.
 */
export function setupGracefulShutdown(): void {
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.info('Received shutdown signal', { signal });
      await executeShutdown();
      process.exit(0);
    });
  });

  // Handle uncaught errors
  process.on('uncaughtException', async (error) => {
    logger.error('Uncaught exception', error);
    await executeShutdown();
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason) => {
    logger.error('Unhandled rejection', reason as Error);
    await executeShutdown();
    process.exit(1);
  });

  logger.debug('Graceful shutdown handlers registered');
}
