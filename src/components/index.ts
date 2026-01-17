// Core UI Components (statically imported by App.tsx)
export { default as ActionLogPane } from './ActionLogPane';
export { default as Tabs } from './Tabs';

// Onboarding Controls (statically imported by App.tsx)
export { OnboardingControls } from './onboarding/index';

// Components below are lazy-loaded directly by App.tsx for code-splitting
// Do NOT add them here as it creates static imports that prevent chunking:
// - PortfolioHome, Protection, Loans, HistoryPane (tab content)
// - ExecutionSummary, ResetConfirmModal (modals)
// - OnboardingRightPanel (onboarding)

// Shared components used by lazy-loaded modules (these get bundled with their consumers)
export { default as DonutChart } from './DonutChart';
export { default as HoldingRow } from './HoldingRow';
export { default as PortfolioHealthBadge } from './PortfolioHealthBadge';
export { default as LayerMini } from './LayerMini';
export { default as PendingActionModal } from './PendingActionModal';
export { default as ConfirmModal, ResetConfirmModalV2, LargeSellConfirmModal, CancelProtectionConfirmModal } from './ConfirmModal';
