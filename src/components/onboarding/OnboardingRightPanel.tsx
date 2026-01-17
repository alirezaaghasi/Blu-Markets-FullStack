import React, { Dispatch } from 'react';
import { STAGES, LAYER_EXPLANATIONS, THRESHOLDS, LAYERS } from '../../constants/index';
import { formatIRR, formatIRRShort } from '../../helpers';
import DonutChart from '../DonutChart';
import type { TargetLayerPct, Layer, AppAction } from '../../types';

// Task 3: Question-to-layer highlighting map
const LAYER_HIGHLIGHT_MAP: Record<number, string[]> = {
  0: ['FOUNDATION', 'GROWTH', 'UPSIDE'], // q_income - all layers
  1: ['FOUNDATION'],                      // q_buffer - Foundation
  2: ['FOUNDATION'],                      // q_proportion - Foundation
  3: ['GROWTH'],                          // q_goal - Growth
  4: ['GROWTH'],                          // q_horizon - Growth
  5: ['FOUNDATION', 'GROWTH', 'UPSIDE'], // q_crash_20 - gradient
  6: ['UPSIDE'],                          // q_tradeoff - Upside
  7: ['UPSIDE'],                          // q_past_behavior - Upside
  8: ['FOUNDATION', 'GROWTH', 'UPSIDE'], // q_max_loss - gradient
};

// Questions that show gradient highlighting (risk questions)
const GRADIENT_QUESTIONS = [5, 8];

interface OnboardingRightPanelProps {
  stage: string;
  questionIndex: number;
  targetLayers: TargetLayerPct;
  investAmount: number;
  dispatch: Dispatch<AppAction>;
  questionnaireLength: number;
}

/**
 * OnboardingRightPanel - Right panel content during onboarding stages
 * Shows welcome, progress, allocation preview based on stage
 */
function OnboardingRightPanel({ stage, questionIndex, targetLayers, investAmount, dispatch, questionnaireLength }: OnboardingRightPanelProps) {
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

    // Task 3: Get highlighted layers for current question
    const highlightedLayers = LAYER_HIGHLIGHT_MAP[questionIndex] || ['FOUNDATION', 'GROWTH', 'UPSIDE'];
    const isGradient = GRADIENT_QUESTIONS.includes(questionIndex);

    // Gradient colors for risk questions
    const gradientColors: Record<string, string> = {
      FOUNDATION: '#22c55e', // green - safe
      GROWTH: '#eab308',     // yellow - moderate
      UPSIDE: '#ef4444',     // red - risky
    };

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
          {/* Task 3: Contextual layer highlighting */}
          {(LAYERS as Layer[]).map((layer: Layer) => {
            const info = (LAYER_EXPLANATIONS as Record<Layer, { name: string; tagline: string; description: string }>)[layer];
            const isHighlighted = highlightedLayers.includes(layer);
            const borderColor = isGradient && isHighlighted ? gradientColors[layer] : undefined;

            return (
              <div
                key={layer}
                className={`layerPreviewRow ${isHighlighted ? 'layer-highlighted' : 'layer-dimmed'}`}
                style={borderColor ? { borderLeftColor: borderColor } : undefined}
              >
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
            {(LAYERS as Layer[]).map((layer: Layer) => {
              const info = (LAYER_EXPLANATIONS as Record<Layer, { name: string }>)[layer];
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
            {(LAYERS as Layer[]).map((layer: Layer) => {
              const info = (LAYER_EXPLANATIONS as Record<Layer, { name: string; assets: string[] }>)[layer];
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
                {(LAYERS as Layer[]).map((layer: Layer) => {
                  const info = (LAYER_EXPLANATIONS as Record<Layer, { name: string }>)[layer];
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
                    {(LAYERS as Layer[]).map((layer: Layer) => {
                      const info = (LAYER_EXPLANATIONS as Record<Layer, { name: string }>)[layer];
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

  // Task 1: Portfolio Created Summary Screen
  if (stage === STAGES.PORTFOLIO_CREATED) {
    const amount = Number(investAmount) || 0;

    return (
      <div className="onboardingPanel">
        <div className="portfolioCreatedCard">
          {/* Success checkmark */}
          <div className="successCheck">✓</div>

          <h2 className="createdTitle">Portfolio Created</h2>

          <div className="createdTotal">
            You invested <strong>{formatIRRShort(amount)} IRR</strong>
          </div>

          {/* Layer breakdown */}
          <div className="createdBreakdown">
            {(LAYERS as Layer[]).map((layer: Layer) => {
              const info = (LAYER_EXPLANATIONS as Record<Layer, { name: string; assets: string[] }>)[layer];
              const pct = targetLayers?.[layer] || 0;
              const layerAmount = Math.floor(amount * pct / 100);

              return (
                <div key={layer} className="createdLayerRow">
                  <div className="createdLayerHeader">
                    <div className="createdLayerLeft">
                      <span className={`layerDot ${layer.toLowerCase()}`}></span>
                      <span className="createdLayerName">{info.name} ({pct}%)</span>
                    </div>
                    <span className="createdLayerAmount">{formatIRRShort(layerAmount)} IRR</span>
                  </div>
                  <div className="createdLayerAssets">
                    {info.assets.join(', ')}
                  </div>
                </div>
              );
            })}
          </div>

          {/* CTA Button */}
          <button
            className="btn primary createdCta"
            onClick={() => dispatch({ type: 'GO_TO_DASHBOARD' })}
          >
            Go to My Portfolio
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default React.memo(OnboardingRightPanel);
