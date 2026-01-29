/**
 * Distributed Lock Service
 *
 * Provides Redis-based distributed locks for preventing duplicate job runs
 * across multiple instances. Uses SETNX with TTL for safe lock acquisition.
 *
 * @module services/distributed-lock.service
 */

import { getRedis } from '../config/redis.js';
import { logger } from '../utils/logger.js';

const LOCK_PREFIX = 'lock:';

/**
 * Attempt to acquire a distributed lock
 * @param lockName - Unique identifier for the lock
 * @param ttlSeconds - Lock expiry time (prevents deadlocks if holder crashes)
 * @returns true if lock acquired, false otherwise
 */
export async function acquireLock(lockName: string, ttlSeconds: number): Promise<boolean> {
  const redis = getRedis();

  if (!redis) {
    // No Redis - allow execution (single-instance mode)
    logger.debug('No Redis available, allowing lock acquisition', { lockName });
    return true;
  }

  try {
    const key = `${LOCK_PREFIX}${lockName}`;
    const instanceId = `${process.pid}-${Date.now()}`;

    // SET key value NX EX ttl - atomic set-if-not-exists with expiry
    const result = await redis.set(key, instanceId, 'EX', ttlSeconds, 'NX');

    if (result === 'OK') {
      logger.debug('Acquired distributed lock', { lockName, ttlSeconds, instanceId });
      return true;
    }

    logger.debug('Failed to acquire lock - already held', { lockName });
    return false;
  } catch (error) {
    logger.warn('Redis lock acquisition failed, allowing execution', { lockName, error });
    // On Redis failure, allow execution to prevent jobs from never running
    return true;
  }
}

/**
 * Release a distributed lock
 * @param lockName - The lock to release
 */
export async function releaseLock(lockName: string): Promise<void> {
  const redis = getRedis();

  if (!redis) {
    return;
  }

  try {
    const key = `${LOCK_PREFIX}${lockName}`;
    await redis.del(key);
    logger.debug('Released distributed lock', { lockName });
  } catch (error) {
    logger.warn('Failed to release lock', { lockName, error });
  }
}

/**
 * Execute a function while holding a distributed lock
 * Automatically releases the lock when done (or on error)
 *
 * @param lockName - Unique identifier for the lock
 * @param ttlSeconds - Lock expiry time
 * @param fn - Function to execute while holding the lock
 * @returns Result of fn, or null if lock couldn't be acquired
 */
export async function withLock<T>(
  lockName: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T | null> {
  const acquired = await acquireLock(lockName, ttlSeconds);

  if (!acquired) {
    return null;
  }

  try {
    return await fn();
  } finally {
    await releaseLock(lockName);
  }
}

/**
 * Extend a lock's TTL (for long-running operations)
 * @param lockName - The lock to extend
 * @param ttlSeconds - New TTL value
 */
export async function extendLock(lockName: string, ttlSeconds: number): Promise<boolean> {
  const redis = getRedis();

  if (!redis) {
    return true;
  }

  try {
    const key = `${LOCK_PREFIX}${lockName}`;
    const result = await redis.expire(key, ttlSeconds);
    return result === 1;
  } catch (error) {
    logger.warn('Failed to extend lock', { lockName, error });
    return false;
  }
}
