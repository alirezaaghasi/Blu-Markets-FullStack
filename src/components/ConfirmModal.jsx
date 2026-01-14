import React from 'react';

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
  confirmStyle = 'danger', // 'danger' | 'warning' | 'primary'
  cancelText = 'Cancel',
  icon = '⚠'
}) {
  if (!isOpen) return null;

  const handleConfirm = () => {
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

export function ResetConfirmModalV2({ isOpen, onClose, onConfirm }) {
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

export function LargeSellConfirmModal({ isOpen, onClose, onConfirm, assetName, amount }) {
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

export function CancelProtectionConfirmModal({ isOpen, onClose, onConfirm, assetName }) {
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
