/**
 * SimulationControls - Game-like control bar for simulation
 */
export function SimulationControls({ world, gameEngine, onRestart, zoom, onZoomIn, onZoomOut, onZoomReset }) {
  const handlePauseToggle = () => {
    world.togglePause();
  };

  const handleRestart = () => {
    if (window.confirm('Are you sure you want to restart the simulation? All progress will be lost.')) {
      onRestart();
    }
  };

  const stats = world.getStats();

  return (
    <div className="simulation-controls">
      <div className="controls-left">
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
          <span>{world.isPaused ? 'Resume' : 'Pause'}</span>
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
          <span>Restart</span>
        </button>

        <div className="zoom-controls">
          <button
            className="control-button zoom-button"
            onClick={onZoomOut}
            title="Zoom Out"
            disabled={zoom <= 0.5}
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
            title="Zoom In"
            disabled={zoom >= 3}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          <button
            className="control-button zoom-button"
            onClick={onZoomReset}
            title="Reset Zoom"
          >
            100%
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
            <div className="stat-value">{stats.worldTime}s</div>
          </div>
        </div>
      </div>

      <div className="controls-right">
        <div className="status-indicator">
          <div className={`status-dot ${world.isPaused ? 'paused' : 'running'}`} />
          <span className="status-text">{world.isPaused ? 'Paused' : 'Running'}</span>
        </div>
      </div>
    </div>
  );
}
