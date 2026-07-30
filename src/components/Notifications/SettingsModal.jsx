import { useNotifications } from '../../context/useNotifications';
import { CloseIcon } from '../shared/Icons/Icons';

/**
 * SettingsModal - Configuration modal for notification preferences
 */
export function SettingsModal({ open, onClose }) {
  const { settings, setSettings } = useNotifications();

  if (!open) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(event) => event.stopPropagation()}>
        <div className="settings-header">
          <div>
            <span className="eyebrow">Instrument preferences</span>
            <h3>Settings</h3>
          </div>
          <button className="settings-close" onClick={onClose} aria-label="Close settings">
            <CloseIcon size={20} />
          </button>
        </div>

        <div className="settings-content">
          <div className="settings-section">
            <h4>Notifications</h4>
            <p className="settings-description">
              Configure which events trigger notifications during the simulation.
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
                  onChange={(event) => setSettings(current => ({ ...current, enabled: event.target.checked }))}
                />
                <span className="toggle-slider" />
              </label>

              <label className={`toggle-row ${!settings.enabled ? 'disabled' : ''}`}>
                <div className="toggle-info">
                  <span className="toggle-label">Speciation events</span>
                  <span className="toggle-hint">New species emerge through evolution</span>
                </div>
                <input
                  type="checkbox"
                  className="toggle-input"
                  checked={settings.speciesBorn}
                  disabled={!settings.enabled}
                  onChange={(event) => setSettings(current => ({ ...current, speciesBorn: event.target.checked }))}
                />
                <span className="toggle-slider" />
              </label>

              <label className={`toggle-row ${!settings.enabled ? 'disabled' : ''}`}>
                <div className="toggle-info">
                  <span className="toggle-label">Extinction events</span>
                  <span className="toggle-hint">Species disappear from the culture</span>
                </div>
                <input
                  type="checkbox"
                  className="toggle-input"
                  checked={settings.speciesExtinct}
                  disabled={!settings.enabled}
                  onChange={(event) => setSettings(current => ({ ...current, speciesExtinct: event.target.checked }))}
                />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
