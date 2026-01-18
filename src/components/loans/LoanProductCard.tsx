import React from 'react';
import type { Layer } from '../../types';

interface LoanProductCardProps {
  layer: Layer;
  maxLtv: number;
  apr: number;
  assets: string[];
  onSelect: () => void;
}

const LAYER_CONFIG = {
  FOUNDATION: { icon: '🛡️', name: 'Foundation Assets' },
  GROWTH: { icon: '📈', name: 'Growth Assets' },
  UPSIDE: { icon: '🚀', name: 'Upside Assets' },
};

function LoanProductCard({ layer, maxLtv, apr, assets, onSelect }: LoanProductCardProps) {
  const config = LAYER_CONFIG[layer];

  return (
    <div className="loanProductCard" onClick={onSelect}>
      <div className="productHeader">
        <div className="productLayerInfo">
          <span className="productLayerIcon">{config.icon}</span>
          <div>
            <div className="productLayerName">{config.name}</div>
            <div className="productAssets">{assets.join(', ')}</div>
          </div>
        </div>
        <div className="productLtv">Up to {maxLtv}%</div>
      </div>
      <div className="productFooter">
        <span className="productBadge">No guarantor</span>
        <span className="productApr">{apr}% APR</span>
      </div>
    </div>
  );
}

export default LoanProductCard;
