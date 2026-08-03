import { useState } from 'react';

/**
 * SimulationControls - Game-like control bar for simulation
 */
import { SettingsIcon } from '../shared/Icons/Icons';

export function SimulationControls({ world, gameEngine, onRestart, zoom, onZoomIn, onZoomOut, onResetView, onOpenSettings }) {
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [stepDays, setStepDays] = useState(10);
  const [fastForwardProgress, setFastForwardProgress] = useState(null);
  const [, refreshControls] = useState(0);
  const [experimentId] = useState(() => {
    const dateCode = new Date().toISOString().slice(2, 10).replaceAll('-', '');
    return `EVO-${dateCode}`;
  });

  const handlePauseToggle = () => {
    world.togglePause();
    refreshControls(value => value + 1);
  };

  const handleRestart = () => {
    if (window.confirm('Are you sure you want to restart the simulation? All progress will be lost.')) {
      onRestart();
    }
  };

  const handleSpeedIncrease = () => {
    const speedLevels = [0.25, 0.5, 1, 2, 4];
    const currentIndex = speedLevels.indexOf(simulationSpeed);
    if (currentIndex < speedLevels.length - 1) {
      const newSpeed = speedLevels[currentIndex + 1];
      setSimulationSpeed(newSpeed);
      gameEngine.setSimulationSpeed(newSpeed);
    }
  };

  const handleSpeedDecrease = () => {
    const speedLevels = [0.25, 0.5, 1, 2, 4];
    const currentIndex = speedLevels.indexOf(simulationSpeed);
    if (currentIndex > 0) {
      const newSpeed = speedLevels[currentIndex - 1];
      setSimulationSpeed(newSpeed);
      gameEngine.setSimulationSpeed(newSpeed);
    }
  };

  const handleFastForward = async () => {
    if (fastForwardProgress !== null) return;

    setFastForwardProgress(0);
    try {
      await gameEngine.fastForwardDays(stepDays, {
        onProgress: setFastForwardProgress
      });
    } finally {
      setFastForwardProgress(null);
      refreshControls(value => value + 1);
    }
  };

  const stats = world.getStats();

  const formatElapsedTime = (milliseconds) => {
    const seconds = Number(milliseconds) / 1000;
    if (seconds < 60) {
      return Math.floor(seconds) + 's';
    }
    if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return minutes + 'm';
    }
    if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      return hours + 'h';
    }
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return days + 'd ' + hours + 'h';
  };


  return (
    <header className="simulation-controls">
      <div className="experiment-identity">
        <span className="eyebrow">Experiment</span>
        <strong>Evo Wars</strong>
        <span className="experiment-id">{experimentId}</span>
      </div>

      <div className="controls-left">
        <span className="instrument-label">Run controls</span>
        <button
          className={`control-button ${world.isPaused ? 'paused' : 'playing'}`}
          onClick={handlePauseToggle}
          title={world.isPaused ? 'Resume Simulation' : 'Pause Simulation'}
        >
          {world.isPaused ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          )}
          {/* <span>{world.isPaused ? 'Resume' : 'Pause'}</span> */}
        </button>

        <button
          className="control-button restart-button"
          onClick={handleRestart}
          title="Restart Simulation"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          {/* <span>Restart</span> */}
        </button>

        <div className="zoom-controls">
          <button
            className="control-button zoom-button"
            onClick={onZoomOut}
            title="Zoom out"
            disabled={zoom <= 1}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="8" y1="11" x2="14" y2="11" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          <span className="zoom-display">{Math.round(zoom * 100)}%</span>
          <button
            className="control-button zoom-button"
            onClick={onZoomIn}
            title="Zoom in"
            disabled={zoom >= 5}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          <button
            className="control-button zoom-button reset-view-button"
            onClick={onResetView}
            title="Reset microscope view (double-click canvas also works)"
            aria-label="Reset microscope view"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <circle cx="12" cy="12" r="8"/>
              <line x1="12" y1="2" x2="12" y2="4"/>
              <line x1="12" y1="20" x2="12" y2="22"/>
              <line x1="2" y1="12" x2="4" y2="12"/>
              <line x1="20" y1="12" x2="22" y2="12"/>
            </svg>
          </button>
        </div>



        <div className="speed-controls">
          <button
            className="control-button speed-button"
            onClick={handleSpeedDecrease}
            title="Decrease Speed"
            disabled={simulationSpeed <= 0.25}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 8 8 12 12 16" />
              <line x1="16" y1="12" x2="8" y2="12" />
            </svg>
          </button>
          <span className="speed-display">{simulationSpeed}x</span>
          <button
            className="control-button speed-button"
            onClick={handleSpeedIncrease}
            title="Increase Speed"
            disabled={simulationSpeed >= 4}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 8 16 12 12 16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </button>
        </div>

        <div className="offline-controls">
          <span className="offline-label">Step</span>
          <select
            value={stepDays}
            onChange={event => setStepDays(Number(event.target.value))}
            disabled={fastForwardProgress !== null}
            aria-label="Headless simulation duration"
          >
            <option value={1}>1 day</option>
            <option value={10}>10 days</option>
            <option value={100}>100 days</option>
          </select>
          <button
            className="offline-step-button"
            onClick={handleFastForward}
            disabled={fastForwardProgress !== null}
            title="Advance ecology without rendering intermediate frames"
          >
            {fastForwardProgress === null
              ? `+${stepDays}d`
              : `${Math.round(fastForwardProgress * 100)}%`}
          </button>
        </div>
      </div>

      <div className="controls-center">
        <div className="stat-display">
          <div className="stat-icon">👥</div>
          <div className="stat-info">
            <div className="stat-label">Population</div>
            <div className="stat-value">{stats.aliveOrganisms}</div>
          </div>
        </div>

        <div className="stat-display">
          <div className="stat-icon">🍖</div>
          <div className="stat-info">
            <div className="stat-label">Food</div>
            <div className="stat-value">{stats.foodParticles}</div>
          </div>
        </div>

      
        <div className="stat-display">
          <div className="stat-icon">⏱️</div>
          <div className="stat-info">
            <div className="stat-label">Time</div>
            <div className="stat-value">{formatElapsedTime(stats.worldTime)}</div>
          </div>
        </div>
      </div>

      <div className="controls-right">
        <button
          className="control-button settings-button"
          title="Settings"
          onClick={onOpenSettings}
          aria-label="Open settings"
        >
          <SettingsIcon size={18} />
        </button>
      </div>
    </header>
  );
}
