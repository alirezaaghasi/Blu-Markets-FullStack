import React, { useEffect, useMemo, useReducer } from 'react'
import { initialState, reduce, STAGES } from './stateMachine.js'
import MessagesPane from './components/MessagesPane.jsx'
import OnboardingControls from './components/OnboardingControls.jsx'
import Tabs from './components/Tabs.jsx'
import PortfolioHome from './components/PortfolioHome.jsx'
import Protection from './components/Protection.jsx'
import Loans from './components/Loans.jsx'

const STORAGE_KEY = 'blu_markets_v7_5_state';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function App() {
  const [state, dispatch] = useReducer(reduce, null, () => load() || initialState());

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  const stepLabel = useMemo(() => {
    const stage = state.user.stage;
    const map = {
      [STAGES.PHONE_REQUIRED]: { idx: 1, name: 'Phone' },
      [STAGES.QUESTIONNAIRE]: { idx: 2, name: 'Questionnaire' },
      [STAGES.ALLOCATION_PROPOSED]: { idx: 3, name: 'Allocation' },
      [STAGES.AMOUNT_REQUIRED]: { idx: 4, name: 'Amount' },
      [STAGES.EXECUTED]: { idx: 5, name: 'Done' },
    };
    const x = map[stage] || { idx: 0, name: stage };
    return `Step ${x.idx} of 5 — ${x.name}`;
  }, [state.user.stage]);

    const onStartTrade = (assetId, side) => dispatch({ type: 'START_TRADE', assetId, side });
  const onStartProtect = (assetId) => dispatch({ type: 'START_PROTECT', assetId });
  const onStartBorrow = (assetId) => dispatch({ type: 'START_BORROW', assetId });

  const right = useMemo(() => {
    if (state.tab === 'PROTECTION') return <Protection protections={state.protections} />
    if (state.tab === 'LOANS') return <Loans loan={state.loan} />
    return (
      <PortfolioHome
        portfolio={state.portfolio}
        cashIRR={state.cashIRR}
        targetLayers={state.targetLayers}
        onStartTrade={onStartTrade}
        onStartProtect={onStartProtect}
        onStartBorrow={onStartBorrow}
        onAddFunds={() => dispatch({ type: 'START_ADD_FUNDS' })}
      />
    );
  }, [state.tab, state.portfolio, state.cashIRR, state.targetLayers, state.protections, state.loan]);

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  };

  return (
    <div className="container">
      <div className="panel">
        <div className="header">
          <div className="logo">B</div>
          <div style={{ flex: 1 }}>
            <div className="h-title">Blu Markets</div>
            <div className="h-sub">{stepLabel}</div>
          </div>
          <div className="rightMeta">
            <div className="pill">{state.user.phone || 'Not signed in'}</div>
            <div className="pill">{state.user.stage}</div>
          </div>
        </div>

        <div className="body">
          <MessagesPane messages={state.messages} />
        </div>

        <div className="footer">
          <OnboardingControls state={state} dispatch={dispatch} onReset={reset} />
        </div>
      </div>

      <div className="panel">
        <div className="header">
          <div style={{ flex: 1 }}>
            <div className="h-title">Portfolio Home</div>
            <div className="h-sub">Calm ownership. No market noise.</div>
          </div>
        </div>

        <div className="body">
          <Tabs tab={state.tab} dispatch={dispatch} />
          <div style={{ marginTop: 12 }}>
            {right}
          </div>
        </div>
      </div>
    </div>
  );
}
