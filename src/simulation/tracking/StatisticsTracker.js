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

  /**
   * Export statistics data as JSON
   * @returns {string} JSON string of all statistics data
   */
  exportJSON() {
    return JSON.stringify({
      metadata: {
        exportTime: Date.now(),
        dataPoints: this.data.time.length,
        sampleFrequency: this.sampleFrequency,
        maxDataPoints: this.maxDataPoints
      },
      data: this.data
    }, null, 2);
  }

  /**
   * Export statistics data as CSV
   * @returns {string} CSV formatted statistics data
   */
  exportCSV() {
    const headers = Object.keys(this.data);
    const rows = [];

    // Add header row
    rows.push(headers.join(','));

    // Add data rows
    const dataLength = this.data.time.length;
    for (let i = 0; i < dataLength; i++) {
      const row = headers.map(key => this.data[key][i]);
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  /**
   * Download statistics as a file
   * @param {string} format - 'json' or 'csv'
   * @param {string} filename - Optional custom filename
   */
  downloadData(format = 'json', filename = null) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const defaultFilename = `evo-wars-stats-${timestamp}.${format}`;
    const finalFilename = filename || defaultFilename;

    let content, mimeType;

    if (format === 'json') {
      content = this.exportJSON();
      mimeType = 'application/json';
    } else if (format === 'csv') {
      content = this.exportCSV();
      mimeType = 'text/csv';
    } else {
      throw new Error(`Unsupported format: ${format}`);
    }

    // Create blob and download
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = finalFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Get statistical summary of the data
   * @returns {Object} Summary statistics for each metric
   */
  getSummary() {
    const summary = {};

    for (const [key, values] of Object.entries(this.data)) {
      if (values.length === 0) {
        summary[key] = {
          min: 0,
          max: 0,
          mean: 0,
          current: 0,
          total: 0
        };
        continue;
      }

      const min = Math.min(...values);
      const max = Math.max(...values);
      const sum = values.reduce((acc, val) => acc + val, 0);
      const mean = sum / values.length;
      const current = values[values.length - 1];

      summary[key] = {
        min: Number(min.toFixed(2)),
        max: Number(max.toFixed(2)),
        mean: Number(mean.toFixed(2)),
        current: Number(current.toFixed(2)),
        total: Number(sum.toFixed(2))
      };
    }

    return summary;
  }

  /**
   * Downsample data to reduce number of points
   * Useful for long-running simulations
   * @param {number} targetPoints - Target number of data points
   */
  downsample(targetPoints = 250) {
    const currentLength = this.data.time.length;

    if (currentLength <= targetPoints) {
      return; // No need to downsample
    }

    const step = Math.floor(currentLength / targetPoints);
    const newData = {};

    // Initialize new data arrays
    for (const key in this.data) {
      newData[key] = [];
    }

    // Sample every 'step' points
    for (let i = 0; i < currentLength; i += step) {
      for (const key in this.data) {
        newData[key].push(this.data[key][i]);
      }
    }

    // Always include the last data point
    const lastIndex = currentLength - 1;
    if ((lastIndex % step) !== 0) {
      for (const key in this.data) {
        newData[key].push(this.data[key][lastIndex]);
      }
    }

    this.data = newData;
  }

  /**
   * Get data for a specific time range
   * @param {number} startTime - Start time in ms
   * @param {number} endTime - End time in ms
   * @returns {Object} Filtered data object
   */
  getDataInRange(startTime, endTime) {
    const filteredData = {};

    // Initialize arrays
    for (const key in this.data) {
      filteredData[key] = [];
    }

    // Filter data points within range
    for (let i = 0; i < this.data.time.length; i++) {
      const time = this.data.time[i];
      if (time >= startTime && time <= endTime) {
        for (const key in this.data) {
          filteredData[key].push(this.data[key][i]);
        }
      }
    }

    return filteredData;
  }

  /**
   * Set maximum data points to store
   * @param {number} maxPoints - Maximum number of data points
   */
  setMaxDataPoints(maxPoints) {
    this.maxDataPoints = Math.max(10, maxPoints);

    // Trim existing data if needed
    if (this.data.time.length > this.maxDataPoints) {
      this.downsample(this.maxDataPoints);
    }
  }
}
