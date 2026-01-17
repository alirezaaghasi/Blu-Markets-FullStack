import type { Protection, AssetId } from '../types';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface ActiveProtection extends Protection {
  _daysLeft: number;
  _progressPct: number;
}

export interface ProtectionPartition {
  activeProtections: ActiveProtection[];
  expiredProtections: Protection[];
}

/**
 * Partition protections into active and expired with precomputed values
 */
export function selectActiveProtections(protections: Protection[]): ProtectionPartition {
  const now = Date.now();
  const active: ActiveProtection[] = [];
  const expired: Protection[] = [];

  for (const p of protections || []) {
    // Use pre-computed timestamps if available, fallback for legacy data
    const endTime = (p as Protection & { endTimeMs?: number }).endTimeMs ?? new Date(p.endISO).getTime();

    if (endTime < now) {
      expired.push(p);
    } else {
      // Use pre-computed startTimeMs if available
      const startTime = (p as Protection & { startTimeMs?: number }).startTimeMs ?? new Date(p.startISO).getTime();
      const totalDuration = endTime - startTime;
      const elapsed = now - startTime;
      const progressPct = Math.min(100, Math.max(0, 100 - (elapsed / totalDuration) * 100));
      const daysLeft = Math.ceil((endTime - now) / MS_PER_DAY);

      active.push({
        ...p,
        _daysLeft: daysLeft,
        _progressPct: progressPct,
      });
    }
  }

  return { activeProtections: active, expiredProtections: expired };
}

/**
 * Create a Map of protection days remaining by assetId
 */
export function selectProtectionDaysMap(protections: Protection[]): Map<AssetId, number> {
  const map = new Map<AssetId, number>();
  const now = Date.now();

  for (const p of protections || []) {
    // Use pre-computed endTimeMs if available, fallback for legacy data
    const until = (p as Protection & { endTimeMs?: number }).endTimeMs ?? new Date(p.endISO).getTime();
    const daysLeft = Math.max(0, Math.ceil((until - now) / MS_PER_DAY));
    map.set(p.assetId, daysLeft);
  }

  return map;
}

/**
 * Check if an asset has active protection
 */
export function selectHasActiveProtection(protections: Protection[], assetId: AssetId): boolean {
  const now = Date.now();
  return (protections || []).some(p => {
    if (p.assetId !== assetId) return false;
    const endTime = (p as Protection & { endTimeMs?: number }).endTimeMs ?? new Date(p.endISO).getTime();
    return endTime >= now;
  });
}

/**
 * Get active protection for an asset
 */
export function selectAssetProtection(protections: Protection[], assetId: AssetId): Protection | undefined {
  const now = Date.now();
  return (protections || []).find(p => {
    if (p.assetId !== assetId) return false;
    const endTime = (p as Protection & { endTimeMs?: number }).endTimeMs ?? new Date(p.endISO).getTime();
    return endTime >= now;
  });
}
