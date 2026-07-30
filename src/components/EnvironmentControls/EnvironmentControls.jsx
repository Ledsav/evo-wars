import { useState } from 'react';

/**
 * EnvironmentControls - Control environmental parameters
 */
export function EnvironmentControls({ world, onEnvironmentChange }) {
  const [saveIndicator, setSaveIndicator] = useState(false);

  const updateEnvironment = (parameter, parser = Number) => (event) => {
    onEnvironmentChange({ [parameter]: parser(event.target.value) });
    setSaveIndicator(true);
    window.setTimeout(() => setSaveIndicator(false), 1500);
  };

  const controls = [
    {
      key: 'foodSpawnRate',
      label: 'Food spawn rate',
      value: world.foodSpawnRate || 0.5,
      display: (world.foodSpawnRate || 0.5).toFixed(1),
      min: 0,
      max: 1,
      step: 0.1,
      description: 'Rate at which nutrient particles enter the culture',
      parser: parseFloat
    },
    {
      key: 'temperature',
      label: 'Temperature',
      value: world.temperature || 1,
      display: `${(world.temperature || 1).toFixed(1)}°`,
      min: 0,
      max: 2,
      step: 0.1,
      description: 'Controls the metabolic activity of every specimen',
      parser: parseFloat
    },
    {
      key: 'mutationRate',
      label: 'Mutation rate',
      value: world.mutationRate || 0.05,
      display: `${((world.mutationRate || 0.05) * 100).toFixed(0)}%`,
      min: 0,
      max: 0.3,
      step: 0.01,
      description: 'Probability of mutation during reproduction',
      parser: parseFloat
    },
    {
      key: 'initialPopulation',
      label: 'Initial population',
      value: world.initialPopulation || 10,
      display: world.initialPopulation || 10,
      min: 2,
      max: 50,
      step: 1,
      description: 'Number of organisms introduced on restart',
      parser: value => parseInt(value, 10)
    },
    {
      key: 'initialFoodCount',
      label: 'Initial nutrients',
      value: world.initialFoodCount || 10,
      display: world.initialFoodCount || 10,
      min: 0,
      max: 200,
      step: 5,
      description: 'Nutrient particles introduced on restart',
      parser: value => parseInt(value, 10)
    },
    {
      key: 'initialSpecies',
      label: 'Initial species',
      value: world.initialSpecies || 1,
      display: world.initialSpecies || 1,
      min: 1,
      max: 10,
      step: 1,
      description: 'Distinct founder species introduced on restart',
      parser: value => parseInt(value, 10)
    },
    {
      key: 'separationSections',
      label: 'Culture partitions',
      value: world.separationSections || 1,
      display: `${world.separationSections || 1} ${(world.separationSections || 1) === 1 ? 'section' : 'sections'}`,
      min: 1,
      max: 16,
      step: 1,
      description: 'Partitions used to segregate founder species',
      parser: value => parseInt(value, 10)
    }
  ];

  return (
    <div className="environment-controls">
      <div className="panel-title-row">
        <div className="panel-title">
          <span className="eyebrow">Chamber protocol</span>
          <h2>Environment</h2>
        </div>
        {saveIndicator && <span className="save-indicator">Saved</span>}
      </div>

      <div className="protocol-grid">
        {controls.map(control => (
          <div className="control-group" key={control.key}>
            <div className="control-header">
              <label htmlFor={`environment-${control.key}`}>{control.label}</label>
              <span className="control-value">{control.display}</span>
            </div>
            <input
              id={`environment-${control.key}`}
              type="range"
              min={control.min}
              max={control.max}
              step={control.step}
              value={control.value}
              onChange={updateEnvironment(control.key, control.parser)}
            />
            <div className="control-description">{control.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
