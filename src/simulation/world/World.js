import { Genome } from '../../core/genetics/Genome.js';
import { Organism } from '../../core/organisms/Organism.js';
import { ObjectPool } from '../../engine/performance/ObjectPool.js';
import { OrganismAI } from '../ai/OrganismAI.js';
import { SpeciesNaming } from '../species/SpeciesNaming.js';
import { GenealogyTracker } from '../tracking/GenealogyTracker.js';
import { StatisticsTracker } from '../tracking/StatisticsTracker.js';

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
    this.separationSections = 1; // Number of sections for species segregation (1 = no separation)

    // Spatial hash grid for collision optimization
    this.cellSize = 100; // Grid cell size in pixels
    this.grid = new Map(); // Map of "x,y" -> Set of organisms
    this.foodGrid = new Map(); // Map of "x,y" -> Set of food particles

    // Staggered update system with dynamic batch sizing
    this.updateBatchSize = 50; // Base update AI for N organisms per frame
    this.currentUpdateIndex = 0;
    this.targetUpdatesPerFrame = 2; // Target: update all organisms within N frames

    // Priority-based update tracking
    this.organismPriorities = new Map(); // organism -> priority score
    this.lastPriorityUpdate = 0;

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

    // Species tracking for phylotype-based speciation
    this.speciesFounders = new Map(); // Map of organism ID -> organism (species founders)
    this.speciationEvents = []; // Log of speciation events
    this.speciesNames = new Map(); // Map of founder ID -> {name, code, emoji}
  }



  /**
   * Get section boundaries for a given section index
   */
  getSectionBounds(sectionIndex) {
    const sections = Math.max(1, this.separationSections);

    // Calculate grid dimensions (try to make it as square as possible)
    const cols = Math.ceil(Math.sqrt(sections));
    const rows = Math.ceil(sections / cols);

    const sectionWidth = this.width / cols;
    const sectionHeight = this.height / rows;

    const col = sectionIndex % cols;
    const row = Math.floor(sectionIndex / cols);

    return {
      minX: col * sectionWidth,
      maxX: (col + 1) * sectionWidth,
      minY: row * sectionHeight,
      maxY: (row + 1) * sectionHeight
    };
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
    // Keep organism within bounds (respecting sections if enabled)
    if (this.separationSections > 1 && organism._assignedSection !== undefined) {
      const bounds = this.getSectionBounds(organism._assignedSection);
      organism.x = Math.max(bounds.minX + organism.phenotype.size, Math.min(bounds.maxX - organism.phenotype.size, organism.x));
      organism.y = Math.max(bounds.minY + organism.phenotype.size, Math.min(bounds.maxY - organism.phenotype.size, organism.y));
    } else {
      organism.x = Math.max(organism.phenotype.size, Math.min(this.width - organism.phenotype.size, organism.x));
      organism.y = Math.max(organism.phenotype.size, Math.min(this.height - organism.phenotype.size, organism.y));
    }

    this.organisms.push(organism);
    this.addToGrid(organism);

    // Track species founders and assign species name
    if (organism.speciesFounderId === organism.id) {
      this.speciesFounders.set(organism.id, organism);

      // Generate species name if not already named
      if (!this.speciesNames.has(organism.id)) {
        const speciesInfo = this.registerSpeciesName(organism);
        organism.setSpeciesInfo(speciesInfo);
      } else {
        organism.setSpeciesInfo(this.speciesNames.get(organism.id));
      }
    } else {
      // Not a founder - inherit species info from founder
      const speciesInfo = this.getSpeciesName(organism.speciesFounderId);
      organism.setSpeciesInfo(speciesInfo);
    }

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

      // Remove from species founders if it was one
      if (organism.speciesFounderId === organism.id) {
        this.speciesFounders.delete(organism.id);
      }
    }
  }

  /**
   * Get organism by ID (for species founder lookup)
   */
  getOrganismById(id) {
    // Check species founders first (faster lookup)
    if (this.speciesFounders.has(id)) {
      return this.speciesFounders.get(id);
    }

    // Search all organisms
    return this.organisms.find(org => org.id === id);
  }

  /**
   * Register a species name for a founder organism
   */
  registerSpeciesName(founder) {
    const name = SpeciesNaming.generateName(founder.phenotype, founder.id);
    const code = SpeciesNaming.generateCode(name, founder.id);
    const emoji = SpeciesNaming.getSpeciesEmoji(founder.phenotype);

    this.speciesNames.set(founder.id, { name, code, emoji });
    return { name, code, emoji };
  }

  /**
   * Get species name for a founder ID
   */
  getSpeciesName(founderId) {
    return this.speciesNames.get(founderId) || {
      name: 'Unknown Species',
      code: 'XX-000',
      emoji: '🦠'
    };
  }

  /**
   * Handle speciation event
   * Called when an organism becomes a new species founder
   */
  onSpeciationEvent(newFounder, oldSpeciesId) {
    // Add to founders map
    this.speciesFounders.set(newFounder.id, newFounder);

    // Generate species name
    const speciesInfo = this.registerSpeciesName(newFounder);
    const parentSpeciesInfo = this.getSpeciesName(oldSpeciesId);

    // Log event
    this.speciationEvents.push({
      time: this.time,
      founderId: newFounder.id,
      parentSpeciesId: oldSpeciesId,
      phenotype: { ...newFounder.phenotype },
      speciesName: speciesInfo.name,
      parentSpeciesName: parentSpeciesInfo.name
    });

    // Console log the speciation event
    console.log(`🧬 SPECIATION! ${speciesInfo.emoji} "${speciesInfo.name}" (${speciesInfo.code}) evolved from "${parentSpeciesInfo.name}"`);

    // Keep log from growing too large (keep last 100 events)
    if (this.speciationEvents.length > 100) {
      this.speciationEvents.shift();
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
   * Calculate update priority for an organism (higher = more urgent)
   */
  calculateUpdatePriority(organism) {
    const energyRatio = organism.energy / organism.maxEnergy;
    let priority = 1.0;

    // High priority for low energy (starving)
    if (energyRatio < 0.3) {
      priority += (0.3 - energyRatio) * 5; // Up to +1.5 priority
    }

    // High priority if can reproduce (important decision)
    if (organism.canReproduce()) {
      priority += 1.0;
    }

    // Medium priority if moving fast (likely in combat or fleeing)
    const speed = Math.hypot(organism.vx, organism.vy);
    if (speed > 0.5) {
      priority += speed * 0.5;
    }

    return priority;
  }

  /**
   * Update organism priorities (called periodically, not every frame)
   */
  updateOrganismPriorities() {
    this.organismPriorities.clear();

    for (const organism of this.organisms) {
      if (!organism.isAlive) continue;
      const priority = this.calculateUpdatePriority(organism);
      this.organismPriorities.set(organism, priority);
    }
  }

  /**
   * Get organisms sorted by update priority
   */
  getPrioritizedOrganisms() {
    const organisms = Array.from(this.organisms);

    // Sort by priority (descending)
    organisms.sort((a, b) => {
      const priorityA = this.organismPriorities.get(a) || 1;
      const priorityB = this.organismPriorities.get(b) || 1;
      return priorityB - priorityA;
    });

    return organisms;
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

    // Update priorities every 500ms
    if (this.time - this.lastPriorityUpdate > 500) {
      this.updateOrganismPriorities();
      this.lastPriorityUpdate = this.time;
    }

    // Dynamic batch sizing: aim to update all organisms within targetUpdatesPerFrame frames
    const dynamicBatchSize = Math.ceil(this.organisms.length / this.targetUpdatesPerFrame);
    const batchSize = Math.min(Math.max(20, dynamicBatchSize), this.organisms.length);

    // Get prioritized organisms for this frame
    const prioritizedOrganisms = this.organismPriorities.size > 0
      ? this.getPrioritizedOrganisms()
      : this.organisms;

    const startIdx = this.currentUpdateIndex;

    for (let i = 0; i < batchSize; i++) {
      const idx = (startIdx + i) % prioritizedOrganisms.length;
      const organism = prioritizedOrganisms[idx];

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
    this.currentUpdateIndex = (this.currentUpdateIndex + batchSize) % Math.max(1, prioritizedOrganisms.length);

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
   * Keep organisms within world bounds (and section bounds if separation enabled)
   */
  keepOrganismsInBounds() {
    for (const organism of this.organisms) {
      const size = organism.phenotype.size;

      // If sections are enabled, enforce section boundaries
      if (this.separationSections > 1 && organism._assignedSection !== undefined) {
        const bounds = this.getSectionBounds(organism._assignedSection);

        if (organism.x < bounds.minX + size) {
          organism.x = bounds.minX + size;
          organism.vx = Math.abs(organism.vx) * 0.5;
        } else if (organism.x > bounds.maxX - size) {
          organism.x = bounds.maxX - size;
          organism.vx = -Math.abs(organism.vx) * 0.5;
        }

        if (organism.y < bounds.minY + size) {
          organism.y = bounds.minY + size;
          organism.vy = Math.abs(organism.vy) * 0.5;
        } else if (organism.y > bounds.maxY - size) {
          organism.y = bounds.maxY - size;
          organism.vy = -Math.abs(organism.vy) * 0.5;
        }
      } else {
        // Normal world bounds
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
    const sections = Math.max(1, this.separationSections);

    // Determine group sizes per species
    const baseCount = Math.floor(total / speciesCount);
    let remainder = total % speciesCount;

    // Create distinct base genomes per species
    const baseGenomes = Array.from({ length: speciesCount }, () => Genome.createDefault());

    const initialOrganisms = [];

    for (let s = 0; s < speciesCount; s++) {
      const countForSpecies = baseCount + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;

      // Assign species to a section (if separation is enabled)
      const sectionIndex = sections > 1 ? s % sections : 0;
      const bounds = this.getSectionBounds(sectionIndex);

      let speciesFounderId = null; // Track the founder ID for this species

      for (let i = 0; i < countForSpecies; i++) {
        // Spawn within the assigned section
        const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
        const y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);

        // Clone base genome so organisms are independent but remain same species
        const genome = baseGenomes[s].clone();

        // Create organism with founder ID
        // First organism (speciesFounderId=null): becomes its own founder
        // Subsequent organisms: inherit the first organism's ID as founder
        const organism = new Organism(x, y, genome, null, speciesFounderId);

        // Capture the first organism's ID as the species founder
        if (speciesFounderId === null) {
          speciesFounderId = organism.id;
          const speciesInfo = this.getSpeciesName(organism.id);
          console.log(`${speciesInfo.emoji} Species ${s + 1}/${speciesCount}: "${speciesInfo.name}" (${speciesInfo.code}) - ${countForSpecies} organisms`);
        }

        organism.energy = 50 + Math.random() * 50; // Random initial energy
        organism._assignedSection = sectionIndex; // Track which section this organism/species belongs to
        this.addOrganism(organism);
        initialOrganisms.push(organism);
      }
    }

    // Register initial species in genealogy tracker
    this.genealogyTracker.registerInitialSpecies(initialOrganisms);

    // Spawn initial food as per setting (in clusters for more natural distribution)
    const initialFood = Math.max(0, Math.floor(this.initialFoodCount || 0));
    if (initialFood > 0) {
      // If sections are enabled, distribute food across sections
      if (sections > 1) {
        const foodPerSection = Math.floor(initialFood / sections);
        const foodRemainder = initialFood % sections;

        for (let s = 0; s < sections; s++) {
          const foodForSection = foodPerSection + (s < foodRemainder ? 1 : 0);
          const bounds = this.getSectionBounds(s);

          // Spawn food clusters within this section
          const clusterCount = Math.ceil(foodForSection / 6);
          const foodPerCluster = Math.floor(foodForSection / clusterCount);

          for (let c = 0; c < clusterCount; c++) {
            const centerX = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
            const centerY = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
            const clusterSize = c < foodForSection % clusterCount ? foodPerCluster + 1 : foodPerCluster;
            this.spawnFoodCluster(centerX, centerY, clusterSize);
          }
        }
      } else {
        // No sections - spawn food normally
        const clusterCount = Math.ceil(initialFood / 6);
        const foodPerCluster = Math.floor(initialFood / clusterCount);
        const foodRemainder = initialFood % clusterCount;

        this.spawnRandomFoodClusters(clusterCount, foodPerCluster);

        // Spawn any remainder as single items
        if (foodRemainder > 0) {
          this.spawnRandomFood(foodRemainder);
        }
      }
    }

    // Log initialization summary
    const speciesNamesList = Array.from(this.speciesFounders.keys())
      .map(id => {
        const info = this.getSpeciesName(id);
        return `${info.emoji} ${info.name}`;
      })
      .join(', ');

    console.log(`✅ Initialized ${total} organisms across ${speciesCount} species`);
    console.log(`   Species: ${speciesNamesList}`);
  }

  /**
   * Redistribute food to fit within new world bounds
   */
  redistributeFood() {
    for (const food of this.foodParticles) {
      // Remove from old grid position
      this.removeFoodFromGrid(food, food.x, food.y);

      // Clamp food position to new world bounds
      food.x = Math.max(20, Math.min(this.width - 20, food.x));
      food.y = Math.max(20, Math.min(this.height - 20, food.y));

      // Add to new grid position
      this.addFoodToGrid(food);
    }
  }

  /**
   * Redistribute organisms evenly across sections
   */
  redistributeOrganismsToSections() {
    if (this.separationSections <= 1) {
      // No sections - remove section assignments
      for (const organism of this.organisms) {
        organism._assignedSection = undefined;
      }
      return;
    }

    // Group organisms by species
    const speciesMap = new Map();
    for (const organism of this.organisms) {
      const speciesId = organism.getSpeciesId();
      if (!speciesMap.has(speciesId)) {
        speciesMap.set(speciesId, []);
      }
      speciesMap.get(speciesId).push(organism);
    }

    // Assign each species to a section (round-robin)
    const speciesArray = Array.from(speciesMap.entries());
    for (let s = 0; s < speciesArray.length; s++) {
      const [, organisms] = speciesArray[s];
      const sectionIndex = s % this.separationSections;
      const bounds = this.getSectionBounds(sectionIndex);

      // Assign section and relocate organisms
      for (const organism of organisms) {
        organism._assignedSection = sectionIndex;

        // Move organism to its assigned section if it's outside
        if (organism.x < bounds.minX || organism.x > bounds.maxX ||
            organism.y < bounds.minY || organism.y > bounds.maxY) {

          // Place in random position within the section
          organism.x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
          organism.y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);

          // Reset velocity to avoid immediate wall collision
          organism.vx = 0;
          organism.vy = 0;

          // Update spatial grid
          this.updateGrid(organism);
        }
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
    if (params.separationSections !== undefined) {
      this.separationSections = params.separationSections;
      // Redistribute existing organisms when sections change
      this.redistributeOrganismsToSections();
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

    // Clear species tracking
    this.speciesFounders.clear();
    this.speciationEvents = [];
    this.speciesNames.clear();

    // Reset organism ID counter for clean restarts
    Organism.nextId = 1;
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
