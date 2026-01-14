import React from 'react';
import { PORTFOLIO_STATUS_LABELS } from '../constants/index.js';

// Module-level constant to avoid recreation on every render
const COLOR_MAP = {
  BALANCED: { bg: 'rgba(34,197,94,.15)', border: 'rgba(34,197,94,.3)', color: '#4ade80' },
  SLIGHTLY_OFF: { bg: 'rgba(250,204,21,.15)', border: 'rgba(250,204,21,.3)', color: '#fde047' },
  ATTENTION_REQUIRED: { bg: 'rgba(239,68,68,.15)', border: 'rgba(239,68,68,.3)', color: '#f87171' },
};

/**
 * PortfolioHealthBadge - Shows portfolio health status badge
 * Colors: green (balanced), yellow (slightly off), red (attention required)
 * Now accepts pre-computed status to avoid duplicate calculation
 */
function PortfolioHealthBadge({ status }) {
  if (!status) return null;

  const colors = COLOR_MAP[status] || COLOR_MAP.BALANCED;

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
