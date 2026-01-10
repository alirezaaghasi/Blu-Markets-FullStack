import { formatLedgerEntry, getLedgerStats } from '../ledger.js';

export default function Ledger({ ledger }) {
  if (!ledger || ledger.length === 0) {
    return (
      <div className="card">
        <h3>Event Ledger</h3>
        <div className="muted">No actions recorded yet. Start trading to see your history.</div>
      </div>
    );
  }

  const stats = getLedgerStats(ledger);
  const recent = [...ledger].reverse().slice(0, 10); // Show last 10

  return (
    <div>
      <div className="card">
        <h3>Event Ledger</h3>
        <div className="muted" style={{ marginBottom: 12 }}>
          Immutable record of all portfolio actions.
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <StatBadge label="Total" value={stats.totalActions} />
          {stats.byBoundary.STRUCTURAL > 0 && (
            <StatBadge label="Structural" value={stats.byBoundary.STRUCTURAL} color="#ffd93d" />
          )}
          {stats.byBoundary.STRESS > 0 && (
            <StatBadge label="Stress" value={stats.byBoundary.STRESS} color="#ff6b6b" />
          )}
        </div>

        <div className="list">
          {recent.map(entry => {
            const formatted = formatLedgerEntry(entry);
            return (
              <LedgerRow key={entry.id} entry={entry} formatted={formatted} />
            );
          })}
        </div>

        {ledger.length > 10 && (
          <div className="muted" style={{ marginTop: 10, textAlign: 'center' }}>
            Showing last 10 of {ledger.length} events
          </div>
        )}
      </div>
    </div>
  );
}

function StatBadge({ label, value, color = 'var(--accent)' }) {
  return (
    <div style={{
      padding: '6px 10px',
      borderRadius: 8,
      background: `${color}20`,
      border: `1px solid ${color}40`,
      fontSize: 12,
    }}>
      <span style={{ color: 'var(--muted)' }}>{label}: </span>
      <span style={{ fontWeight: 900, color }}>{value}</span>
    </div>
  );
}

function LedgerRow({ entry, formatted }) {
  const levelColors = {
    SAFE: '#6bcb77',
    DRIFT: '#4f7cff',
    STRUCTURAL: '#ffd93d',
    STRESS: '#ff6b6b',
  };

  const color = levelColors[entry.boundaryLevel] || 'var(--muted)';

  return (
    <div className="item" style={{ padding: 10 }}>
      <div>
        <div style={{ fontWeight: 900, fontSize: 13 }}>{formatted.label}</div>
        {formatted.detail && (
          <div className="muted" style={{ fontSize: 12 }}>{formatted.detail}</div>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        <div className="muted" style={{ fontSize: 11 }}>{formatted.time}</div>
        {entry.boundaryLevel && (
          <div style={{
            fontSize: 10,
            color,
            fontWeight: 900,
            textTransform: 'uppercase',
          }}>
            {entry.boundaryLevel}
          </div>
        )}
      </div>
    </div>
  );
}
