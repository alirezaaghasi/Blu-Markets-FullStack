// @ts-check
/** @typedef {import('../types').Protection} Protection */
/** @typedef {import('../types').AssetId} AssetId */

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * @typedef {Object} ActiveProtection
 * @property {string} id
 * @property {AssetId} assetId
 * @property {number} notionalIRR
 * @property {number} premiumIRR
 * @property {string} startISO
 * @property {string} endISO
 * @property {number} [durationMonths]
 * @property {number} [startTimeMs]
 * @property {number} [endTimeMs]
 * @property {number} _daysLeft - Computed days remaining
 * @property {number} _progressPct - Computed progress percentage
 */

/**
 * @typedef {Object} ProtectionPartition
 * @property {ActiveProtection[]} activeProtections - Active protections with computed values
 * @property {Protection[]} expiredProtections - Expired protections
 */

/**
 * Partition protections into active and expired with precomputed values
 * @param {Protection[]} protections
 * @returns {ProtectionPartition}
 */
export function selectActiveProtections(protections) {
  const now = Date.now();
  /** @type {ActiveProtection[]} */
  const active = [];
  /** @type {Protection[]} */
  const expired = [];

  for (const p of protections || []) {
    // Use pre-computed timestamps if available, fallback for legacy data
    const endTime = p.endTimeMs ?? new Date(p.endISO).getTime();

    if (endTime < now) {
      expired.push(p);
    } else {
      // Use pre-computed startTimeMs if available
      const startTime = p.startTimeMs ?? new Date(p.startISO).getTime();
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
 * @param {Protection[]} protections
 * @returns {Map<AssetId, number>}
 */
export function selectProtectionDaysMap(protections) {
  const map = new Map();
  const now = Date.now();

  for (const p of protections || []) {
    // Use pre-computed endTimeMs if available, fallback for legacy data
    const until = p.endTimeMs ?? new Date(p.endISO).getTime();
    const daysLeft = Math.max(0, Math.ceil((until - now) / MS_PER_DAY));
    map.set(p.assetId, daysLeft);
  }

  return map;
}

/**
 * Check if an asset has active protection
 * @param {Protection[]} protections
 * @param {AssetId} assetId
 * @returns {boolean}
 */
export function selectHasActiveProtection(protections, assetId) {
  const now = Date.now();
  return (protections || []).some(p => {
    if (p.assetId !== assetId) return false;
    const endTime = p.endTimeMs ?? new Date(p.endISO).getTime();
    return endTime >= now;
  });
}

/**
 * Get active protection for an asset
 * @param {Protection[]} protections
 * @param {AssetId} assetId
 * @returns {Protection | undefined}
 */
export function selectAssetProtection(protections, assetId) {
  const now = Date.now();
  return (protections || []).find(p => {
    if (p.assetId !== assetId) return false;
    const endTime = p.endTimeMs ?? new Date(p.endISO).getTime();
    return endTime >= now;
  });
}
