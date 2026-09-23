import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface AdminResetConfirmDialogProps {
  open: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function AdminResetConfirmDialog({
  open,
  busy = false,
  onConfirm,
  onCancel,
}: AdminResetConfirmDialogProps) {
  const [acknowledgement, setAcknowledgement] = useState('');
  const acknowledged = acknowledgement.trim() === 'I understand';
  useEffect(() => {
    if (!open) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) {
        setAcknowledgement('');
        onCancel();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [busy, onCancel, open]);
  if (!open) {
    return null;
  }
  return createPortal(
    <div
      className="admin-confirm-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          setAcknowledgement('');
          onCancel();
        }
      }}
    >
      <div
        className="admin-confirm-dialog admin-reset-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-reset-confirm-title"
        aria-describedby="admin-reset-confirm-message"
      >
        <div className="admin-confirm-icon danger">!</div>
        <div className="admin-confirm-content">
          <h3 id="admin-reset-confirm-title">Reset Application</h3>
          <p id="admin-reset-confirm-message">
            Are you really sure you want to reset the application and delete all data? This cannot
            be undone!
          </p>
          <label className="admin-reset-confirm-label" htmlFor="admin-reset-confirm-input">
            Type <strong>I understand</strong> to continue.
          </label>
          <input
            id="admin-reset-confirm-input"
            className="admin-reset-confirm-input"
            type="text"
            value={acknowledgement}
            disabled={busy || acknowledged}
            autoComplete="off"
            autoFocus
            onChange={(event) => {
              setAcknowledgement(event.target.value);
            }}
          />
        </div>
        <div className="admin-confirm-actions">
          <button
            className="admin-secondary-button"
            type="button"
            disabled={busy}
            onClick={() => {
              setAcknowledgement('');
              onCancel();
            }}
          >
            Cancel
          </button>
          <button
            className="admin-danger-button"
            type="button"
            disabled={busy || !acknowledged}
            onClick={onConfirm}
          >
            {busy ? 'Resetting...' : 'Yes, Delete All Data'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default AdminResetConfirmDialog;
