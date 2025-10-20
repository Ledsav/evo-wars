import { useEffect, useRef, useState } from 'react';
import './App.css';
import { CreatureViewer } from './components/CreatureViewer/CreatureViewer';
import { EnvironmentControls } from './components/EnvironmentControls/EnvironmentControls';
import { FamilyTree } from './components/FamilyTree/FamilyTree';
import { SettingsModal } from './components/Notifications/SettingsModal.jsx';
import { Toasts } from './components/Notifications/Toasts.jsx';
import { ScreenShotIcon } from './components/shared/Icons/Icons';
import { SimulationCanvas } from './components/SimulationCanvas/SimulationCanvas';
import { SimulationControls } from './components/SimulationControls/SimulationControls';
import { Statistics } from './components/Statistics/Statistics';
import { useNotifications } from './context/useNotifications';
import { GameEngine } from './engine/GameEngine';
import { World } from './simulation/world/World';
import { getRecommendedWorldSize, isMobileDevice } from './utils/mobileDetect';
import { downloadCanvas, timestampFilename } from './utils/screenshot';

const WIDTH_RESOLUTIONS = {low: 800, medium: 1280, high: 1920, ultra: 2560};
const HEIGHT_RESOLUTIONS = {low: 600, medium: 720, high: 1080, ultra: 1440};

function App() {
  
  const isMobile = isMobileDevice();
  const initialSize = isMobile 
    ? getRecommendedWorldSize() 
    : { width: WIDTH_RESOLUTIONS.ultra, height: HEIGHT_RESOLUTIONS.ultra };
  
  const [worldSize, setWorldSize] = useState(initialSize);
  const [world] = useState(() => {
    const w = new World(initialSize.width, initialSize.height);
    
    
    if (isMobile) {
      w.initialPopulation = 50; 
      w.initialFoodCount = window.innerWidth <= 480 ? 200 : 400; 
      w.updateBatchSize = 30; 
      w.foodSpawnRate = 0.3; 
    }
    
    return w;
  });
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
  const { notify } = useNotifications();
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const updateCounterRef = useRef(0);
  const lastUIUpdateRef = useRef(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  
  useEffect(() => {
    
    world.spawnInitialPopulation();

    
    gameEngine.setUpdateCallback(() => {
      updateCounterRef.current++;

      
      
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

    
    gameEngine.start();

    return () => {
      gameEngine.stop();
    };
  }, [world, gameEngine]);

  
  useEffect(() => {
    const gt = world.genealogyTracker;
    if (!gt) return;
    const onBorn = ({ speciesId, parentSpeciesId, node }) => {
      const info = node?.representative?.getSpeciesInfo?.();
      const name = info ? `${info.emoji} ${info.name}` : `Species ${String(speciesId).slice(0,6)}`;
      const parentInfo = parentSpeciesId && world.getSpeciesName ? world.getSpeciesName(parentSpeciesId) : null;
      const parent = parentInfo?.name;
      notify('species-born', parent ? `New species ${name} from ${parent}` : `New species ${name}`);
    };
    const onExtinct = ({ node }) => {
      const info = node?.representative?.getSpeciesInfo?.();
      const name = info ? `${info.emoji} ${info.name}` : `Species ${String(node.id).slice(0,6)}`;
      notify('species-extinct', `${name} went extinct`);
    };
    gt.on('species-born', onBorn);
    gt.on('species-extinct', onExtinct);
    return () => {
      gt.off('species-born', onBorn);
      gt.off('species-extinct', onExtinct);
    };
  }, [notify, world]);

  const handleEnvironmentChange = (params) => {
    if (params.restart) {
      world.spawnInitialPopulation();
      setHighlightedSpeciesId(null); 
    } else {
      world.setEnvironmentParams(params);
    }
    forceUpdate({});
  };

  const handleRestart = () => {
    world.spawnInitialPopulation();
    setHighlightedSpeciesId(null); 
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

    
    world.width = newSize.width;
    world.height = newSize.height;
    setWorldSize(newSize);

    
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

    
    world.width = newSize.width;
    world.height = newSize.height;
    setWorldSize(newSize);

    
    for (const organism of world.organisms) {
      organism.x = Math.min(organism.x, newSize.width - 20);
      organism.y = Math.min(organism.y, newSize.height - 20);
    }

    
    world.redistributeFood();

    forceUpdate({});
  };

  const handleZoomReset = () => {
    setZoom(1);
    const newSize = { width: WIDTH_RESOLUTIONS.ultra, height: HEIGHT_RESOLUTIONS.ultra };
    world.width = newSize.width;
    world.height = newSize.height;
    setWorldSize(newSize);

    
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

  const handleCaptureSimulation = () => {
    const canvas = canvasRef.current?.getCanvasElement?.();
    if (canvas) {
      const fname = timestampFilename('simulation');
      downloadCanvas(canvas, fname, (filename) => {
        notify('screenshot', `📸 Screenshot saved: ${filename}`, { timeout: 3000 });
      });
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
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="main-container">
        <div className="canvas-section" ref={containerRef}>
          <button
            className="floating-action camera"
            title="Save simulation screenshot"
            onClick={handleCaptureSimulation}
            aria-label="Save simulation screenshot"
          >
            <ScreenShotIcon size={18} />
          </button>
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
      <Toasts />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default App;
