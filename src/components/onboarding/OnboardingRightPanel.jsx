import React from 'react';
import { STAGES, LAYER_EXPLANATIONS, THRESHOLDS, LAYERS } from '../../constants/index';
import { formatIRR } from '../../helpers';
import DonutChart from '../DonutChart.jsx';

/**
 * OnboardingRightPanel - Right panel content during onboarding stages
 * Shows welcome, progress, allocation preview based on stage
 */
function OnboardingRightPanel({ stage, questionIndex, targetLayers, investAmount, dispatch, questionnaireLength }) {
  if (stage === STAGES.WELCOME) {
    return (
      <div className="welcomeScreen">
        <div className="welcomeLogo">B</div>
        <h1 className="welcomeTitle">Welcome</h1>
        <p className="welcomeMotto">Markets, but mindful.</p>
        <div className="welcomeValues">
          <p>Your decisions matter here.</p>
          <p>Build wealth without losing control.</p>
          <p>Take risk without risking everything.</p>
        </div>
        <button className="btn primary welcomeCta" onClick={() => dispatch({ type: 'START_ONBOARDING' })}>
          Continue
        </button>
      </div>
    );
  }

  if (stage === STAGES.ONBOARDING_PHONE) {
    return (
      <div className="onboardingPanel">
        <div className="welcomeCard">
          <div className="welcomeIcon">🏦</div>
          <h2>Let's get started</h2>
          <p>Enter your phone number to begin.</p>
        </div>
      </div>
    );
  }

  if (stage === STAGES.ONBOARDING_QUESTIONNAIRE) {
    const totalQuestions = questionnaireLength || 5;
    // Use 1-based question number, clamped to totalQuestions
    const currentQuestionNumber = Math.min(questionIndex + 1, totalQuestions);
    const progress = (currentQuestionNumber / totalQuestions) * 100;

    return (
      <div className="onboardingPanel">
        <div className="progressCard">
          <h3>Building Your Profile</h3>
          <div className="bigProgress">
            <svg viewBox="0 0 100 100" className="progressRing">
              <circle cx="50" cy="50" r="45" fill="none" stroke="var(--border)" strokeWidth="6" />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="6"
                strokeDasharray={`${progress * 2.83} 283`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="progressText">{currentQuestionNumber}/{totalQuestions}</div>
          </div>
        </div>
        <div className="layerPreviewCard">
          <h4>The Three Layers</h4>
          {/* Issue 13: Two-line layer descriptions with tagline */}
          {LAYERS.map(layer => {
            const info = LAYER_EXPLANATIONS[layer];
            return (
              <div key={layer} className="layerPreviewRow">
                <span className={`layerDot ${layer.toLowerCase()}`} style={{ marginTop: 4 }}></span>
                <div>
                  <div className="layerPreviewName">{info.name}</div>
                  <div className="layerPreviewTagline">{info.tagline}</div>
                  <div className="layerPreviewDesc">{info.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (stage === STAGES.ONBOARDING_RESULT) {
    return (
      <div className="onboardingPanel">
        <div className="allocationPreviewCard">
          <DonutChart layers={targetLayers} size={140} />

          <div className="allocationLegend">
            {LAYERS.map((layer) => {
              const info = LAYER_EXPLANATIONS[layer];
              const pct = targetLayers?.[layer] || 0;
              return (
                <div key={layer} className="legendRow">
                  <div className="legendLeft">
                    <span className={`layerDot ${layer.toLowerCase()}`}></span>
                    <span className="legendName">{info.name}</span>
                  </div>
                  <span className="legendPct">{pct}%</span>
                </div>
              );
            })}
          </div>

          <div className="allocationAssets">
            {LAYERS.map((layer) => {
              const info = LAYER_EXPLANATIONS[layer];
              return (
                <div key={layer} className="assetRow">
                  <span className={`layerDot ${layer.toLowerCase()}`}></span>
                  <span className="assetList">{info.assets.join(' · ')}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (stage === STAGES.AMOUNT_REQUIRED) {
    const amount = Number(investAmount) || 0;
    const isValid = amount >= THRESHOLDS.MIN_AMOUNT_IRR;
    const hasInput = amount > 0;

    return (
      <div className="onboardingPanel">
        <div className="investPreviewCard">
          <h3>INVESTMENT PREVIEW</h3>

          {!hasInput ? (
            <div className="previewPlaceholder">
              <div className="placeholderTotal">
                <div className="placeholderValue">--- IRR</div>
                <div className="placeholderLabel">Your portfolio value</div>
              </div>

              <div className="placeholderBreakdown">
                {LAYERS.map((layer) => {
                  const info = LAYER_EXPLANATIONS[layer];
                  return (
                    <div key={layer} className="placeholderRow">
                      <div className="placeholderLeft">
                        <span className={`layerDot ${layer.toLowerCase()} faded`}></span>
                        <span className="placeholderName">{info.name}</span>
                      </div>
                      <span className="placeholderAmount">---</span>
                    </div>
                  );
                })}
              </div>

              <div className="placeholderHint">
                Select an amount to see your allocation
              </div>
            </div>
          ) : (
            <>
              <div className="investTotal">
                <div className="portfolioValue">{formatIRR(amount)}</div>
                {!isValid && <div className="investWarning">Minimum: {formatIRR(THRESHOLDS.MIN_AMOUNT_IRR)}</div>}
              </div>
              {isValid && (
                <>
                  <div className="investPreviewDonut">
                    <DonutChart layers={targetLayers} size={100} />
                  </div>
                  <div className="investBreakdown">
                    {LAYERS.map((layer) => {
                      const info = LAYER_EXPLANATIONS[layer];
                      const pct = targetLayers?.[layer] || 0;
                      const layerAmount = Math.floor(amount * pct / 100);
                      return (
                        <div key={layer} className="breakdownRow">
                          <div className="breakdownLeft">
                            <span className={`layerDot ${layer.toLowerCase()}`}></span>
                            <span>{info.name}</span>
                          </div>
                          <span className="breakdownAmount">{formatIRR(layerAmount)}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export default React.memo(OnboardingRightPanel);
