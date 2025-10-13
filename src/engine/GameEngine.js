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
    this.fixedDeltaTime = 16; // Fixed time step in ms

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

    // Update with fixed time step
    while (this.accumulator >= this.fixedDeltaTime) {
      this.update(this.fixedDeltaTime);
      this.accumulator -= this.fixedDeltaTime;
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
}
