import React from 'react';
import type { TabId, AppAction } from '../types';

interface TabsProps {
  tab: TabId;
  dispatch: React.Dispatch<AppAction>;
}

/**
 * Tabs - Navigation tabs for main portfolio views
 */
const TAB_LABELS: Record<TabId, string> = {
  PORTFOLIO: 'Portfolio',
  PROTECTION: 'Protection',
  LOANS: 'Loans',
  HISTORY: 'History',
};

const TAB_IDS: TabId[] = ['PORTFOLIO', 'PROTECTION', 'LOANS', 'HISTORY'];

function Tabs({ tab, dispatch }: TabsProps): React.ReactElement {
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
