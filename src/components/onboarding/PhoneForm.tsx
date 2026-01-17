import React, { Dispatch } from 'react';
import type { AppState, AppAction } from '../../types';

interface PhoneFormProps {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}

/**
 * PhoneForm - Phone number input during onboarding
 * Validates Iranian phone number format (+989XXXXXXXXX)
 */
function PhoneForm({ state, dispatch }: PhoneFormProps) {
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
      {state.phone && !isValid && <div className="validationError">Enter a valid Iranian mobile number (+989...)</div>}
    </div>
  );
}

export default React.memo(PhoneForm);
