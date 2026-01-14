import React from 'react';
import { computePortfolioStatus } from '../engine/portfolioStatus.js';
import { PORTFOLIO_STATUS_LABELS } from '../constants/index.js';

/**
 * PortfolioHealthBadge - Shows portfolio health status badge
 * Colors: green (balanced), yellow (slightly off), red (attention required)
 */
function PortfolioHealthBadge({ snapshot }) {
  if (!snapshot) return null;

  const { status } = computePortfolioStatus(snapshot.layerPct);

  const colorMap = {
    BALANCED: { bg: 'rgba(34,197,94,.15)', border: 'rgba(34,197,94,.3)', color: '#4ade80' },
    SLIGHTLY_OFF: { bg: 'rgba(250,204,21,.15)', border: 'rgba(250,204,21,.3)', color: '#fde047' },
    ATTENTION_REQUIRED: { bg: 'rgba(239,68,68,.15)', border: 'rgba(239,68,68,.3)', color: '#f87171' },
  };

  const colors = colorMap[status] || colorMap.BALANCED;

  return (
    <div
      className="healthBadge"
      style={{ background: colors.bg, borderColor: colors.border, color: colors.color }}
    >
      {PORTFOLIO_STATUS_LABELS[status]}
    </div>
  );
}

export default React.memo(PortfolioHealthBadge);
