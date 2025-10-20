import { createContext, useCallback, useEffect, useMemo, useState } from 'react';

const NotificationsContext = createContext(null);

const DEFAULT_SETTINGS = {
  enabled: true,
  speciesBorn: true,
  speciesExtinct: true,
};

export function NotificationsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const raw = localStorage.getItem('evo-notifications');
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('evo-notifications', JSON.stringify(settings));
    } catch (e) {
      
      console.warn('Failed to persist notification settings', e);
    }
  }, [settings]);

  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback((type, message, options = {}) => {
    if (!settings.enabled && type !== 'screenshot') return; 
    if (type === 'species-born' && !settings.speciesBorn) return;
    if (type === 'species-extinct' && !settings.speciesExtinct) return;

    const id = Math.random().toString(36).slice(2);
    const colorMap = {
      'species-extinct': '#ef4444',
      'species-born': '#4caf50',
      'screenshot': '#60a5fa',
    };
    const toast = {
      id,
      type,
      message,
      color: colorMap[type] || '#4caf50',
      createdAt: Date.now(),
      timeout: options.timeout ?? 4000,
    };
    setToasts((prev) => [...prev, toast]);

    if (toast.timeout > 0) {
      setTimeout(() => removeToast(id), toast.timeout);
    }
  }, [removeToast, settings]);

  const value = useMemo(() => ({ settings, setSettings, toasts, removeToast, notify }), [settings, toasts, removeToast, notify]);

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
}

export default NotificationsContext;
