import { formatIRR } from '../helpers.js'
import { calcLayerPercents } from '../engine.js'

function LayerMini({ name, pct, target }) {
  return (
    <div className="mini">
      <div className="tag">{name}</div>
      <div className="big" style={{ fontSize: 20 }}>{pct}%</div>
      <div className="muted">Target {target}%</div>
    </div>
  );
}

export default function PortfolioHome({ portfolio, cashIRR, targetLayers, onStartTrade, onStartProtect, onStartBorrow, onAddFunds }) {
  if (!portfolio) {
    return (
      <div className="card">
        <h3>Portfolio Home</h3>
        <div className="muted">Complete onboarding to create your portfolio.</div>
      </div>
    );
  }

  const exposure = calcLayerPercents(portfolio.holdings, cashIRR || 0);
  const total = exposure.totalIRR;

  return (
    <div className="stack">
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="muted">Total value</div>
            <div className="big">{formatIRR(total)}</div>
            <div className="muted">Currency: IRR</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="muted">Cash</div>
            <div className="big" style={{ fontSize: 22 }}>{formatIRR(cashIRR || 0)}</div>
                        <div className="muted">Available for Buy / Protect</div>
            <div style={{ marginTop: 10 }}>
              <button className="btn" onClick={onAddFunds}>Add funds</button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Allocation (Now vs Target)</h3>
        <div className="grid3">
          <LayerMini name="Foundation" pct={exposure.pct.foundation} target={targetLayers?.foundation ?? '-'} />
          <LayerMini name="Growth" pct={exposure.pct.growth} target={targetLayers?.growth ?? '-'} />
          <LayerMini name="Upside" pct={exposure.pct.upside} target={targetLayers?.upside ?? '-'} />
        </div>
      </div>

      <div className="card">
        <h3>Holdings</h3>
        <div className="list">
          {portfolio.holdings.map((h) => (
            <div key={h.asset} className="item" style={{ alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div className="asset">{h.asset}</div>
                <div className="muted">{h.layer.toUpperCase()}{h.frozen ? ' · Frozen' : ''}</div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 150 }}>
                <div className="asset">{formatIRR(h.amountIRR)}</div>
                <div className="row" style={{ justifyContent: 'flex-end', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <button className="btn tiny" onClick={() => onStartTrade(h.asset, 'BUY')}>Buy</button>
                  <button
                    className={'btn tiny ' + (h.frozen ? 'disabled' : '')}
                    disabled={h.frozen}
                    title={h.frozen ? 'Frozen as collateral' : ''}
                    onClick={() => onStartTrade(h.asset, 'SELL')}
                  >
                    Sell
                  </button>
                  <button className="btn tiny" onClick={() => onStartProtect?.(h.asset)}>Protect</button>
                  <button
                    className={'btn tiny ' + (h.frozen ? 'disabled' : '')}
                    disabled={h.frozen}
                    title={h.frozen ? 'Frozen as collateral' : ''}
                    onClick={() => onStartBorrow?.(h.asset)}
                  >
                    Borrow
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="muted" style={{ marginTop: 8 }}>
          Tip: Buy uses cash. If cash is 0, add funds first.
        </div>
      </div>
    </div>
  );
}
