import React, { useState, useMemo, Dispatch } from 'react';
import { formatIRR, getAssetDisplayName } from '../helpers';
import { ASSET_LAYER } from '../state/domain';
import { LAYER_EXPLANATIONS } from '../constants/index';
import { selectActiveProtections } from '../selectors/index';
import type { Protection as ProtectionType, Layer, AppAction } from '../types';

interface EnrichedProtection extends ProtectionType {
  _progressPct?: number;
  _daysLeft?: number;
}

interface ProtectionProps {
  protections: ProtectionType[];
  dispatch: Dispatch<AppAction>;
}

/**
 * Protection - Active protections list with progress bars
 * Shows protection status, premium paid, days remaining
 * Supports cancel and handles expiration
 */
function Protection({ protections, dispatch }: ProtectionProps) {
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const list = protections || [];

  // Memoize partitioned protections - use selector
  const { activeProtections, expiredProtections } = useMemo(
    () => selectActiveProtections(list),
    [list]
  );

  const handleCancel = (protectionId: string) => {
    dispatch({ type: 'CANCEL_PROTECTION', protectionId });
    setConfirmCancel(null);
  };

  const renderProtectionItem = (p: EnrichedProtection, isExpiredItem = false) => {
    const layer = ASSET_LAYER[p.assetId];
    const info = LAYER_EXPLANATIONS[layer];

    return (
      <div key={p.id} className={`item protectionItem ${isExpiredItem ? 'expired' : ''}`}>
        <div style={{ flex: 1 }}>
          <div className="asset">
            {isExpiredItem ? '⏱️' : '☂️'} {getAssetDisplayName(p.assetId)}
            {isExpiredItem && <span className="expiredBadge">Expired</span>}
          </div>
          <div className="muted">
            <span className={`layerDot ${(layer as string).toLowerCase()}`} style={{ marginRight: 6 }}></span>
            {info?.name}
            {p.durationMonths ? ` · ${p.durationMonths}mo coverage` : ''}
          </div>

          {/* Progress bar for active protections - uses precomputed values */}
          {!isExpiredItem && (
            <div className="protectionProgress">
              <div className="protectionProgressBar">
                <div className="protectionProgressFill" style={{ width: `${p._progressPct}%` }} />
              </div>
              <div className="protectionProgressText">
                <span>{p._daysLeft} days remaining</span>
                <span>{Math.round(p._progressPct)}% left</span>
              </div>
            </div>
          )}

          {/* Expiration date for expired */}
          {isExpiredItem && (
            <div className="expiredDate">
              Ended {new Date(p.endISO).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'right' }}>
          <div className="asset">{formatIRR(p.premiumIRR)}</div>
          <div className="muted">Premium paid</div>

          {/* Cancel button for active protections */}
          {!isExpiredItem && (
            <div style={{ marginTop: 8 }}>
              {confirmCancel === p.id ? (
                <div className="cancelConfirm">
                  <span className="cancelText">Cancel?</span>
                  <button className="btn tiny danger" onClick={() => handleCancel(p.id)}>Yes</button>
                  <button className="btn tiny" onClick={() => setConfirmCancel(null)}>No</button>
                </div>
              ) : (
                <button className="btn tiny" onClick={() => setConfirmCancel(p.id)}>Cancel</button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Decision 18: Show education when few protections
  const showEducation = activeProtections.length < 2;

  // Issue 18: Empty state with explanation and CTA
  // Issue 14: Protection tab context header
  return (
    <div className="card">
      <h3>Your Protections</h3>
      <div className="protectionHeaderContext">
        If prices drop sharply, you get paid.
      </div>

      {activeProtections.length === 0 && expiredProtections.length === 0 ? (
        <div className="emptyState">
          <div className="emptyIcon">☂️</div>
          <div className="emptyTitle">No protections yet</div>
          <div className="emptyDescription">
            Protection pays you if an asset's price drops significantly — like insurance for your investments.
          </div>
          {(
            <button className="btn primary" onClick={() => dispatch({ type: 'START_PROTECT' })}>
              Protect an Asset
            </button>
          )}

          {/* Decision 18: Educational content */}
          <div className="protectionEducation">
            <div className="educationDivider" />
            <h4>How Protection Works</h4>
            <p>
              Protection acts like insurance for your assets. If the price drops
              below your protected value, you receive the difference.
            </p>
            <ul className="educationList">
              <li>Choose an asset and protection duration (1-6 months)</li>
              <li>Pay a one-time premium upfront</li>
              <li>If price crashes, you're covered for the loss</li>
              <li>If price stays up, your premium is the only cost</li>
            </ul>
          </div>
        </div>
      ) : (
        <>
          {/* Active protections */}
          {activeProtections.length > 0 && (
            <div className="list">
              {activeProtections.map(p => renderProtectionItem(p, false))}
            </div>
          )}

          {/* No active but has expired */}
          {activeProtections.length === 0 && expiredProtections.length > 0 && (
            <div className="muted" style={{ marginBottom: 12 }}>No active protections.</div>
          )}

          {/* Expired protections section */}
          {expiredProtections.length > 0 && (
            <div className="expiredSection">
              <div className="expiredHeader">
                <span>Expired ({expiredProtections.length})</span>
              </div>
              <div className="list">
                {expiredProtections.map(p => renderProtectionItem(p, true))}
              </div>
            </div>
          )}

          {/* Decision 18: Show education when few active protections */}
          {showEducation && (
            <div className="protectionEducation">
              <div className="educationDivider" />
              <h4>How Protection Works</h4>
              <p>
                Protection acts like insurance for your assets. If the price drops
                below your protected value, you receive the difference.
              </p>
              <ul className="educationList">
                <li>Choose an asset and protection duration (1-6 months)</li>
                <li>Pay a one-time premium upfront</li>
                <li>If price crashes, you're covered for the loss</li>
                <li>If price stays up, your premium is the only cost</li>
              </ul>
              {(
                <button className="btn primary" onClick={() => dispatch({ type: 'START_PROTECT' })}>
                  + Protect an Asset
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default React.memo(Protection);
