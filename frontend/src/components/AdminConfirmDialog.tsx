import { useEffect } from 'react';

interface AdminConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function AdminConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: AdminConfirmDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) {
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
  return (
    <div
      className="admin-confirm-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onCancel();
        }
      }}
    >
      <div
        className="admin-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-confirm-title"
        aria-describedby="admin-confirm-message"
      >
        <div className={`admin-confirm-icon ${danger ? 'danger' : ''}`}>!</div>
        <div className="admin-confirm-content">
          <h3 id="admin-confirm-title">{title}</h3>
          <p id="admin-confirm-message">{message}</p>
        </div>
        <div className="admin-confirm-actions">
          <button
            className="admin-secondary-button"
            type="button"
            disabled={busy}
            autoFocus
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className={danger ? 'admin-danger-button' : 'admin-primary-button'}
            type="button"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
export default AdminConfirmDialog;
