import { formatIRR } from '../helpers.js'

export default function Loans({ loan }) {
  return (
    <div className="card">
      <h3>Loans</h3>
      {!loan ? (
        <div className="muted">No active loans.</div>
      ) : (
        <div className="list">
          <div className="item">
            <div style={{ flex: 1 }}>
              <div className="asset">{formatIRR(loan.amountIRR)}</div>
              <div className="muted">Collateral: {loan.collateralAssetId} · LTV {Math.round(loan.ltv * 100)}%</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="asset">{formatIRR(loan.liquidationIRR)}</div>
              <div className="muted">Indicative liquidation</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
