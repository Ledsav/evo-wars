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
    this.maxFrameDelta = 100;
    this.maxUpdatesPerFrame = 5;
    this.lastRenderTime = 0;
    this.animationFrameId = null;
    this.isFastForwarding = false;
    this.boundLoop = this.loop.bind(this);
    this.boundVisibilityChange = this.handleVisibilityChange.bind(this);

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
    this.lastRenderTime = this.lastTime;
    this.accumulator = 0;
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.boundVisibilityChange);
    }
    this.animationFrameId = requestAnimationFrame(this.boundLoop);
  }

  /**
   * Stop the game loop
   */
  stop() {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.boundVisibilityChange);
    }
    this.accumulator = 0;
  }

  /**
   * Main game loop using fixed time step
   */
  loop(currentTime = performance.now()) {
    if (!this.isRunning) return;

    if (this.isFastForwarding) {
      this.lastTime = currentTime;
      this.accumulator = 0;
      this.animationFrameId = requestAnimationFrame(this.boundLoop);
      return;
    }

    if (typeof document !== 'undefined' && document.hidden) {
      this.lastTime = currentTime;
      this.accumulator = 0;
      this.animationFrameId = requestAnimationFrame(this.boundLoop);
      return;
    }

    const rawDeltaTime = currentTime - this.lastTime;
    const deltaTime = Math.min(Math.max(0, rawDeltaTime), this.maxFrameDelta);
    this.lastTime = currentTime;

    this.accumulator += deltaTime;

    let updates = 0;
    while (
      this.accumulator >= this.baseFixedDeltaTime &&
      updates < this.maxUpdatesPerFrame
    ) {
      this.update(this.baseFixedDeltaTime * this.simulationSpeed);
      this.accumulator -= this.baseFixedDeltaTime;
      updates++;
    }

    if (updates === this.maxUpdatesPerFrame) {
      this.accumulator = Math.min(this.accumulator, this.baseFixedDeltaTime);
    }

    const renderInterval = 1000 / this.getTargetRenderFps();
    if (currentTime - this.lastRenderTime >= renderInterval - 1) {
      this.render();
      this.lastRenderTime = currentTime;
    }

    this.animationFrameId = requestAnimationFrame(this.boundLoop);
  }

  /**
   * Reset timing when browser visibility changes so hidden time is never replayed.
   */
  handleVisibilityChange() {
    this.lastTime = performance.now();
    this.lastRenderTime = this.lastTime;
    this.accumulator = 0;
  }

  /**
   * Reduce render frequency as populations grow while keeping simulation updates stable.
   */
  getTargetRenderFps() {
    const population = this.world.organisms.length;
    if (population >= 1200) return 24;
    if (population >= 700) return 30;
    if (population >= 250) return 45;
    return 60;
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

  async fastForwardDays(days, options = {}) {
    if (this.isFastForwarding) return null;

    const dayCount = Math.max(1, Math.min(1000, Math.floor(days)));
    const epochsPerDay = 24;
    const epochCount = dayCount * epochsPerDay;
    const calendarDelta = 86400000 / epochsPerDay;
    const dynamicsDelta = 250;
    this.isFastForwarding = true;

    try {
      for (let epoch = 0; epoch < epochCount; epoch++) {
        const recordStats =
          (epoch + 1) % epochsPerDay === 0 ||
          epoch === epochCount - 1;
        this.world.update(dynamicsDelta, {
          force: true,
          offline: true,
          calendarDelta,
          recordStats
        });

        if (recordStats) {
          options.onProgress?.((epoch + 1) / epochCount);
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      this.onUpdate?.(0, { forceUI: true, offline: true });
      this.render();
      return {
        days: dayCount,
        epochs: epochCount,
        stats: this.world.getStats()
      };
    } finally {
      this.isFastForwarding = false;
      this.lastTime = performance.now();
      this.lastRenderTime = this.lastTime;
      this.accumulator = 0;
    }
  }
}
