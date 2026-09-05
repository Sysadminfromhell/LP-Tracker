import { useEffect } from 'react';

export type AdminToastVariant = 'success' | 'error' | 'info';
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
  const icon = toast.variant === 'success' ? '✓' : toast.variant === 'error' ? '!' : 'i';
  const title =
    toast.variant === 'success'
      ? 'Success'
      : toast.variant === 'error'
        ? 'Something went wrong'
        : 'Info';
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
      <div className="admin-toast-icon">{icon}</div>
      <div className="admin-toast-content">
        <strong>{title}</strong>
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
