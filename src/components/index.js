// Core UI Components (statically imported by App.jsx)
export { default as ActionLogPane } from './ActionLogPane.jsx';
export { default as Tabs } from './Tabs.jsx';

// Onboarding Controls (statically imported by App.jsx)
export { OnboardingControls } from './onboarding/index.js';

// Components below are lazy-loaded directly by App.jsx for code-splitting
// Do NOT add them here as it creates static imports that prevent chunking:
// - PortfolioHome, Protection, Loans, HistoryPane (tab content)
// - ExecutionSummary, ResetConfirmModal (modals)
// - OnboardingRightPanel (onboarding)

// Shared components used by lazy-loaded modules (these get bundled with their consumers)
export { default as DonutChart } from './DonutChart.jsx';
export { default as HoldingRow } from './HoldingRow.jsx';
export { default as PortfolioHealthBadge } from './PortfolioHealthBadge.jsx';
export { default as LayerMini } from './LayerMini.jsx';
export { default as PendingActionModal } from './PendingActionModal.jsx';
export { default as ConfirmModal, ResetConfirmModalV2, LargeSellConfirmModal, CancelProtectionConfirmModal } from './ConfirmModal.jsx';
