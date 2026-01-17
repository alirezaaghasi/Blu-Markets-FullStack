import React from 'react';

interface ResetConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * ResetConfirmModal - Confirmation dialog for portfolio reset
 */
function ResetConfirmModal({ onConfirm, onCancel }: ResetConfirmModalProps): React.ReactElement {
  return (
    <div className="modalOverlay">
      <div className="modal">
        <div className="modalHeader">Reset Portfolio?</div>
        <div className="modalBody">
          <p className="modalMessage">
            This will reset your portfolio and start over. All holdings, protections, and loans will be cleared.
          </p>
        </div>
        <div className="modalFooter">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn danger" onClick={onConfirm}>Yes, Reset</button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(ResetConfirmModal);
