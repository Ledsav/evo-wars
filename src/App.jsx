import { useState, useEffect, useRef } from 'react';
import { World } from './core/world/World';
import { Organism } from './core/organisms/Organism';
import { GameEngine } from './engine/GameEngine';
import { SimulationCanvas } from './components/SimulationCanvas';
import { DNAEditor } from './components/DNAEditor';
import { ControlPanel } from './components/ControlPanel';
import './App.css';

function App() {
  const [world] = useState(() => new World(800, 600));
  const [playerOrganism, setPlayerOrganism] = useState(null);
  const [gameEngine] = useState(() => new GameEngine(world));
  const [, forceUpdate] = useState({});
  const [activeTab, setActiveTab] = useState('stats');
  const [gameStarted, setGameStarted] = useState(false);
  const canvasRef = useRef(null);

  // Initialize game
  useEffect(() => {
    if (!gameStarted) return;

    // Create player organism
    const player = new Organism(400, 300);
    player.isPlayer = true;
    world.setPlayerOrganism(player);
    setPlayerOrganism(player);

    // Spawn minimal initial food
    world.spawnRandomFood(5);

    // Setup game engine callbacks
    gameEngine.setUpdateCallback(() => {
      // Make organism move autonomously with simple AI
      const currentPlayer = world.playerOrganism;
      if (currentPlayer && currentPlayer.isAlive) {
        // Find nearest food
        let nearestFood = null;
        let nearestDistance = Infinity;

        for (const food of world.foodParticles) {
          const dx = food.x - currentPlayer.x;
          const dy = food.y - currentPlayer.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestFood = food;
          }
        }

        // Move toward nearest food
        if (nearestFood) {
          const dx = nearestFood.x - currentPlayer.x;
          const dy = nearestFood.y - currentPlayer.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > 0) {
            currentPlayer.move(dx / distance, dy / distance);
          }
        }
      }

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
  }, [world, gameEngine, gameStarted]);

  const handleSpawnFood = () => {
    world.spawnRandomFood(5);
  };

  const handleSpawnOrganism = () => {
    const x = Math.random() * world.width;
    const y = Math.random() * world.height;
    const organism = new Organism(x, y);
    world.addOrganism(organism);
  };

  const handleTogglePause = () => {
    world.togglePause();
    forceUpdate({});
  };

  const handleMutate = (result) => {
    console.log('Mutation applied:', result.description);
    forceUpdate({});
  };

  const startGame = () => {
    setGameStarted(true);
  };

  // Start screen
  if (!gameStarted) {
    return (
      <div className="start-screen">
        <div className="start-container">
          <h1 className="title-large">🧬 Evo Wars</h1>
          <p className="subtitle-large">Evolution Simulator</p>

          <div className="start-content">
            <div className="start-section">
              <h2>🎯 Your Goal</h2>
              <p>Evolve your organism through DNA mutations to survive as long as possible!</p>
            </div>

            <div className="start-section">
              <h2>🎮 How It Works</h2>
              <ul>
                <li>Your organism moves <strong>automatically</strong> toward food</li>
                <li>Eating food gives you <strong>energy</strong> and <strong>DNA points</strong></li>
                <li>Use DNA points to <strong>mutate genes</strong> and evolve new traits</li>
                <li>Each gene affects specific abilities (size, speed, defense, etc.)</li>
              </ul>
            </div>

            <div className="start-section">
              <h2>🧬 Mutation Strategy</h2>
              <p><strong>Protein Properties Guide:</strong></p>
              <div className="strategy-grid">
                <div className="strategy-item">
                  <strong>🟢 For More Size:</strong>
                  <span>Increase protein length (add bases with Insertion/Duplication)</span>
                </div>
                <div className="strategy-item">
                  <strong>⚡ For More Speed:</strong>
                  <span>Add small amino acids (AGS bases = tiny, flexible proteins)</span>
                </div>
                <div className="strategy-item">
                  <strong>🛡️ For Defense:</strong>
                  <span>Add aromatic amino acids (FYW bases = toxicity, armor)</span>
                </div>
                <div className="strategy-item">
                  <strong>🔥 For Better Metabolism:</strong>
                  <span>Balance charged amino acids (K,R,H vs D,E bases)</span>
                </div>
              </div>
            </div>

            <div className="start-section">
              <h2>💡 Quick Tips</h2>
              <ul>
                <li><strong>Point Mutation (1 pt):</strong> Safe way to tweak one base</li>
                <li><strong>Insertion (2 pts):</strong> Add bases to increase protein length</li>
                <li><strong>Duplication (3 pts):</strong> Copy segments to amplify traits</li>
                <li><strong>Deletion (2 pts):</strong> Remove bases to reduce traits</li>
              </ul>
            </div>
          </div>

          <button className="start-button" onClick={startGame}>
            🚀 Start Evolution
          </button>
        </div>
      </div>
    );
  }

  // Game screen - no title, compact layout
  return (
    <div className="app game-mode">
      <div className="main-container">
        {/* Left side - Canvas */}
        <div className="canvas-section">
          <SimulationCanvas world={world} width={800} height={600} ref={canvasRef} />
        </div>

        {/* Right side - Tabbed interface */}
        <div className="sidebar">
          <div className="tab-buttons">
            <button
              className={`tab-button ${activeTab === 'stats' ? 'active' : ''}`}
              onClick={() => setActiveTab('stats')}
            >
              📊 Stats
            </button>
            <button
              className={`tab-button ${activeTab === 'dna' ? 'active' : ''}`}
              onClick={() => setActiveTab('dna')}
            >
              🧬 Mutate
            </button>
            <button
              className={`tab-button ${activeTab === 'guide' ? 'active' : ''}`}
              onClick={() => setActiveTab('guide')}
            >
              📖 Guide
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'stats' && (
              <div>
                <ControlPanel
                  world={world}
                  organism={playerOrganism}
                  onSpawnFood={handleSpawnFood}
                  onSpawnOrganism={handleSpawnOrganism}
                  onTogglePause={handleTogglePause}
                />
              </div>
            )}

            {activeTab === 'dna' && (
              <DNAEditor organism={playerOrganism} onMutate={handleMutate} />
            )}

            {activeTab === 'guide' && (
              <div className="guide-content">
                <h2>🎯 Mutation Strategy Guide</h2>

                <div className="guide-section">
                  <h3>Understanding Protein Properties</h3>
                  <p>Each DNA sequence codes for a protein with chemical properties. These properties directly affect your organism's traits:</p>
                </div>

                <div className="guide-section">
                  <h3>🧪 Amino Acid Types (what your DNA creates)</h3>
                  <div className="amino-list">
                    <div><strong>Tiny (A,G,S):</strong> Make proteins flexible → ⚡ Speed</div>
                    <div><strong>Small (A,B,C,D,G,N,P,S,T,V):</strong> Flexible → ⚡ Speed</div>
                    <div><strong>Large (E,F,H,I,K,L,M,Q,R,W,Y):</strong> Structural → 🟢 Size</div>
                    <div><strong>Aromatic (F,Y,W):</strong> Complex rings → 🛡️ Defense/Toxicity</div>
                    <div><strong>Hydrophobic (A,I,L,M,F,W,V,P):</strong> Water-repelling → 🛡️ Armor</div>
                    <div><strong>Charged (K,R,H,D,E):</strong> Reactive → 🔥 Metabolism</div>
                  </div>
                </div>

                <div className="guide-section">
                  <h3>📊 Gene → Protein → Trait</h3>
                  <div className="gene-effects">
                    <div className="effect-item">
                      <strong>SIZE Gene:</strong>
                      <span>Protein length × 0.8 = organism size</span>
                      <em>Strategy: Duplicate segments to make it longer</em>
                    </div>
                    <div className="effect-item">
                      <strong>SPEED Gene:</strong>
                      <span>Flexibility (tiny + small amino acids) = speed</span>
                      <em>Strategy: Add A, G, S bases (code for tiny amino acids)</em>
                    </div>
                    <div className="effect-item">
                      <strong>DEFENSE Gene:</strong>
                      <span>Hydrophobic = armor, Aromatic (>2) = toxicity</span>
                      <em>Strategy: Add F, Y, W for toxicity; A, I, L, M for armor</em>
                    </div>
                    <div className="effect-item">
                      <strong>METABOLISM Gene:</strong>
                      <span>Charge balance = metabolic rate, Hydrophobic ratio = efficiency</span>
                      <em>Strategy: Balance K,R,H vs D,E bases for metabolism</em>
                    </div>
                  </div>
                </div>

                <div className="guide-section">
                  <h3>💡 Practical Examples</h3>
                  <div className="examples">
                    <div className="example-item">
                      <strong>Want to go faster?</strong>
                      <p>1. Go to DNA Editor → Select SPEED gene</p>
                      <p>2. Choose "Insertion" mutation</p>
                      <p>3. Click anywhere in the sequence</p>
                      <p>4. Hope it adds A, G, or S (tiny amino acids)</p>
                      <p>5. Check protein stats - more "Tiny" = more speed!</p>
                    </div>
                    <div className="example-item">
                      <strong>Want to be bigger?</strong>
                      <p>1. Go to SIZE gene</p>
                      <p>2. Use "Duplication" to copy a segment</p>
                      <p>3. Longer protein = bigger organism</p>
                    </div>
                    <div className="example-item">
                      <strong>Want defense?</strong>
                      <p>1. Go to DEFENSE gene</p>
                      <p>2. Try mutations until you get F, Y, or W</p>
                      <p>3. More aromatics = toxicity appears!</p>
                    </div>
                  </div>
                </div>

                <div className="quick-controls">
                  <button className="control-btn" onClick={handleTogglePause}>
                    {world.isPaused ? '▶️ Resume' : '⏸️ Pause'}
                  </button>
                  <button className="control-btn" onClick={handleSpawnFood}>
                    🍃 Spawn Food
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
