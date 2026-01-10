import { formatIRR } from '../helpers.js'

export default function Protection({ protections }) {
  const list = protections || [];
  return (
    <div className="card">
      <h3>Protection</h3>
      {list.length === 0 ? (
        <div className="muted">No assets protected yet.</div>
      ) : (
        <div className="list">
          {list.map((p, idx) => (
            <div key={p.assetId + '|' + idx} className="item">
              <div style={{ flex: 1 }}>
                <div className="asset">{p.assetId}</div>
                <div className="muted">Protected until {p.protectedUntil}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="asset">{formatIRR(p.premiumIRR)}</div>
                <div className="muted">Premium</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
