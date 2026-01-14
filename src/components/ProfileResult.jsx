import React, { useEffect, useRef } from 'react';
import { getProfileDescription } from '../engine/riskScoring';

/**
 * ProfileResult - Displays risk profile result after questionnaire
 */
function ProfileResult({ result, onContinue }) {
  const containerRef = useRef(null);

  // Auto-scroll to show continue button when component mounts
  useEffect(() => {
    if (containerRef.current) {
      // Small delay to ensure DOM is rendered
      requestAnimationFrame(() => {
        containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, []);
  const {
    score,
    profile,
    profile_fa,
    allocation,
    capacity,
    willingness,
    limitingFactor,
    warnings
  } = result;

  const description = getProfileDescription(score);

  // Determine if we need to show any warnings
  const hasHighSeverityWarning = warnings.some(w => w.severity === 'high');

  return (
    <div className="profile-result" ref={containerRef}>
      {/* Profile Badge */}
      <div className="profile-badge">
        <div className="profile-score">{score}</div>
        <div className="profile-name">{profile}</div>
        <div className="profile-name-fa">{profile_fa}</div>
      </div>

      {/* Description */}
      <div className="profile-description">
        <h3>{description.headline}</h3>
        <p className="headline-fa">{description.headline_fa}</p>
        <p>{description.body}</p>
        <p className="expectation">{description.expectation}</p>
      </div>

      {/* Allocation Preview */}
      <div className="allocation-preview">
        <h4>Your Allocation</h4>
        <div className="allocation-bars">
          <div className="allocation-row">
            <span className="layer-dot foundation"></span>
            <span className="layer-name">Foundation</span>
            <span className="layer-percent">{allocation.FOUNDATION}%</span>
            <div className="layer-bar">
              <div
                className="layer-fill foundation"
                style={{ width: `${allocation.FOUNDATION}%` }}
              />
            </div>
          </div>
          <div className="allocation-row">
            <span className="layer-dot growth"></span>
            <span className="layer-name">Growth</span>
            <span className="layer-percent">{allocation.GROWTH}%</span>
            <div className="layer-bar">
              <div
                className="layer-fill growth"
                style={{ width: `${allocation.GROWTH}%` }}
              />
            </div>
          </div>
          <div className="allocation-row">
            <span className="layer-dot upside"></span>
            <span className="layer-name">Upside</span>
            <span className="layer-percent">{allocation.UPSIDE}%</span>
            <div className="layer-bar">
              <div
                className="layer-fill upside"
                style={{ width: `${allocation.UPSIDE}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Limiting Factor Explanation */}
      <div className="limiting-factor">
        <p className="factor-label">
          {limitingFactor === 'capacity'
            ? 'Your financial situation suggests a more cautious approach.'
            : 'Your comfort with volatility shaped this recommendation.'}
        </p>
      </div>

      {/* Warning (if applicable) */}
      {hasHighSeverityWarning && (
        <div className="profile-warning">
          <span className="warning-icon">!</span>
          <p>
            Based on your answers, we've adjusted your profile to better protect
            your investment during market volatility.
          </p>
        </div>
      )}

      {/* Continue Button */}
      <button className="continue-btn" onClick={onContinue}>
        Continue with this profile
      </button>
    </div>
  );
}

export default React.memo(ProfileResult);
