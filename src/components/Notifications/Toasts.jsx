import { useNotifications } from '../../context/useNotifications';

/**
 * Toasts - Display notification toasts for simulation events
 */
export function Toasts() {
  const { toasts, removeToast } = useNotifications();
  
  if (!toasts || toasts.length === 0) return null;
  
  const getToastIcon = (type) => {
    switch (type) {
      case 'species-extinct': return '💀';
      case 'species-born': return '🧬';
      case 'screenshot': return '📸';
      default: return '🧬';
    }
  };
  
  return (
    <div className="toasts-container">
      {toasts.map(t => (
        <div key={t.id} className="toast" style={{ borderColor: t.color }}>
           <button className="toast-close" onClick={() => removeToast(t.id)} aria-label="Dismiss">
            ✕
          </button>
          <div className="toast-icon" style={{ color: t.color }}>
            {getToastIcon(t.type)}
          </div>
          <div className="toast-message">{t.message}</div>
         
        </div>
      ))}
    </div>
  );
}
