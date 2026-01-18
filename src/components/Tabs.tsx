import React, { useCallback } from 'react';
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

// Preload functions for lazy-loaded tab components
// Called on hover to eliminate network delay on click
const preloadFunctions: Record<TabId, () => void> = {
  PORTFOLIO: () => import('./PortfolioHome'),
  PROTECTION: () => import('./Protection'),
  LOANS: () => import('./loans/LoansTab'),
  HISTORY: () => import('./HistoryPane'),
};

// Track which tabs have been preloaded to avoid duplicate imports
const preloadedTabs = new Set<TabId>();

function Tabs({ tab, dispatch }: TabsProps): React.ReactElement {
  // Preload chunk on hover (only once per tab)
  const handleMouseEnter = useCallback((tabId: TabId) => {
    if (!preloadedTabs.has(tabId)) {
      preloadedTabs.add(tabId);
      preloadFunctions[tabId]();
    }
  }, []);

  return (
    <div className="tabs" style={{ padding: '0 14px 10px' }}>
      {TAB_IDS.map((t) => (
        <div
          key={t}
          className={`tab ${tab === t ? 'active' : ''}`}
          onClick={() => dispatch({ type: 'SET_TAB', tab: t })}
          onMouseEnter={() => handleMouseEnter(t)}
        >
          {TAB_LABELS[t]}
        </div>
      ))}
    </div>
  );
}

export default React.memo(Tabs);
