import { useEffect, useRef, useState } from 'react';
import './App.css';
import { CreatureViewer } from './components/CreatureViewer/CreatureViewer';
import { EnvironmentControls } from './components/EnvironmentControls/EnvironmentControls';
import { FamilyTree } from './components/FamilyTree/FamilyTree';
import { SimulationCanvas } from './components/SimulationCanvas/SimulationCanvas';
import { SimulationControls } from './components/SimulationControls/SimulationControls';
import { Statistics } from './components/Statistics/Statistics';
import { World } from './simulation/world/World';
import { GameEngine } from './engine/GameEngine';

const WIDTH_RESOLUTIONS = {low: 800, medium: 1280, high: 1920, ultra: 2560};
const HEIGHT_RESOLUTIONS = {low: 600, medium: 720, high: 1080, ultra: 1440};

function App() {
  const [worldSize, setWorldSize] = useState({ width: WIDTH_RESOLUTIONS.ultra, height: HEIGHT_RESOLUTIONS.ultra });
  const [world] = useState(() => new World(worldSize.width, worldSize.height));
  const [gameEngine] = useState(() => new GameEngine(world));
  const [, forceUpdate] = useState({});
  const [activeTab, setActiveTab] = useState('controls');
  const [highlightedSpeciesId, setHighlightedSpeciesId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [overlays, setOverlays] = useState({
    showSensory: false,
    showRepro: false,
    showSpeed: false,
    showMetabolism: false,
  });
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const updateCounterRef = useRef(0);
  const lastUIUpdateRef = useRef(0);

  // Initialize game
  useEffect(() => {
    // Spawn initial population
    world.spawnInitialPopulation();

    // Setup game engine callbacks
    gameEngine.setUpdateCallback(() => {
      updateCounterRef.current++;

      // Only trigger React re-renders every 30 frames (~500ms at 60fps)
      // This prevents UI components from re-rendering on every simulation tick
      if (updateCounterRef.current - lastUIUpdateRef.current >= 30) {
        lastUIUpdateRef.current = updateCounterRef.current;
        forceUpdate({});
      }
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
    const baseWidth = WIDTH_RESOLUTIONS.ultra;
    const baseHeight = HEIGHT_RESOLUTIONS.ultra;
    const newSize = {
      width: Math.floor(baseWidth * newZoom),
      height: Math.floor(baseHeight * newZoom)
    };

    // Update world dimensions
    world.width = newSize.width;
    world.height = newSize.height;
    setWorldSize(newSize);

    // Redistribute food to fit new bounds
    world.redistributeFood();

    forceUpdate({});
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoom - 0.25, 0.5);
    setZoom(newZoom);
    const baseWidth = WIDTH_RESOLUTIONS.ultra;
    const baseHeight = HEIGHT_RESOLUTIONS.ultra;
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

    // Redistribute food to fit new bounds
    world.redistributeFood();

    forceUpdate({});
  };

  const handleZoomReset = () => {
    setZoom(1);
    const newSize = { width: WIDTH_RESOLUTIONS.ultra, height: HEIGHT_RESOLUTIONS.ultra };
    world.width = newSize.width;
    world.height = newSize.height;
    setWorldSize(newSize);

    // Redistribute food to fit new bounds
    world.redistributeFood();

    forceUpdate({});
  };

  const handleUpdateSampleFrequency = (frequency) => {
    world.statsTracker.setSampleFrequency(frequency);
  };

  const handleResetView = () => {
    if (canvasRef.current && canvasRef.current.resetView) {
      canvasRef.current.resetView();
    }
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
        onResetView={handleResetView}
      />

      <div className="main-container">
        <div className="canvas-section" ref={containerRef}>
          <SimulationCanvas
            world={world}
            width={worldSize.width}
            height={worldSize.height}
            highlightedSpeciesId={highlightedSpeciesId}
            overlays={overlays}
            ref={canvasRef}
          />
        </div>

        <div className="sidebar">
          <div className="tab-buttons">
            <button
              className={`tab-button ${activeTab === 'controls' ? 'active' : ''}`}
              onClick={() => setActiveTab('controls')}
            >
              Controls
            </button>
            <button
              className={`tab-button ${activeTab === 'environment' ? 'active' : ''}`}
              onClick={() => setActiveTab('environment')}
            >
              Environment
            </button>
            <button
              className={`tab-button ${activeTab === 'statistics' ? 'active' : ''}`}
              onClick={() => setActiveTab('statistics')}
            >
              Statistics
            </button>
            <button
              className={`tab-button ${activeTab === 'genealogy' ? 'active' : ''}`}
              onClick={() => setActiveTab('genealogy')}
            >
              Genealogy
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'controls' && (
              <CreatureViewer
                world={world}
                onSpeciesHighlight={handleSpeciesHighlight}
                overlays={overlays}
                onUpdateOverlays={(next) => setOverlays(prev => ({ ...prev, ...next }))}
              />
            )}

            {activeTab === 'environment' && (
              <EnvironmentControls
                world={world}
                onEnvironmentChange={handleEnvironmentChange}
              />
            )}

            {activeTab === 'statistics' && (
              <Statistics
                statsTracker={world.statsTracker}
                onUpdateSampleFrequency={handleUpdateSampleFrequency}
              />
            )}

            {activeTab === 'genealogy' && (
              <FamilyTree
                genealogyTracker={world.genealogyTracker}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
