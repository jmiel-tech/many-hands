import { useNotifications } from '../lib/notifications.jsx';
import { Icons } from './ui.jsx';

export default function Notifications() {
  const { notifications, removeNotification } = useNotifications();

  return (
    <div className="notifications-container">
      {notifications.map(({ id, message, type }) => (
        <div key={id} className={`notification notification-${type}`} role="status" aria-live="polite">
          <div className="notification-content">
            {type === 'success' && <Icons.checkmark />}
            {type === 'error' && <Icons.error />}
            {type === 'info' && <Icons.info />}
            <span>{message}</span>
          </div>
          <button
            type="button"
            className="notification-close"
            onClick={() => removeNotification(id)}
            aria-label="Dismiss notification"
          >
            <Icons.close />
          </button>
        </div>
      ))}
    </div>
  );
}
