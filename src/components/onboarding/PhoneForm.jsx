import React from 'react';

/**
 * PhoneForm - Phone number input during onboarding
 * Validates Iranian phone number format (+989XXXXXXXXX)
 */
function PhoneForm({ state, dispatch }) {
  const isValid = (state.phone || '').startsWith('+989') && (state.phone || '').length === 13;

  return (
    <div>
      <div className="muted" style={{ marginBottom: 10 }}>Sign in</div>
      <div className="row">
        <input
          className="input"
          type="tel"
          placeholder="+989XXXXXXXXX"
          value={state.phone || ''}
          onChange={(e) => dispatch({ type: 'SET_PHONE', phone: e.target.value })}
        />
        <button
          className="btn primary"
          onClick={() => dispatch({ type: 'SUBMIT_PHONE' })}
          disabled={!isValid}
        >
          Continue
        </button>
      </div>
      {state.phone && !isValid && <div className="validationError">+989XXXXXXXXX</div>}
    </div>
  );
}

export default React.memo(PhoneForm);
