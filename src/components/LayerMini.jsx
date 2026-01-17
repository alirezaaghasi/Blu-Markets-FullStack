import React from 'react';
import { LAYER_EXPLANATIONS } from '../constants/index';

/**
 * LayerMini - Compact layer percentage card
 * Shows current vs target allocation for a layer
 */
function LayerMini({ layer, pct, target }) {
  const info = LAYER_EXPLANATIONS[layer];

  return (
    <div className="mini">
      <div className="layerHeader">
        <span className="tag">{info.name}</span>
      </div>
      <div className="big" style={{ fontSize: 20 }}>{Math.round(pct)}%</div>
      <div className="muted">Target {target}%</div>
    </div>
  );
}

export default React.memo(LayerMini);
