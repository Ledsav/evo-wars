/**
 * EnvironmentControls - Control environmental parameters
 */
export function EnvironmentControls({ world, onEnvironmentChange }) {


  const handleFoodRateChange = (e) => {
    const rate = parseFloat(e.target.value);
    onEnvironmentChange({ foodSpawnRate: rate });
  };

  const handleTemperatureChange = (e) => {
    const temp = parseFloat(e.target.value);
    onEnvironmentChange({ temperature: temp });
  };

  const handleMutationRateChange = (e) => {
    const rate = parseFloat(e.target.value);
    onEnvironmentChange({ mutationRate: rate });
  };

  const handleInitialPopChange = (e) => {
    const pop = parseInt(e.target.value);
    onEnvironmentChange({ initialPopulation: pop });
  };

  const handleInitialFoodChange = (e) => {
    const val = parseInt(e.target.value);
    onEnvironmentChange({ initialFoodCount: val });
  };

  const handleInitialSpeciesChange = (e) => {
    const val = parseInt(e.target.value);
    onEnvironmentChange({ initialSpecies: val });
  };



  return (
    <div className="environment-controls">
      <h2>Environment Parameters</h2>

      <div className="control-group">
        <div className="control-header">
          <label>
            <span className="control-icon">🍖</span>
            Food Spawn Rate
          </label>
          <span className="control-value">{(world.foodSpawnRate || 0.5).toFixed(1)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={world.foodSpawnRate || 0.5}
          onChange={handleFoodRateChange}
        />
        <div className="control-description">Higher = more food spawns</div>
      </div>

      <div className="control-group">
        <div className="control-header">
          <label>
            <span className="control-icon">🌡️</span>
            Temperature
          </label>
          <span className="control-value">{(world.temperature || 1.0).toFixed(1)}°</span>
        </div>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={world.temperature || 1.0}
          onChange={handleTemperatureChange}
        />
        <div className="control-description">Affects metabolism speed</div>
      </div>

      <div className="control-group">
        <div className="control-header">
          <label>
            <span className="control-icon">🧬</span>
            Mutation Rate
          </label>
          <span className="control-value">{((world.mutationRate || 0.05) * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="0.3"
          step="0.01"
          value={world.mutationRate || 0.05}
          onChange={handleMutationRateChange}
        />
        <div className="control-description">Chance of mutation on reproduction</div>
      </div>

      <div className="control-group">
        <div className="control-header">
          <label>
            <span className="control-icon">👥</span>
            Initial Population
          </label>
          <span className="control-value">{world.initialPopulation || 10}</span>
        </div>
        <input
          type="range"
          min="2"
          max="50"
          step="1"
          value={world.initialPopulation || 10}
          onChange={handleInitialPopChange}
        />
        <div className="control-description">Starting organisms on restart</div>
      </div>

      <div className="control-group">
        <div className="control-header">
          <label>
            <span className="control-icon">🍏</span>
            Initial Food
          </label>
          <span className="control-value">{world.initialFoodCount || 10}</span>
        </div>
        <input
          type="range"
          min="0"
          max="200"
          step="5"
          value={world.initialFoodCount || 10}
          onChange={handleInitialFoodChange}
        />
        <div className="control-description">Food items placed at start</div>
      </div>

      <div className="control-group">
        <div className="control-header">
          <label>
            <span className="control-icon">🧫</span>
            Initial Species
          </label>
          <span className="control-value">{world.initialSpecies || 1}</span>
        </div>
        <input
          type="range"
          min="1"
          max="10"
          step="1"
          value={world.initialSpecies || 1}
          onChange={handleInitialSpeciesChange}
        />
        <div className="control-description">Number of distinct starting species</div>
      </div>
    </div>
  );
}
