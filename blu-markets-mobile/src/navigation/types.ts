// Navigation Types
// Based on CLAUDE_CODE_HANDOFF.md Section 7
import { NavigatorScreenParams } from '@react-navigation/native';

// Root Stack (Auth vs Main app)
export type RootStackParamList = {
  Onboarding: NavigatorScreenParams<OnboardingStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};

// Onboarding Stack
export type OnboardingStackParamList = {
  Welcome: undefined;
  PhoneInput: undefined;
  OTPVerify: { phone: string };
  Questionnaire: undefined;
  ProfileResult: undefined;
  Consent: undefined;
  InitialFunding: undefined;
  Success: undefined;
};

// Main Tab Navigator (5 tabs per handoff)
export type MainTabParamList = {
  Home: undefined;
  Portfolio: undefined;
  Market: undefined;
  History: undefined;
  Profile: undefined;
};

// Detail Screens (Modal presentation)
export type DetailStackParamList = {
  AssetDetail: { assetId: string };
  LoanDetail: { loanId: string };
  Notifications: undefined;
  ActiveProtections: undefined;
  LoansDashboard: undefined;
};

// Sheet params for bottom sheets
export type SheetParamList = {
  Trade: { assetId?: string; side?: 'BUY' | 'SELL' };
  AddFunds: undefined;
  Withdraw: undefined;
  Protection: { assetId: string };
  Borrow: { assetId?: string };
  Repay: { loanId: string };
  Rebalance: undefined;
};
