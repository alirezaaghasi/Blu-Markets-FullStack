/**
 * Quote Cache Service
 *
 * Provides Redis-backed quote caching with in-memory fallback for horizontal scaling.
 * Supports atomic reservation to prevent race conditions across multiple instances.
 *
 * @module services/quote-cache.service
 */

import { getRedis } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/error-handler.js';
import type { ProtectionQuote } from './protection-pricing.service.js';

// ============================================================================
// TYPES
// ============================================================================

export type QuoteStatus = 'available' | 'reserved' | 'consumed';

export interface CachedQuote {
  quote: ProtectionQuote;
  userId: string;
  createdAt: string; // ISO string for Redis serialization
  status: QuoteStatus;
  reservedAt?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const QUOTE_KEY_PREFIX = 'quote:';
const HOLDING_INDEX_PREFIX = 'holding_quotes:';
const MAX_QUOTE_CACHE_SIZE = 10000;

// In-memory fallback when Redis is unavailable
const memoryCache = new Map<string, CachedQuote>();
const memoryHoldingIndex = new Map<string, Set<string>>();

// ============================================================================
// REDIS HELPERS
// ============================================================================

function getQuoteKey(quoteId: string): string {
  return `${QUOTE_KEY_PREFIX}${quoteId}`;
}

function getHoldingIndexKey(holdingId: string): string {
  return `${HOLDING_INDEX_PREFIX}${holdingId}`;
}

/**
 * Calculate TTL in seconds from quote expiry
 */
function calculateTtlSeconds(validUntil: Date): number {
  const now = Date.now();
  const expiryMs = new Date(validUntil).getTime();
  // Add 60 seconds buffer to ensure cache entry exists until quote is truly expired
  return Math.max(1, Math.ceil((expiryMs - now) / 1000) + 60);
}

// ============================================================================
// CACHE OPERATIONS
// ============================================================================

/**
 * Store a quote in the cache
 */
export async function cacheQuote(quote: ProtectionQuote, userId: string): Promise<void> {
  const cached: CachedQuote = {
    quote,
    userId,
    createdAt: new Date().toISOString(),
    status: 'available',
  };

  const redis = getRedis();
  if (redis) {
    try {
      const ttl = calculateTtlSeconds(quote.validUntil);
      const key = getQuoteKey(quote.quoteId);

      // Store quote with TTL
      await redis.setex(key, ttl, JSON.stringify(cached));

      // Add to holding index
      await redis.sadd(getHoldingIndexKey(quote.holdingId), quote.quoteId);
      // Set TTL on the set too (slightly longer to handle cleanup)
      await redis.expire(getHoldingIndexKey(quote.holdingId), ttl + 300);

      return;
    } catch (error) {
      logger.warn('Redis cache failed, using memory fallback', { error });
    }
  }

  // Memory fallback
  evictOldestQuotesMemory();
  memoryCache.set(quote.quoteId, cached);

  let holdingQuotes = memoryHoldingIndex.get(quote.holdingId);
  if (!holdingQuotes) {
    holdingQuotes = new Set();
    memoryHoldingIndex.set(quote.holdingId, holdingQuotes);
  }
  holdingQuotes.add(quote.quoteId);
}

/**
 * Get a cached quote (read-only, does not change status)
 */
export async function getCachedQuote(quoteId: string): Promise<CachedQuote | null> {
  const redis = getRedis();
  if (redis) {
    try {
      const data = await redis.get(getQuoteKey(quoteId));
      if (data) {
        return JSON.parse(data) as CachedQuote;
      }
      return null;
    } catch (error) {
      logger.warn('Redis get failed, using memory fallback', { error });
    }
  }

  // Memory fallback
  return memoryCache.get(quoteId) || null;
}

/**
 * Retrieve and validate a cached quote
 * @throws AppError if quote not found, expired, or belongs to different user
 */
export async function getAndValidateCachedQuote(
  quoteId: string,
  userId: string
): Promise<ProtectionQuote> {
  const cached = await getCachedQuote(quoteId);

  if (!cached) {
    throw new AppError('QUOTE_NOT_FOUND', 'Quote not found or already used', 404, { quoteId });
  }

  if (cached.userId !== userId) {
    throw new AppError('UNAUTHORIZED', 'Quote does not belong to user', 401);
  }

  const validUntil = new Date(cached.quote.validUntil);
  if (new Date() > validUntil) {
    await removeQuoteFromCache(quoteId, cached.quote.holdingId);
    throw new AppError('QUOTE_EXPIRED', 'Quote has expired, please request a new quote', 410, {
      quoteId,
      expiredAt: validUntil.toISOString(),
    });
  }

  if (cached.status === 'consumed') {
    throw new AppError('QUOTE_NOT_FOUND', 'Quote has already been used', 404, { quoteId });
  }

  if (cached.status === 'reserved') {
    throw new AppError('QUOTE_IN_USE', 'Quote is being processed by another transaction', 409, {
      quoteId,
    });
  }

  return cached.quote;
}

/**
 * Atomically reserve a quote for purchase
 * Uses Redis Lua script for atomicity across instances
 * @throws AppError if quote not found, expired, already reserved, or belongs to different user
 */
export async function reserveQuote(quoteId: string, userId: string): Promise<ProtectionQuote> {
  const redis = getRedis();

  if (redis) {
    try {
      // Lua script for atomic check-and-reserve
      const luaScript = `
        local data = redis.call('GET', KEYS[1])
        if not data then
          return {err = 'NOT_FOUND'}
        end
        local cached = cjson.decode(data)
        if cached.userId ~= ARGV[1] then
          return {err = 'UNAUTHORIZED'}
        end
        if cached.status == 'consumed' then
          return {err = 'CONSUMED'}
        end
        if cached.status == 'reserved' then
          return {err = 'RESERVED'}
        end
        cached.status = 'reserved'
        cached.reservedAt = ARGV[2]
        redis.call('SET', KEYS[1], cjson.encode(cached), 'KEEPTTL')
        return cjson.encode(cached)
      `;

      const result = await redis.eval(
        luaScript,
        1,
        getQuoteKey(quoteId),
        userId,
        new Date().toISOString()
      ) as string | { err: string };

      if (typeof result === 'object' && 'err' in result) {
        switch (result.err) {
          case 'NOT_FOUND':
            throw new AppError('QUOTE_NOT_FOUND', 'Quote not found or already used', 404, {
              quoteId,
            });
          case 'UNAUTHORIZED':
            throw new AppError('UNAUTHORIZED', 'Quote does not belong to user', 401);
          case 'CONSUMED':
            throw new AppError('QUOTE_NOT_FOUND', 'Quote has already been used', 404, { quoteId });
          case 'RESERVED':
            throw new AppError('QUOTE_IN_USE', 'Quote is being processed by another transaction', 409, {
              quoteId,
            });
        }
      }

      const cached = JSON.parse(result as string) as CachedQuote;

      // Check expiry - convert string back to Date (JSON serialization loses Date type)
      const validUntil = new Date(cached.quote.validUntil);
      if (new Date() > validUntil) {
        await removeQuoteFromCache(quoteId, cached.quote.holdingId);
        throw new AppError('QUOTE_EXPIRED', 'Quote has expired, please request a new quote', 410, {
          quoteId,
          expiredAt: validUntil.toISOString(),
        });
      }

      // Restore Date object before returning (JSON.parse converts Dates to strings)
      cached.quote.validUntil = validUntil;
      return cached.quote;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.warn('Redis reserve failed, using memory fallback', { error });
    }
  }

  // Memory fallback (synchronous, single-threaded)
  const cached = memoryCache.get(quoteId);

  if (!cached) {
    throw new AppError('QUOTE_NOT_FOUND', 'Quote not found or already used', 404, { quoteId });
  }

  if (cached.userId !== userId) {
    throw new AppError('UNAUTHORIZED', 'Quote does not belong to user', 401);
  }

  // Convert string back to Date (JSON serialization loses Date type)
  const validUntil = new Date(cached.quote.validUntil);
  if (new Date() > validUntil) {
    removeQuoteFromCacheMemory(quoteId, cached.quote.holdingId);
    throw new AppError('QUOTE_EXPIRED', 'Quote has expired, please request a new quote', 410, {
      quoteId,
      expiredAt: validUntil.toISOString(),
    });
  }

  if (cached.status === 'consumed') {
    throw new AppError('QUOTE_NOT_FOUND', 'Quote has already been used', 404, { quoteId });
  }

  if (cached.status === 'reserved') {
    throw new AppError('QUOTE_IN_USE', 'Quote is being processed by another transaction', 409, {
      quoteId,
    });
  }

  // Reserve atomically (synchronous in Node.js)
  cached.status = 'reserved';
  cached.reservedAt = new Date().toISOString();

  // Restore Date object before returning
  cached.quote.validUntil = validUntil;
  return cached.quote;
}

/**
 * Release a reserved quote (call on transaction failure)
 */
export async function releaseQuote(quoteId: string): Promise<void> {
  const redis = getRedis();

  if (redis) {
    try {
      const luaScript = `
        local data = redis.call('GET', KEYS[1])
        if data then
          local cached = cjson.decode(data)
          if cached.status == 'reserved' then
            cached.status = 'available'
            cached.reservedAt = nil
            redis.call('SET', KEYS[1], cjson.encode(cached), 'KEEPTTL')
          end
        end
        return 'OK'
      `;

      await redis.eval(luaScript, 1, getQuoteKey(quoteId));
      return;
    } catch (error) {
      logger.warn('Redis release failed, using memory fallback', { error });
    }
  }

  // Memory fallback
  const cached = memoryCache.get(quoteId);
  if (cached && cached.status === 'reserved') {
    cached.status = 'available';
    cached.reservedAt = undefined;
  }
}

/**
 * Consume a quote (mark as used after successful purchase)
 * Also invalidates all other quotes for the same holding
 */
export async function consumeQuote(quoteId: string): Promise<void> {
  const redis = getRedis();

  if (redis) {
    try {
      // Get quote to find holdingId
      const data = await redis.get(getQuoteKey(quoteId));
      if (data) {
        const cached = JSON.parse(data) as CachedQuote;

        // Mark as consumed
        cached.status = 'consumed';
        await redis.setex(
          getQuoteKey(quoteId),
          60, // Keep for 1 minute for debugging
          JSON.stringify(cached)
        );

        // Invalidate all quotes for this holding
        await invalidateQuotesForHolding(cached.quote.holdingId);
      }
      return;
    } catch (error) {
      logger.warn('Redis consume failed, using memory fallback', { error });
    }
  }

  // Memory fallback
  const cached = memoryCache.get(quoteId);
  if (cached) {
    cached.status = 'consumed';
    invalidateQuotesForHoldingMemory(cached.quote.holdingId);
  }
}

/**
 * Invalidate all cached quotes for a specific holding
 */
export async function invalidateQuotesForHolding(holdingId: string): Promise<void> {
  const redis = getRedis();

  if (redis) {
    try {
      const indexKey = getHoldingIndexKey(holdingId);
      const quoteIds = await redis.smembers(indexKey);

      if (quoteIds.length > 0) {
        const pipeline = redis.pipeline();
        for (const qid of quoteIds) {
          pipeline.del(getQuoteKey(qid));
        }
        pipeline.del(indexKey);
        await pipeline.exec();
      }
      return;
    } catch (error) {
      logger.warn('Redis invalidate failed, using memory fallback', { error });
    }
  }

  // Memory fallback
  invalidateQuotesForHoldingMemory(holdingId);
}

/**
 * Remove a specific quote from cache
 */
export async function removeQuoteFromCache(quoteId: string, holdingId: string): Promise<void> {
  const redis = getRedis();

  if (redis) {
    try {
      await redis.del(getQuoteKey(quoteId));
      await redis.srem(getHoldingIndexKey(holdingId), quoteId);
      return;
    } catch (error) {
      logger.warn('Redis remove failed, using memory fallback', { error });
    }
  }

  // Memory fallback
  removeQuoteFromCacheMemory(quoteId, holdingId);
}

// ============================================================================
// MEMORY FALLBACK HELPERS
// ============================================================================

function removeQuoteFromCacheMemory(quoteId: string, holdingId: string): void {
  memoryCache.delete(quoteId);
  const holdingQuotes = memoryHoldingIndex.get(holdingId);
  if (holdingQuotes) {
    holdingQuotes.delete(quoteId);
    if (holdingQuotes.size === 0) {
      memoryHoldingIndex.delete(holdingId);
    }
  }
}

function invalidateQuotesForHoldingMemory(holdingId: string): void {
  const holdingQuotes = memoryHoldingIndex.get(holdingId);
  if (holdingQuotes) {
    for (const quoteId of holdingQuotes) {
      memoryCache.delete(quoteId);
    }
    memoryHoldingIndex.delete(holdingId);
  }
}

function evictOldestQuotesMemory(): void {
  if (memoryCache.size <= MAX_QUOTE_CACHE_SIZE) {
    return;
  }

  const entries = Array.from(memoryCache.entries());
  entries.sort(
    (a, b) => new Date(a[1].createdAt).getTime() - new Date(b[1].createdAt).getTime()
  );

  const evictCount = Math.max(1, Math.floor(memoryCache.size * 0.1));
  for (let i = 0; i < evictCount && i < entries.length; i++) {
    const [quoteId, cached] = entries[i];
    removeQuoteFromCacheMemory(quoteId, cached.quote.holdingId);
  }
}

/**
 * Cleanup expired quotes from memory cache (called periodically)
 */
export function cleanupExpiredQuotesMemory(): void {
  const now = new Date();
  for (const [quoteId, cached] of memoryCache.entries()) {
    if (now > new Date(cached.quote.validUntil)) {
      removeQuoteFromCacheMemory(quoteId, cached.quote.holdingId);
    }
  }
}

// Run cleanup every minute for memory cache
setInterval(cleanupExpiredQuotesMemory, 60_000);
