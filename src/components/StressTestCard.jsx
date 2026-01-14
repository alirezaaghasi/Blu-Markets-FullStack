import React, { useState, useMemo } from 'react';
import { formatIRR } from '../helpers.js';

/**
 * StressTestCard - Simulate market crash scenarios
 * Decision 17: Moved from header toggle to dedicated card
 */
function StressTestCard({ snapshot, loans }) {
  const [selectedDrop, setSelectedDrop] = useState(null);

  const scenarios = [
    { id: 20, label: '20% drop', description: 'Moderate correction' },
    { id: 30, label: '30% drop', description: 'Significant crash' },
    { id: 50, label: '50% drop', description: 'Severe bear market' },
  ];

  // Calculate stress test result
  const result = useMemo(() => {
    if (selectedDrop === null || !snapshot) return null;

    const dropFactor = 1 - (selectedDrop / 100);
    // Holdings affected by market drop (cash not affected)
    const holdingsAfter = snapshot.holdingsIRR * dropFactor;
    const totalAfter = holdingsAfter + snapshot.cashIRR;
    const loss = snapshot.totalIRR - totalAfter;

    // Check loans at risk
    let loansAtRisk = 0;
    for (const loan of loans || []) {
      const ltvRatio = loan.amountIRR / loan.liquidationIRR;
      // If current LTV is above threshold, the drop would trigger liquidation
      if (ltvRatio * dropFactor >= 0.8) {
        loansAtRisk++;
      }
    }

    return {
      currentValue: snapshot.totalIRR,
      afterValue: totalAfter,
      loss,
      lossPercent: Math.round((loss / snapshot.totalIRR) * 100),
      loansAtRisk
    };
  }, [selectedDrop, snapshot, loans]);

  const handleScenarioClick = (dropPercent) => {
    setSelectedDrop(selectedDrop === dropPercent ? null : dropPercent);
  };

  return (
    <div className="card stressTestCard">
      <div className="stressTestHeader">
        <h3>Stress Test</h3>
        <p className="stressTestSubtitle">
          See how your portfolio handles a market crash
        </p>
      </div>

      <div className="stressTestScenarios">
        {scenarios.map(scenario => (
          <button
            key={scenario.id}
            className={`stressTestBtn ${selectedDrop === scenario.id ? 'active' : ''}`}
            onClick={() => handleScenarioClick(scenario.id)}
          >
            <span className="stressTestBtnLabel">{scenario.label}</span>
            <span className="stressTestBtnDesc">{scenario.description}</span>
          </button>
        ))}
      </div>

      {result && (
        <div className="stressTestResult">
          <div className="stressTestResultRow">
            <span>Current value:</span>
            <span>{formatIRR(result.currentValue)}</span>
          </div>
          <div className="stressTestResultRow">
            <span>After {selectedDrop}% drop:</span>
            <span className="stressTestAfter">{formatIRR(result.afterValue)}</span>
          </div>
          <div className="stressTestResultRow loss">
            <span>Potential loss:</span>
            <span className="stressTestLoss">-{formatIRR(result.loss)} ({result.lossPercent}%)</span>
          </div>

          {result.loansAtRisk > 0 && (
            <div className="stressTestWarning">
              <span className="warningIcon">⚠</span>
              <span>{result.loansAtRisk} loan{result.loansAtRisk > 1 ? 's' : ''} may face liquidation in this scenario</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default React.memo(StressTestCard);
