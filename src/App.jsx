import { useEffect, useRef, useState } from 'react';
import './App.css';
import { SimulationControls } from './components/SimulationControls';
import { EnvironmentControls } from './components/EnvironmentControls';
import { CreatureViewer } from './components/CreatureViewer';
import { SimulationCanvas } from './components/SimulationCanvas';
import { World } from './core/world/World';
import { GameEngine } from './engine/GameEngine';

function App() {
  const [worldSize, setWorldSize] = useState({ width: 1200, height: 800 });
  const [world] = useState(() => new World(worldSize.width, worldSize.height));
  const [gameEngine] = useState(() => new GameEngine(world));
  const [, forceUpdate] = useState({});
  const [activeTab, setActiveTab] = useState('creatures');
  const [highlightedSpeciesId, setHighlightedSpeciesId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Initialize game
  useEffect(() => {
    // Spawn initial population
    world.spawnInitialPopulation();

    // Setup game engine callbacks
    gameEngine.setUpdateCallback(() => {
      forceUpdate({});
    });

    gameEngine.setRenderCallback(() => {
      if (canvasRef.current && canvasRef.current.render) {
        canvasRef.current.render();
      }
    });

    // Start game
    gameEngine.start();

    return () => {
      gameEngine.stop();
    };
  }, [world, gameEngine]);

  const handleEnvironmentChange = (params) => {
    if (params.restart) {
      world.spawnInitialPopulation();
      setHighlightedSpeciesId(null); // Clear highlight on restart
    } else {
      world.setEnvironmentParams(params);
    }
    forceUpdate({});
  };

  const handleRestart = () => {
    world.spawnInitialPopulation();
    setHighlightedSpeciesId(null); // Clear highlight on restart
    forceUpdate({});
  };

  const handleSpeciesHighlight = (speciesId) => {
    setHighlightedSpeciesId(speciesId);
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(zoom + 0.25, 2);
    setZoom(newZoom);
    const baseWidth = 1200;
    const baseHeight = 800;
    const newSize = {
      width: Math.floor(baseWidth * newZoom),
      height: Math.floor(baseHeight * newZoom)
    };

    // Update world dimensions
    world.width = newSize.width;
    world.height = newSize.height;
    setWorldSize(newSize);
    forceUpdate({});
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoom - 0.25, 0.5);
    setZoom(newZoom);
    const baseWidth = 1200;
    const baseHeight = 800;
    const newSize = {
      width: Math.floor(baseWidth * newZoom),
      height: Math.floor(baseHeight * newZoom)
    };

    // Update world dimensions
    world.width = newSize.width;
    world.height = newSize.height;
    setWorldSize(newSize);

    // Keep organisms in bounds
    for (const organism of world.organisms) {
      organism.x = Math.min(organism.x, newSize.width - 20);
      organism.y = Math.min(organism.y, newSize.height - 20);
    }
    forceUpdate({});
  };

  const handleZoomReset = () => {
    setZoom(1);
    const newSize = { width: 1200, height: 800 };
    world.width = newSize.width;
    world.height = newSize.height;
    setWorldSize(newSize);
    forceUpdate({});
  };

  return (
    <div className="app">
      <SimulationControls
        world={world}
        gameEngine={gameEngine}
        onRestart={handleRestart}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
      />

      <div className="main-container">
        <div className="canvas-section" ref={containerRef}>
          <SimulationCanvas
            world={world}
            width={worldSize.width}
            height={worldSize.height}
            highlightedSpeciesId={highlightedSpeciesId}
            ref={canvasRef}
          />
        </div>

        <div className="sidebar">
          <div className="tab-buttons">
            <button
              className={`tab-button ${activeTab === 'creatures' ? 'active' : ''}`}
              onClick={() => setActiveTab('creatures')}
            >
              Creatures
            </button>
            <button
              className={`tab-button ${activeTab === 'environment' ? 'active' : ''}`}
              onClick={() => setActiveTab('environment')}
            >
              Environment
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'creatures' && (
              <CreatureViewer
                world={world}
                onSpeciesHighlight={handleSpeciesHighlight}
              />
            )}

            {activeTab === 'environment' && (
              <EnvironmentControls
                world={world}
                onEnvironmentChange={handleEnvironmentChange}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
