// Onboarding Slice
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { OnboardingState, OnboardingStep, RiskProfile } from '../../types';

const initialState: OnboardingState = {
  step: 'WELCOME',
  phone: '',
  answers: {},
  riskProfile: null,
  consents: {
    riskAcknowledged: false,
    lossAcknowledged: false,
    noGuaranteeAcknowledged: false,
  },
  initialInvestment: 0,
};

const onboardingSlice = createSlice({
  name: 'onboarding',
  initialState,
  reducers: {
    setStep: (state, action: PayloadAction<OnboardingStep>) => {
      state.step = action.payload;
    },
    setPhone: (state, action: PayloadAction<string>) => {
      state.phone = action.payload;
    },
    setAnswer: (state, action: PayloadAction<{ questionId: string; optionIndex: number }>) => {
      state.answers[action.payload.questionId] = action.payload.optionIndex;
    },
    setAllAnswers: (state, action: PayloadAction<Record<string, number>>) => {
      state.answers = action.payload;
    },
    setRiskProfile: (state, action: PayloadAction<RiskProfile>) => {
      state.riskProfile = action.payload;
    },
    setConsent: (state, action: PayloadAction<{ key: keyof OnboardingState['consents']; value: boolean }>) => {
      state.consents[action.payload.key] = action.payload.value;
    },
    setAllConsents: (state, action: PayloadAction<boolean>) => {
      state.consents.riskAcknowledged = action.payload;
      state.consents.lossAcknowledged = action.payload;
      state.consents.noGuaranteeAcknowledged = action.payload;
    },
    setInitialInvestment: (state, action: PayloadAction<number>) => {
      state.initialInvestment = action.payload;
    },
    resetOnboarding: () => initialState,
  },
});

export const {
  setStep,
  setPhone,
  setAnswer,
  setAllAnswers,
  setRiskProfile,
  setConsent,
  setAllConsents,
  setInitialInvestment,
  resetOnboarding,
} = onboardingSlice.actions;

export default onboardingSlice.reducer;
