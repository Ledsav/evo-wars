import { useNotifications } from '../../context/useNotifications';

/**
 * SettingsModal - Configuration modal for notification preferences
 */
export function SettingsModal({ open, onClose }) {
  const { settings, setSettings } = useNotifications();
  
  if (!open) return null;
  
  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3>Settings</h3>
          <button className="settings-close" onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </div>
        
        <div className="settings-content">
          <div className="settings-section">
            <h4>Notifications</h4>
            <p className="settings-description">
              Configure which events trigger notifications during simulation
            </p>
            
            <div className="settings-toggles">
              <label className="toggle-row">
                <div className="toggle-info">
                  <span className="toggle-label">Enable notifications</span>
                  <span className="toggle-hint">Master switch for all notifications</span>
                </div>
                <input
                  type="checkbox"
                  className="toggle-input"
                  checked={settings.enabled}
                  onChange={(e) => setSettings(s => ({ ...s, enabled: e.target.checked }))}
                />
                <span className="toggle-slider"></span>
              </label>
              
              <label className={`toggle-row ${!settings.enabled ? 'disabled' : ''}`}>
                <div className="toggle-info">
                  <span className="toggle-label">🧬 Species born</span>
                  <span className="toggle-hint">New species emerge through evolution</span>
                </div>
                <input
                  type="checkbox"
                  className="toggle-input"
                  checked={settings.speciesBorn}
                  disabled={!settings.enabled}
                  onChange={(e) => setSettings(s => ({ ...s, speciesBorn: e.target.checked }))}
                />
                <span className="toggle-slider"></span>
              </label>
              
              <label className={`toggle-row ${!settings.enabled ? 'disabled' : ''}`}>
                <div className="toggle-info">
                  <span className="toggle-label">💀 Species extinct</span>
                  <span className="toggle-hint">Species die out from simulation</span>
                </div>
                <input
                  type="checkbox"
                  className="toggle-input"
                  checked={settings.speciesExtinct}
                  disabled={!settings.enabled}
                  onChange={(e) => setSettings(s => ({ ...s, speciesExtinct: e.target.checked }))}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
