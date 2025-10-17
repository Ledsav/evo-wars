/**
 * StatisticsTracker - Tracks time-series data for simulation statistics
 * Collects data at configurable intervals to avoid performance overhead
 */
export class StatisticsTracker {
  constructor(sampleFrequency = 0.01) {
    // sampleFrequency: percentage of time to sample (0.01 = 1% = every ~10ms at 60fps)
    this.sampleFrequency = sampleFrequency;
    this.lastSampleTime = 0;
    this.maxDataPoints = 500; // Maximum number of data points to store

    // Time-series data arrays
    this.data = {
      time: [],
      aliveOrganisms: [],
      speciesCount: [],
      topSpeciesCount: [],
      foodCount: [],
      averageEnergy: [],
      combatKills: [], // Cumulative combat kills over time
    };

    // Cumulative counters (not reset between samples)
    this.totalCombatKills = 0;
  }

  /**
   * Calculate sample interval in milliseconds based on frequency
   * At 60fps (16.67ms per frame), 5% frequency = sample every ~333ms (20 frames)
   */
  getSampleInterval() {
    const frameTime = 16.67; // Assume 60fps
    return frameTime / this.sampleFrequency;
  }

  /**
   * Set sampling frequency (0-1, where 0.05 = 5%)
   */
  setSampleFrequency(frequency) {
    this.sampleFrequency = Math.max(0.001, Math.min(1, frequency));
  }

  /**
   * Check if it's time to sample based on frequency
   */
  shouldSample(currentTime) {
    const interval = this.getSampleInterval();
    return currentTime - this.lastSampleTime >= interval;
  }

  /**
   * Collect statistics from the world
   */
  collectStats(world) {
    const currentTime = performance.now();

    // Check if we should sample at this time
    if (!this.shouldSample(currentTime)) {
      return;
    }

    this.lastSampleTime = currentTime;

    // Get species information
    const speciesMap = new Map();
    const aliveOrganisms = world.organisms.filter(org => org.isAlive);

    for (const org of aliveOrganisms) {
      const speciesId = org.getSpeciesId();
      if (!speciesMap.has(speciesId)) {
        speciesMap.set(speciesId, 0);
      }
      speciesMap.set(speciesId, speciesMap.get(speciesId) + 1);
    }

    // Find top species (most populous)
    let topSpeciesCount = 0;
    if (speciesMap.size > 0) {
      topSpeciesCount = Math.max(...speciesMap.values());
    }

    // Calculate average energy
    const averageEnergy = aliveOrganisms.length > 0
      ? aliveOrganisms.reduce((sum, org) => sum + org.energy, 0) / aliveOrganisms.length
      : 0;

    // Update cumulative combat kills from world
    if (world.combatKills !== undefined) {
      this.totalCombatKills = world.combatKills;
    }

    // Add data points
    this.data.time.push(world.time);
    this.data.aliveOrganisms.push(aliveOrganisms.length);
    this.data.speciesCount.push(speciesMap.size);
    this.data.topSpeciesCount.push(topSpeciesCount);
    this.data.foodCount.push(world.foodParticles.length);
    this.data.averageEnergy.push(averageEnergy);
    this.data.combatKills.push(this.totalCombatKills);

    // Limit data points to prevent memory issues
    if (this.data.time.length > this.maxDataPoints) {
      const removeCount = this.data.time.length - this.maxDataPoints;
      for (const key in this.data) {
        this.data[key].splice(0, removeCount);
      }
    }
  }

  /**
   * Get all collected data
   */
  getData() {
    return this.data;
  }

  /**
   * Get the latest values
   */
  getLatestValues() {
    const len = this.data.time.length;
    if (len === 0) {
      return {
        time: 0,
        aliveOrganisms: 0,
        speciesCount: 0,
        topSpeciesCount: 0,
        foodCount: 0,
        averageEnergy: 0,
        combatKills: 0,
      };
    }

    return {
      time: this.data.time[len - 1],
      aliveOrganisms: this.data.aliveOrganisms[len - 1],
      speciesCount: this.data.speciesCount[len - 1],
      topSpeciesCount: this.data.topSpeciesCount[len - 1],
      foodCount: this.data.foodCount[len - 1],
      averageEnergy: this.data.averageEnergy[len - 1],
      combatKills: this.data.combatKills[len - 1],
    };
  }

  /**
   * Clear all collected data
   */
  clear() {
    for (const key in this.data) {
      this.data[key] = [];
    }
    this.lastSampleTime = 0;
    this.totalCombatKills = 0;
  }

  /**
   * Get data point count
   */
  getDataPointCount() {
    return this.data.time.length;
  }
}
