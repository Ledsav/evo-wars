/**
 * GameEngine - Main game loop and state management
 * Handles timing, updates, and coordination between systems
 */
export class GameEngine {
  constructor(world) {
    this.world = world;
    this.isRunning = false;
    this.lastTime = 0;
    this.fps = 60;
    this.frameTime = 1000 / this.fps;
    this.accumulator = 0;
    this.baseFixedDeltaTime = 16; // Base fixed time step in ms
    this.fixedDeltaTime = 16; // Current time step (affected by speed)
    this.simulationSpeed = 1; // Speed multiplier (0.25x, 0.5x, 1x, 2x, 4x)

    // Callbacks
    this.onUpdate = null;
    this.onRender = null;
  }

  /**
   * Start the game loop
   */
  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastTime = performance.now();
    this.loop();
  }

  /**
   * Stop the game loop
   */
  stop() {
    this.isRunning = false;
  }

  /**
   * Main game loop using fixed time step
   */
  loop() {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // Accumulate frame time
    this.accumulator += deltaTime;

    // Update with fixed time step (applying speed multiplier)
    while (this.accumulator >= this.baseFixedDeltaTime) {
      // Pass scaled deltaTime to update (this affects simulation speed)
      this.update(this.baseFixedDeltaTime * this.simulationSpeed);
      this.accumulator -= this.baseFixedDeltaTime;
    }

    // Render
    this.render();

    // Continue loop
    requestAnimationFrame(() => this.loop());
  }

  /**
   * Update game state
   */
  update(deltaTime) {
    // Update world
    this.world.update(deltaTime);

    // Call update callback
    if (this.onUpdate) {
      this.onUpdate(deltaTime);
    }
  }

  /**
   * Render frame
   */
  render() {
    if (this.onRender) {
      this.onRender();
    }
  }

  /**
   * Set update callback
   */
  setUpdateCallback(callback) {
    this.onUpdate = callback;
  }

  /**
   * Set render callback
   */
  setRenderCallback(callback) {
    this.onRender = callback;
  }

  /**
   * Set simulation speed
   * @param {number} speed - Speed multiplier (0.25, 0.5, 1, 2, 4)
   */
  setSimulationSpeed(speed) {
    this.simulationSpeed = Math.max(0.25, Math.min(4, speed));
    this.fixedDeltaTime = this.baseFixedDeltaTime * this.simulationSpeed;
  }

  /**
   * Get current simulation speed
   */
  getSimulationSpeed() {
    return this.simulationSpeed;
  }
}
