import React from 'react';

type ConfirmStyle = 'danger' | 'warning' | 'primary';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  confirmStyle?: ConfirmStyle;
  cancelText?: string;
  icon?: string;
}

/**
 * ConfirmModal - Generic confirmation dialog for dangerous actions
 * Decision 20: Used for Reset, large sells, etc.
 */
function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  confirmStyle = 'danger',
  cancelText = 'Cancel',
  icon = '⚠'
}: ConfirmModalProps): React.ReactElement | null {
  if (!isOpen) return null;

  const handleConfirm = (): void => {
    onConfirm();
    onClose();
  };

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="confirmModal" onClick={e => e.stopPropagation()}>
        <div className="confirmModalHeader">
          <span className="confirmModalIcon">{icon}</span>
          <h3>{title}</h3>
        </div>

        <div className="confirmModalBody">
          <p>{message}</p>
        </div>

        <div className="confirmModalActions">
          <button className="btn" onClick={onClose}>
            {cancelText}
          </button>
          <button
            className={`btn ${confirmStyle}`}
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(ConfirmModal);

// Pre-configured variants for common use cases

interface ResetConfirmModalV2Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ResetConfirmModalV2({ isOpen, onClose, onConfirm }: ResetConfirmModalV2Props): React.ReactElement {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Reset Portfolio?"
      message="This will clear all your holdings, loans, and protections. This cannot be undone."
      confirmText="Yes, Reset"
      confirmStyle="danger"
      icon="⚠"
    />
  );
}

interface LargeSellConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  assetName: string;
  amount: string;
}

export function LargeSellConfirmModal({ isOpen, onClose, onConfirm, assetName, amount }: LargeSellConfirmModalProps): React.ReactElement {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Confirm Large Sale"
      message={`You're about to sell ${amount} of ${assetName}. This is a significant portion of your holdings.`}
      confirmText="Yes, Sell"
      confirmStyle="warning"
      icon="⚠"
    />
  );
}

interface CancelProtectionConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  assetName: string;
}

export function CancelProtectionConfirmModal({ isOpen, onClose, onConfirm, assetName }: CancelProtectionConfirmModalProps): React.ReactElement {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Cancel Protection?"
      message={`This will end your protection on ${assetName}. You won't be covered if the price drops.`}
      confirmText="Yes, Cancel"
      confirmStyle="warning"
      icon="🛡"
    />
  );
}
