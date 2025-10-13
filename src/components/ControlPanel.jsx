/**
 * ControlPanel - Game controls and statistics
 */
export function ControlPanel({ world, organism, onSpawnFood, onSpawnOrganism, onTogglePause }) {
  const stats = world.getStats();

  return (
    <div className="control-panel">
      <div className="panel-section">
        <h2>World Statistics</h2>
        <div className="stats-grid">
          <div className="stat">
            <span className="stat-label">Time:</span>
            <span className="stat-value">{stats.worldTime}s</span>
          </div>
          <div className="stat">
            <span className="stat-label">Organisms:</span>
            <span className="stat-value">{stats.aliveOrganisms}/{stats.totalOrganisms}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Food:</span>
            <span className="stat-value">{stats.foodParticles}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Avg Energy:</span>
            <span className="stat-value">{stats.averageEnergy}</span>
          </div>
        </div>
      </div>

      {organism && organism.isAlive && (
        <div className="panel-section">
          <h2>Your Organism</h2>
          <div className="stats-grid">
            <div className="stat">
              <span className="stat-label">Energy:</span>
              <span className="stat-value energy-bar">
                <div className="bar-bg">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${(organism.energy / organism.maxEnergy) * 100}%`,
                      backgroundColor: organism.energy > 50 ? '#4ade80' : organism.energy > 25 ? '#fbbf24' : '#ef4444'
                    }}
                  />
                </div>
                {organism.energy.toFixed(0)}/{organism.maxEnergy}
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Age:</span>
              <span className="stat-value">{(organism.age / 1000).toFixed(1)}s</span>
            </div>
            <div className="stat">
              <span className="stat-label">DNA Points:</span>
              <span className="stat-value dna-points">{organism.dnaPoints.toFixed(1)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Size:</span>
              <span className="stat-value">{organism.phenotype.size.toFixed(1)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Speed:</span>
              <span className="stat-value">{organism.phenotype.maxSpeed.toFixed(2)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Metabolism:</span>
              <span className="stat-value">{organism.phenotype.metabolicRate.toFixed(2)}</span>
            </div>
          </div>

          <div className="phenotype-traits">
            <h3>Traits</h3>
            <div className="traits-list">
              {organism.phenotype.armor > 0 && (
                <span className="trait">Armor</span>
              )}
              {organism.phenotype.toxicity > 0 && (
                <span className="trait">Toxic</span>
              )}
              {organism.canReproduce() && (
                <span className="trait active">Can Reproduce</span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="panel-section">
        <h2>Controls</h2>
        <div className="controls-grid">
          <button className="control-btn" onClick={onTogglePause}>
            {world.isPaused ? 'Resume' : 'Pause'}
          </button>
          <button className="control-btn" onClick={onSpawnFood}>
            Spawn Food (5)
          </button>
          <button className="control-btn" onClick={onSpawnOrganism}>
            Spawn Organism
          </button>
          {organism && organism.canReproduce() && (
            <button className="control-btn reproduce" onClick={() => {
              const offspring = organism.reproduce();
              if (offspring) {
                world.addOrganism(offspring);
              }
            }}>
              Reproduce
            </button>
          )}
        </div>
      </div>

      <div className="panel-section">
        <h2>Instructions</h2>
        <ul className="instructions">
          <li>Use WASD or Arrow keys to move your organism</li>
          <li>Collect green food particles to gain energy and DNA points</li>
          <li>Use DNA points to mutate your organism's genes</li>
          <li>Survive and reproduce to continue evolving</li>
          <li>Different mutations create different traits</li>
        </ul>
      </div>
    </div>
  );
}
