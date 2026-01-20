// Navigation Types
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

// Main Tab Navigator
export type MainTabParamList = {
  Portfolio: NavigatorScreenParams<PortfolioStackParamList>;
  Protection: NavigatorScreenParams<ProtectionStackParamList>;
  Loans: NavigatorScreenParams<LoansStackParamList>;
  History: undefined;
  Profile: undefined;
};

// Portfolio Stack
export type PortfolioStackParamList = {
  Dashboard: undefined;
  AssetDetail: { assetId: string };
  Trade: { assetId?: string; side?: 'BUY' | 'SELL' };
  Rebalance: undefined;
  AddFunds: undefined;
};

// Protection Stack
export type ProtectionStackParamList = {
  ProtectionList: undefined;
  ProtectionDetail: { protectionId: string };
  NewProtection: { assetId: string };
};

// Loans Stack
export type LoansStackParamList = {
  LoansList: undefined;
  LoanDetail: { loanId: string };
  NewLoan: { assetId?: string };
  Repay: { loanId: string };
};
