import React, { useState } from 'react';
import { formatIRR, getAssetDisplayName } from '../helpers.js';
import { ASSET_LAYER } from '../state/domain.js';
import { LAYER_EXPLANATIONS } from '../constants/index.js';

/**
 * Protection - Active protections list with progress bars
 * Shows protection status, premium paid, days remaining
 * Supports cancel and handles expiration
 */
function Protection({ protections, dispatch }) {
  const [confirmCancel, setConfirmCancel] = useState(null);
  const list = protections || [];

  const getDaysRemaining = (endISO) => {
    const now = Date.now();
    const until = new Date(endISO).getTime();
    return Math.ceil((until - now) / (1000 * 60 * 60 * 24));
  };

  const getProgressPct = (startISO, endISO) => {
    const now = Date.now();
    const start = new Date(startISO).getTime();
    const end = new Date(endISO).getTime();
    const totalDuration = end - start;
    const elapsed = now - start;
    const remaining = Math.max(0, 100 - (elapsed / totalDuration) * 100);
    return Math.min(100, Math.max(0, remaining));
  };

  const isExpired = (endISO) => {
    return new Date(endISO).getTime() < Date.now();
  };

  // Separate active and expired protections
  const activeProtections = list.filter(p => !isExpired(p.endISO));
  const expiredProtections = list.filter(p => isExpired(p.endISO));

  const handleCancel = (protectionId) => {
    dispatch({ type: 'CANCEL_PROTECTION', protectionId });
    setConfirmCancel(null);
  };

  const renderProtectionItem = (p, isExpiredItem = false) => {
    const layer = ASSET_LAYER[p.assetId];
    const info = LAYER_EXPLANATIONS[layer];
    const daysLeft = getDaysRemaining(p.endISO);
    const progressPct = getProgressPct(p.startISO || p.tsISO, p.endISO);

    return (
      <div key={p.id} className={`item protectionItem ${isExpiredItem ? 'expired' : ''}`}>
        <div style={{ flex: 1 }}>
          <div className="asset">
            {isExpiredItem ? '⏱️' : '☂️'} {getAssetDisplayName(p.assetId)}
            {isExpiredItem && <span className="expiredBadge">Expired</span>}
          </div>
          <div className="muted">
            <span className={`layerDot ${layer.toLowerCase()}`} style={{ marginRight: 6 }}></span>
            {info?.name}
            {p.durationMonths && ` · ${p.durationMonths}mo coverage`}
          </div>

          {/* Progress bar for active protections */}
          {!isExpiredItem && (
            <div className="protectionProgress">
              <div className="protectionProgressBar">
                <div className="protectionProgressFill" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="protectionProgressText">
                <span>{daysLeft} days remaining</span>
                <span>{Math.round(progressPct)}% left</span>
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
          {!isExpiredItem && dispatch && (
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
          {dispatch && (
            <button className="btn primary" onClick={() => dispatch({ type: 'START_PROTECT' })}>
              Protect an Asset
            </button>
          )}
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
        </>
      )}
    </div>
  );
}

export default React.memo(Protection);
