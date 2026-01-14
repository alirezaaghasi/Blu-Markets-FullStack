import React from 'react';

/**
 * Tabs - Navigation tabs for main portfolio views
 */
const TAB_LABELS = {
  PORTFOLIO: 'Portfolio',
  PROTECTION: 'Protection',
  LOANS: 'Loans',
  HISTORY: 'History',
};

const TAB_IDS = ['PORTFOLIO', 'PROTECTION', 'LOANS', 'HISTORY'];

function Tabs({ tab, dispatch }) {
  return (
    <div className="tabs" style={{ padding: '0 14px 10px' }}>
      {TAB_IDS.map((t) => (
        <div
          key={t}
          className={`tab ${tab === t ? 'active' : ''}`}
          onClick={() => dispatch({ type: 'SET_TAB', tab: t })}
        >
          {TAB_LABELS[t]}
        </div>
      ))}
    </div>
  );
}

export default React.memo(Tabs);
