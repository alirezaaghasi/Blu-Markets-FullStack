import React from 'react';
import { LAYERS } from '../constants/index.js';

/**
 * DonutChart - Allocation visualization component
 * Decision 19: Uses blue opacity system matching layer dots
 */
function DonutChart({ layers, size = 160 }) {
  const total = (layers?.FOUNDATION || 0) + (layers?.GROWTH || 0) + (layers?.UPSIDE || 0);
  if (total === 0) return null;

  // Decision 19: Blue with varying opacity (100%, 60%, 30%)
  const colors = {
    FOUNDATION: '#3B82F6',              // Blue 100%
    GROWTH: 'rgba(59, 130, 246, 0.6)',  // Blue 60%
    UPSIDE: 'rgba(59, 130, 246, 0.3)',  // Blue 30%
  };

  const radius = 50;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;
  const segments = [];

  LAYERS.forEach((layer) => {
    const pct = (layers[layer] || 0) / total;
    const length = pct * circumference;

    if (pct > 0) {
      segments.push({
        layer,
        color: colors[layer],
        dasharray: `${length} ${circumference - length}`,
        offset: -currentOffset + circumference * 0.25,
      });
      currentOffset += length;
    }
  });

  return (
    <div className="donutChartContainer">
      <svg viewBox="0 0 120 120" width={size} height={size} className="donutChart">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--border)" strokeWidth="12" />
        {segments.map((seg) => (
          <circle
            key={seg.layer}
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth="12"
            strokeDasharray={seg.dasharray}
            strokeDashoffset={seg.offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.3s ease' }}
          />
        ))}
        <text x="60" y="56" textAnchor="middle" className="donutCenterLabel">Your</text>
        <text x="60" y="72" textAnchor="middle" className="donutCenterLabel">Allocation</text>
      </svg>
    </div>
  );
}

export default React.memo(DonutChart);
