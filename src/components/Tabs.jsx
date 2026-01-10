export default function Tabs({ tab, dispatch }) {
  const tabs = [
    { id: 'PORTFOLIO', label: 'Portfolio' },
    { id: 'PROTECTION', label: 'Protection' },
    { id: 'LOANS', label: 'Loans' },
  ];

  return (
    <div className="tabs">
      {tabs.map(t => (
        <button
          key={t.id}
          className={'tab ' + (tab === t.id ? 'active' : '')}
          onClick={() => dispatch({ type: 'SET_TAB', tab: t.id })}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
