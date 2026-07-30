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
import { loadEnvironmentSettings, loadSampleFrequency, saveEnvironmentSettings, saveSampleFrequency } from './utils/storage';

const DEFAULT_DISH_SIZE = 1440;

function App() {
  
  const isMobile = isMobileDevice();
  const recommendedSize = isMobile ? getRecommendedWorldSize() : null;
  const initialDishSize = recommendedSize
    ? Math.min(recommendedSize.width, recommendedSize.height)
    : DEFAULT_DISH_SIZE;
  const initialSize = { width: initialDishSize, height: initialDishSize };
  
  const [worldSize] = useState(initialSize);
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

  // Load saved environment settings and sample frequency on startup
  useEffect(() => {
    // Load environment settings
    loadEnvironmentSettings().then(savedSettings => {
      if (savedSettings) {
        console.log('Restoring environment settings from IndexedDB:', savedSettings);
        world.setEnvironmentParams(savedSettings);
        forceUpdate({}); // Force UI update to reflect loaded settings
      }
    }).catch(err => {
      console.error('Failed to load environment settings:', err);
    });

    // Load sample frequency
    loadSampleFrequency().then(savedFrequency => {
      if (savedFrequency !== null) {
        console.log('Restoring sample frequency from IndexedDB:', savedFrequency);
        world.statsTracker.setSampleFrequency(savedFrequency);
      }
    }).catch(err => {
      console.error('Failed to load sample frequency:', err);
    });
  }, [world]);


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

      // Auto-save environment settings to IndexedDB
      saveEnvironmentSettings(world.getEnvironmentParams()).catch(err => {
        console.error('Failed to save environment settings:', err);
      });
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
    canvasRef.current?.zoomIn?.();
  };

  const handleZoomOut = () => {
    canvasRef.current?.zoomOut?.();
  };

  const handleUpdateSampleFrequency = (frequency) => {
    world.statsTracker.setSampleFrequency(frequency);

    // Auto-save sample frequency to IndexedDB
    saveSampleFrequency(frequency).catch(err => {
      console.error('Failed to save sample frequency:', err);
    });
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
        onResetView={handleResetView}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="main-container">
        <div className="canvas-section" ref={containerRef}>
          <div className="chamber-readout" aria-hidden="true">
            <span className="status-lamp" />
            <span>Live culture</span>
            <span className="chamber-id">CH-{worldSize.width}×{worldSize.height}</span>
          </div>
          <button
            className="floating-action camera"
            title="Capture observation"
            onClick={handleCaptureSimulation}
            aria-label="Capture observation"
          >
            <ScreenShotIcon size={18} />
          </button>
          <SimulationCanvas
            world={world}
            width={worldSize.width}
            height={worldSize.height}
            highlightedSpeciesId={highlightedSpeciesId}
            overlays={overlays}
            onViewScaleChange={setZoom}
            ref={canvasRef}
          />
          <div className="chamber-scale" aria-hidden="true">
            <span className="scale-line" />
            <span>100 µm</span>
          </div>
        </div>

        <div className="sidebar">
          <div className="sidebar-heading">
            <div>
              <span className="eyebrow">Research console</span>
              <strong>Observation record</strong>
            </div>
            <span className="record-status">Recording</span>
          </div>
          <div className="tab-buttons">
            <button
              className={`tab-button ${activeTab === 'controls' ? 'active' : ''}`}
              onClick={() => setActiveTab('controls')}
            >
              Specimens
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
              Metrics
            </button>
            <button
              className={`tab-button ${activeTab === 'genealogy' ? 'active' : ''}`}
              onClick={() => setActiveTab('genealogy')}
            >
              Lineage
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
