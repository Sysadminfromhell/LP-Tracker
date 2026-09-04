import { useEffect } from 'react';

export type AdminToastVariant = 'success' | 'error';
export interface AdminToastMessage {
  id: string;
  variant: AdminToastVariant;
  message: string;
}
interface AdminToastHostProps {
  toasts: AdminToastMessage[];
  onDismiss: (id: string) => void;
}
interface AdminToastItemProps {
  toast: AdminToastMessage;
  onDismiss: (id: string) => void;
}

function AdminToastItem({ toast, onDismiss }: AdminToastItemProps) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      onDismiss(toast.id);
    }, 7_500);
    return () => {
      window.clearTimeout(timer);
    };
  }, [onDismiss, toast.id]);
  return (
    <div
      className={`admin-toast admin-toast-${toast.variant}`}
      role={toast.variant === 'error' ? 'alert' : 'status'}
    >
      <div className="admin-toast-icon">{toast.variant === 'success' ? '✓' : '!'}</div>
      <div className="admin-toast-content">
        <strong>{toast.variant === 'success' ? 'Success' : 'Something went wrong'}</strong>
        <span>{toast.message}</span>
      </div>
      <button
        className="admin-toast-close"
        type="button"
        aria-label="Dismiss notification"
        onClick={() => {
          onDismiss(toast.id);
        }}
      >
        ×
      </button>
    </div>
  );
}
function AdminToastHost({ toasts, onDismiss }: AdminToastHostProps) {
  return (
    <div className="admin-toast-host" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <AdminToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
export default AdminToastHost;
