import { Genome } from '../../core/genetics/Genome.js';
import { Organism } from '../../core/organisms/Organism.js';
import { OrganismAI } from '../ai/OrganismAI.js';
import { ObjectPool } from '../../engine/performance/ObjectPool.js';
import { StatisticsTracker } from '../tracking/StatisticsTracker.js';
import { GenealogyTracker } from '../tracking/GenealogyTracker.js';

/**
 * World - Contains all organisms and handles simulation
 * Manages game state, collisions, and interactions
 */
export class World {
  constructor(width = 800, height = 600) {
    this.width = width;
    this.height = height;
    this.organisms = [];
    this.organismAIs = new Map(); // Map organism to AI
    this.playerOrganism = null;
    this.time = 0;
    this.isPaused = false;

    // World resources
    this.foodParticles = [];

    // Environment parameters
    this.foodSpawnRate = 0.5;
    this.temperature = 1.0;
    this.mutationRate = 0.05;
    this.initialPopulation = 10;
    this.initialFoodCount = 30; // Increased from 10 to 30
    this.initialSpecies = 1;

    // Spatial hash grid for collision optimization
    this.cellSize = 100; // Grid cell size in pixels
    this.grid = new Map(); // Map of "x,y" -> Set of organisms
    this.foodGrid = new Map(); // Map of "x,y" -> Set of food particles

    // Staggered update system
    this.updateBatchSize = 50; // Update AI for N organisms per frame
    this.currentUpdateIndex = 0;

    // Object pooling for food particles
    this.foodPool = new ObjectPool(
      () => ({ x: 0, y: 0, energy: 0, radius: 0 }), // Factory
      (food) => { // Reset function
        food.x = 0;
        food.y = 0;
        food.energy = 0;
        food.radius = 0;
      },
      100 // Initial pool size
    );

    // Statistics tracking (5% sample frequency by default)
    this.statsTracker = new StatisticsTracker(0.05);

    // Genealogy tracking for species family tree
    this.genealogyTracker = new GenealogyTracker();

    // Combat statistics
    this.combatKills = 0;
  }



  /**
   * Get grid cell key for position
   */
  getCellKey(x, y) {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  /**
   * Get all grid cells within a radius
   */
  getCellsInRadius(x, y, radius) {
    const minCellX = Math.floor((x - radius) / this.cellSize);
    const maxCellX = Math.floor((x + radius) / this.cellSize);
    const minCellY = Math.floor((y - radius) / this.cellSize);
    const maxCellY = Math.floor((y + radius) / this.cellSize);

    const cells = [];
    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        cells.push(`${cx},${cy}`);
      }
    }
    return cells;
  }

  /**
   * Add organism to spatial grid
   */
  addToGrid(organism) {
    const key = this.getCellKey(organism.x, organism.y);
    if (!this.grid.has(key)) {
      this.grid.set(key, new Set());
    }
    this.grid.get(key).add(organism);
    organism._gridCell = key; // Cache current cell
  }

  /**
   * Remove organism from spatial grid
   */
  removeFromGrid(organism) {
    if (organism._gridCell) {
      const cell = this.grid.get(organism._gridCell);
      if (cell) {
        cell.delete(organism);
        if (cell.size === 0) {
          this.grid.delete(organism._gridCell);
        }
      }
      organism._gridCell = null;
    }
  }

  /**
   * Update organism's grid position
   */
  updateGrid(organism) {
    const newKey = this.getCellKey(organism.x, organism.y);
    if (organism._gridCell !== newKey) {
      this.removeFromGrid(organism);
      this.addToGrid(organism);
    }
  }

  /**
   * Add food to spatial grid
   */
  addFoodToGrid(food) {
    const key = this.getCellKey(food.x, food.y);
    if (!this.foodGrid.has(key)) {
      this.foodGrid.set(key, new Set());
    }
    this.foodGrid.get(key).add(food);
  }

  /**
   * Remove food from spatial grid
   */
  removeFoodFromGrid(food, x, y) {
    const key = this.getCellKey(x, y);
    const cell = this.foodGrid.get(key);
    if (cell) {
      cell.delete(food);
      if (cell.size === 0) {
        this.foodGrid.delete(key);
      }
    }
  }

  /**
   * Add organism to world with AI
   */
  addOrganism(organism) {
    // Keep organism within bounds
    organism.x = Math.max(organism.phenotype.size, Math.min(this.width - organism.phenotype.size, organism.x));
    organism.y = Math.max(organism.phenotype.size, Math.min(this.height - organism.phenotype.size, organism.y));

    this.organisms.push(organism);
    this.addToGrid(organism);

    // Create AI for organism if not player
    if (!organism.isPlayer) {
      this.organismAIs.set(organism, new OrganismAI(organism, this));
    }
  }

  /**
   * Remove organism from world
   */
  removeOrganism(organism) {
    const index = this.organisms.indexOf(organism);
    if (index > -1) {
      this.organisms.splice(index, 1);
      this.removeFromGrid(organism);
      this.organismAIs.delete(organism);
    }
  }

  /**
   * Add food particle (uses object pooling)
   */
  addFood(x, y, energy = 20) {
    const food = this.foodPool.acquire();
    food.x = x;
    food.y = y;
    food.energy = energy;
    food.radius = 5 + energy / 10;

    this.foodParticles.push(food);
    this.addFoodToGrid(food);
  }

  /**
   * Spawn random food
   */
  spawnRandomFood(count = 1) {
    for (let i = 0; i < count; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      const energy = 10 + Math.random() * 20;
      this.addFood(x, y, energy);
    }
  }

  /**
   * Spawn a cluster/patch of food at a location
   */
  spawnFoodCluster(centerX, centerY, count = 5, spread = 80) {
    for (let i = 0; i < count; i++) {
      // Use gaussian-like distribution for more realistic clustering
      const angle = Math.random() * Math.PI * 2;
      const distance = (Math.random() + Math.random()) / 2 * spread; // Triangular distribution

      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;

      // Keep within bounds
      const clampedX = Math.max(20, Math.min(this.width - 20, x));
      const clampedY = Math.max(20, Math.min(this.height - 20, y));

      const energy = 15 + Math.random() * 15;
      this.addFood(clampedX, clampedY, energy);
    }
  }

  /**
   * Spawn random food clusters
   */
  spawnRandomFoodClusters(clusterCount = 1, foodPerCluster = 5) {
    for (let i = 0; i < clusterCount; i++) {
      const centerX = Math.random() * this.width;
      const centerY = Math.random() * this.height;
      this.spawnFoodCluster(centerX, centerY, foodPerCluster);
    }
  }

  /**
   * Update world (called each frame)
   */
  update(deltaTime) {
    if (this.isPaused) return;

    this.time += deltaTime;

    // Update all organisms (physics only)
    for (const organism of this.organisms) {
      // Apply temperature effect to metabolism
      const tempModifiedDelta = deltaTime * this.temperature;
      organism.update(tempModifiedDelta);

      // Update spatial grid position
      this.updateGrid(organism);
    }

    // Staggered AI updates (only update a batch per frame)
    const batchSize = Math.min(this.updateBatchSize, this.organisms.length);
    const startIdx = this.currentUpdateIndex;

    for (let i = 0; i < batchSize; i++) {
      const idx = (startIdx + i) % this.organisms.length;
      const organism = this.organisms[idx];

      if (!organism) continue;

      const ai = this.organismAIs.get(organism);
      if (ai) {
        ai.update(deltaTime);

        // Try to reproduce
        const offspring = ai.tryReproduce();
        if (offspring) {
          this.addOrganism(offspring);
        }
      }
    }

    // Move to next batch for next frame
    this.currentUpdateIndex = (this.currentUpdateIndex + batchSize) % Math.max(1, this.organisms.length);

    // Handle collisions
    this.handleCollisions();

    // Handle food consumption
    this.handleFoodConsumption();

    // Remove dead organisms
    this.removeDeadOrganisms();

    // Keep organisms in bounds
    this.keepOrganismsInBounds();

    // Spawn food based on food spawn rate
    const maxFood = Math.floor(30 + this.foodSpawnRate * 50); // Increased from 10+20 to 30+50

    // Spawn food clusters (more realistic food distribution)
    const clusterSpawnChance = 0.003 * deltaTime * this.foodSpawnRate; // 3x more likely
    if (this.foodParticles.length < maxFood && Math.random() < clusterSpawnChance) {
      // 70% chance of cluster, 30% chance of single food
      if (Math.random() < 0.7) {
        const clusterSize = 3 + Math.floor(Math.random() * 5); // 3-7 food items per cluster
        this.spawnRandomFoodClusters(1, clusterSize);
      } else {
        this.spawnRandomFood(1);
      }
    }

    // Collect statistics
    this.statsTracker.collectStats(this);

    // Update genealogy tracking
    this.genealogyTracker.update(this);
  }

  /**
   * Handle collisions between organisms (optimized with spatial grid)
   */
  handleCollisions() {
    const checked = new Set(); // Track checked pairs

    for (const organism of this.organisms) {
      if (!organism.isAlive) continue;

      // Get nearby organisms from spatial grid
      const cellKeys = this.getCellsInRadius(organism.x, organism.y, organism.phenotype.size * 3);

      for (const key of cellKeys) {
        const cell = this.grid.get(key);
        if (!cell) continue;

        for (const other of cell) {
          if (other === organism || !other.isAlive) continue;

          // Create unique pair ID (smaller ID first)
          const pairId = organism.id < other.id
            ? `${organism.id}-${other.id}`
            : `${other.id}-${organism.id}`;

          // Skip if already checked this pair
          if (checked.has(pairId)) continue;
          checked.add(pairId);

          // Check collision using squared distance (faster)
          const dx = organism.x - other.x;
          const dy = organism.y - other.y;
          const distSq = dx * dx + dy * dy;
          const minDist = organism.phenotype.size + other.phenotype.size;

          if (distSq < minDist * minDist) {
            this.resolveCollision(organism, other);
          }
        }
      }
    }
  }

  /**
   * Resolve collision between two organisms
   */
  resolveCollision(org1, org2) {
    // Check if parent-child relationship exists
    if (org1.isParentChildRelation(org2)) {
      // Just push apart, no combat
      this.pushOrganismsApart(org1, org2);
      return;
    }

    // Get AI states
    const ai1 = this.organismAIs.get(org1);
    const ai2 = this.organismAIs.get(org2);
    const org1Attacking = ai1 && ai1.state === 'attacking';
    const org2Attacking = ai2 && ai2.state === 'attacking';

    // Only apply combat if at least one is in attacking state
    if (!org1Attacking && !org2Attacking) {
      // Just push apart, no combat
      this.pushOrganismsApart(org1, org2);
      return;
    }

    // Combat: larger/more toxic organism damages smaller one
    const power1 = org1.phenotype.size + org1.phenotype.toxicity * 10;
    const power2 = org2.phenotype.size + org2.phenotype.toxicity * 10;

    // Only the attacker deals damage
    if (org1Attacking && power1 > power2) {
      org2.takeDamage(5);
      if (!org2.isAlive) {
        // Winner consumes loser
        org1.consume(org2.phenotype.size * 10);
        this.combatKills++;
      }
    } else if (org2Attacking && power2 > power1) {
      org1.takeDamage(5);
      if (!org1.isAlive) {
        org2.consume(org1.phenotype.size * 10);
        this.combatKills++;
      }
    } else if (org1Attacking && org2Attacking) {
      // Both attacking - mutual combat
      if (power1 > power2) {
        org2.takeDamage(5);
        if (!org2.isAlive) {
          org1.consume(org2.phenotype.size * 10);
          this.combatKills++;
        }
      } else if (power2 > power1) {
        org1.takeDamage(5);
        if (!org1.isAlive) {
          org2.consume(org1.phenotype.size * 10);
          this.combatKills++;
        }
      } else {
        // Equal power - both take damage
        org1.takeDamage(3);
        org2.takeDamage(3);
      }
    }

    // Push organisms apart
    this.pushOrganismsApart(org1, org2);
  }

  /**
   * Push two organisms apart to prevent overlap
   */
  pushOrganismsApart(org1, org2) {
    const dx = org2.x - org1.x;
    const dy = org2.y - org1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = org1.phenotype.size + org2.phenotype.size;

    if (distance < minDistance && distance > 0) {
      const pushForce = (minDistance - distance) / 2;
      const nx = dx / distance;
      const ny = dy / distance;

      org1.x -= nx * pushForce;
      org1.y -= ny * pushForce;
      org2.x += nx * pushForce;
      org2.y += ny * pushForce;
    }
  }

  /**
   * Handle food consumption (optimized with spatial grid)
   */
  handleFoodConsumption() {
    const consumedFood = new Set();

    for (const organism of this.organisms) {
      if (!organism.isAlive) continue;

      // Get nearby food from spatial grid
      const cellKeys = this.getCellsInRadius(organism.x, organism.y, organism.phenotype.size + 20);

      for (const key of cellKeys) {
        const cell = this.foodGrid.get(key);
        if (!cell) continue;

        for (const food of cell) {
          if (consumedFood.has(food)) continue;

          // Use squared distance (faster)
          const dx = organism.x - food.x;
          const dy = organism.y - food.y;
          const distSq = dx * dx + dy * dy;
          const minDist = organism.phenotype.size + food.radius;

          if (distSq < minDist * minDist) {
            organism.consume(food.energy);
            consumedFood.add(food);
            break; // Organism can only eat one food per frame
          }
        }

        if (consumedFood.size > 0 && consumedFood.has([...cell][cell.size - 1])) {
          break; // Already found food for this organism
        }
      }
    }

    // Remove consumed food and return to pool
    for (const food of consumedFood) {
      const index = this.foodParticles.indexOf(food);
      if (index > -1) {
        this.foodParticles.splice(index, 1);
        this.removeFoodFromGrid(food, food.x, food.y);
        this.foodPool.release(food); // Return to pool
      }
    }
  }

  /**
   * Remove dead organisms
   */
  removeDeadOrganisms() {
    // Convert dead organisms to food
    for (let i = this.organisms.length - 1; i >= 0; i--) {
      const organism = this.organisms[i];
      if (!organism.isAlive && organism !== this.playerOrganism) {
        // Leave food behind
        this.addFood(organism.x, organism.y, organism.phenotype.size * 5);
        this.organisms.splice(i, 1);
      }
    }
  }

  /**
   * Keep organisms within world bounds
   */
  keepOrganismsInBounds() {
    for (const organism of this.organisms) {
      const size = organism.phenotype.size;

      if (organism.x < size) {
        organism.x = size;
        organism.vx = Math.abs(organism.vx) * 0.5;
      } else if (organism.x > this.width - size) {
        organism.x = this.width - size;
        organism.vx = -Math.abs(organism.vx) * 0.5;
      }

      if (organism.y < size) {
        organism.y = size;
        organism.vy = Math.abs(organism.vy) * 0.5;
      } else if (organism.y > this.height - size) {
        organism.y = this.height - size;
        organism.vy = -Math.abs(organism.vy) * 0.5;
      }
    }
  }

  /**
   * Get all alive organisms
   */
  getAliveOrganisms() {
    return this.organisms.filter(org => org.isAlive);
  }

  /**
   * Get organisms near a position (optimized with spatial grid)
   */
  getOrganismsNear(x, y, radius) {
    const nearby = [];
    const cellKeys = this.getCellsInRadius(x, y, radius);
    const radiusSq = radius * radius; // Use squared distance

    for (const key of cellKeys) {
      const cell = this.grid.get(key);
      if (!cell) continue;

      for (const org of cell) {
        if (!org.isAlive) continue;

        // Use squared distance (faster - no sqrt)
        const dx = org.x - x;
        const dy = org.y - y;
        const distSq = dx * dx + dy * dy;

        if (distSq <= radiusSq) {
          nearby.push(org);
        }
      }
    }

    return nearby;
  }

  /**
   * Get food particles near a position (optimized with spatial grid)
   */
  getFoodNear(x, y, radius) {
    const nearby = [];
    const cellKeys = this.getCellsInRadius(x, y, radius);
    const radiusSq = radius * radius;

    for (const key of cellKeys) {
      const cell = this.foodGrid.get(key);
      if (!cell) continue;

      for (const food of cell) {
        const dx = food.x - x;
        const dy = food.y - y;
        const distSq = dx * dx + dy * dy;

        if (distSq <= radiusSq) {
          nearby.push(food);
        }
      }
    }

    return nearby;
  }

  /**
   * Spawn initial population
   */
  spawnInitialPopulation() {
    this.clear();

    const speciesCount = Math.max(1, Math.floor(this.initialSpecies || 1));
    const total = Math.max(0, Math.floor(this.initialPopulation || 0));

    // Determine group sizes per species
    const baseCount = Math.floor(total / speciesCount);
    let remainder = total % speciesCount;

    // Create distinct base genomes per species
    const baseGenomes = Array.from({ length: speciesCount }, () => Genome.createDefault());

    const initialOrganisms = [];

    for (let s = 0; s < speciesCount; s++) {
      const countForSpecies = baseCount + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;

      for (let i = 0; i < countForSpecies; i++) {
        const x = Math.random() * this.width;
        const y = Math.random() * this.height;
        // Clone base genome so organisms are independent but remain same species
        const genome = baseGenomes[s].clone();
        const organism = new Organism(x, y, genome);
        organism.energy = 50 + Math.random() * 50; // Random initial energy
        this.addOrganism(organism);
        initialOrganisms.push(organism);
      }
    }

    // Register initial species in genealogy tracker
    this.genealogyTracker.registerInitialSpecies(initialOrganisms);

    // Spawn initial food as per setting (in clusters for more natural distribution)
    const initialFood = Math.max(0, Math.floor(this.initialFoodCount || 0));
    if (initialFood > 0) {
      // Spawn food in clusters instead of randomly scattered
      const clusterCount = Math.ceil(initialFood / 6); // ~6 food items per cluster
      const foodPerCluster = Math.floor(initialFood / clusterCount);
      const remainder = initialFood % clusterCount;

      this.spawnRandomFoodClusters(clusterCount, foodPerCluster);

      // Spawn any remainder as single items
      if (remainder > 0) {
        this.spawnRandomFood(remainder);
      }
    }
  }

  /**
   * Update environment parameters
   */
  setEnvironmentParams(params) {
    if (params.foodSpawnRate !== undefined) {
      this.foodSpawnRate = params.foodSpawnRate;
    }
    if (params.temperature !== undefined) {
      this.temperature = params.temperature;
    }
    if (params.mutationRate !== undefined) {
      this.mutationRate = params.mutationRate;
    }
    if (params.initialPopulation !== undefined) {
      this.initialPopulation = params.initialPopulation;
    }
    if (params.initialFoodCount !== undefined) {
      this.initialFoodCount = params.initialFoodCount;
    }
    if (params.initialSpecies !== undefined) {
      this.initialSpecies = params.initialSpecies;
    }
  }

  /**
   * Toggle pause
   */
  togglePause() {
    this.isPaused = !this.isPaused;
  }

  /**
   * Clear all organisms and reset world
   */
  clear() {
    // Return all food to pool before clearing
    this.foodPool.releaseAll(this.foodParticles);

    this.organisms = [];
    this.organismAIs.clear();
    this.foodParticles = [];
    this.grid.clear();
    this.foodGrid.clear();
    this.time = 0;
    this.playerOrganism = null;
    this.statsTracker.clear();
    this.genealogyTracker.clear();
    this.combatKills = 0;
  }

  /**
   * Get world statistics
   */
  getStats() {
    const alive = this.getAliveOrganisms();
    return {
      totalOrganisms: this.organisms.length,
      aliveOrganisms: alive.length,
      foodParticles: this.foodParticles.length,
      worldTime: this.time.toFixed(1),
      averageEnergy: alive.length > 0
        ? (alive.reduce((sum, org) => sum + org.energy, 0) / alive.length).toFixed(1)
        : 0
    };
  }
}
