import { Genome } from '../../core/genetics/Genome.js';
import { Organism } from '../../core/organisms/Organism.js';
import { PhenotypeComparator } from '../../core/organisms/PhenotypeComparator.js';
import { ObjectPool } from '../../engine/performance/ObjectPool.js';
import { OrganismAI } from '../ai/OrganismAI.js';
import { ColonyManager } from '../colonies/ColonyManager.js';
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
    this.prioritizedOrganisms = [];
    this.lastPriorityUpdate = 0;
    this.updateCycle = 0;

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

    // Cooperation statistics
    this.cooperationEvents = 0;
    this.colonyManager = new ColonyManager();

    // Species tracking for phylotype-based speciation
    this.speciesFounders = new Map(); // Map of organism ID -> organism (species founders)
    this.speciationEvents = []; // Log of speciation events
    this.speciesNames = new Map(); // Map of founder ID -> {name, code, emoji}
    this.speciesProfiles = new Map();
    this.provisionalStrains = new Map();
    this.nextProvisionalStrainId = 1;
    this.lastSpeciesProfileUpdate = 0;
    this.lastProvisionalStrainUpdate = 0;
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
   * Get the circular culture boundary.
   */
  getArenaGeometry(padding = 0) {
    return {
      centerX: this.width / 2,
      centerY: this.height / 2,
      radius: Math.max(0, Math.min(this.width, this.height) / 2 - padding)
    };
  }

  /**
   * Generate a uniformly distributed point inside the culture boundary.
   */
  getRandomArenaPosition(padding = 20) {
    const { centerX, centerY, radius } = this.getArenaGeometry(padding);
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * radius;

    return {
      x: centerX + Math.cos(angle) * distance,
      y: centerY + Math.sin(angle) * distance
    };
  }

  /**
   * Project a point onto the usable area of the circular culture.
   */
  constrainPointToArena(x, y, padding = 0) {
    const { centerX, centerY, radius } = this.getArenaGeometry(padding);
    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.hypot(dx, dy);

    if (distance <= radius || distance === 0) {
      return { x, y };
    }

    const scale = radius / distance;
    return {
      x: centerX + dx * scale,
      y: centerY + dy * scale
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
    }

    const position = this.constrainPointToArena(
      organism.x,
      organism.y,
      organism.phenotype.size + 8
    );
    organism.x = position.x;
    organism.y = position.y;

    this.organisms.push(organism);
    this.addToGrid(organism);
    this.prioritizedOrganisms = [];

    // Track species founders and assign species name
    if (organism.speciesFounderId === organism.id) {
      this.speciesFounders.set(organism.id, organism);
      this.registerSpeciesProfile(organism);

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

    const profile = this.speciesProfiles.get(organism.speciesFounderId);
    if (profile) {
      profile.currentPopulation++;
    }

    // Create AI for organism if not player
    if (!organism.isPlayer) {
      this.organismAIs.set(organism, new OrganismAI(organism, this));
    }

    const parent = organism.parentId !== null
      ? this.getOrganismById(organism.parentId)
      : null;
    if (parent?.isAlive && parent.isSameSpecies(organism)) {
      this.colonyManager.integrateOffspring(parent, organism, this.time);
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
      this.organismPriorities.delete(organism);
      this.prioritizedOrganisms = [];
      this.colonyManager.removeOrganism(organism);
      const profile = this.speciesProfiles.get(organism.speciesFounderId);
      if (profile) {
        profile.currentPopulation = Math.max(0, profile.currentPopulation - 1);
      }

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
   * Store a durable species reference that survives its founder.
   */
  registerSpeciesProfile(founder, parentSpeciesId = null) {
    if (this.speciesProfiles.has(founder.id)) {
      return this.speciesProfiles.get(founder.id);
    }

    const reference = PhenotypeComparator.createReference(founder);
    const profile = {
      id: founder.id,
      parentSpeciesId,
      founderReference: reference,
      centroidPhenotype: PhenotypeComparator.copyComparablePhenotype(reference.phenotype),
      currentPopulation: 0,
      createdAt: this.time
    };

    this.speciesProfiles.set(founder.id, profile);
    return profile;
  }

  /**
   * Compare against the founder genome and the slowly moving species phenotype.
   */
  getSpeciesReference(speciesId) {
    const profile = this.speciesProfiles.get(speciesId);
    if (!profile) return null;

    return {
      genome: profile.founderReference.genome,
      phenotype: profile.centroidPhenotype
    };
  }

  /**
   * Classify a divergent organism or start a provisional strain.
   */
  evaluateSpeciesCandidate(organism) {
    if (organism.speciesFounderId === organism.id) return false;

    const currentReference = this.getSpeciesReference(organism.speciesFounderId);
    if (!currentReference) {
      return false;
    }

    const currentDivergence = PhenotypeComparator.calculateDivergence(
      organism,
      currentReference
    );
    if (
      currentDivergence.combinedScore <
      PhenotypeComparator.SPECIATION_THRESHOLD
    ) {
      organism._provisionalStrainId = null;
      return false;
    }

    const nearestSpecies = this.findNearestSpecies(organism, organism.speciesFounderId);
    if (
      nearestSpecies &&
      nearestSpecies.divergence.combinedScore <=
        PhenotypeComparator.EXISTING_SPECIES_MATCH_THRESHOLD
    ) {
      this.assignOrganismToSpecies(organism, nearestSpecies.speciesId);
      return true;
    }

    this.createProvisionalStrain(organism, currentDivergence);
    return true;
  }

  findNearestSpecies(organism, excludedSpeciesId = null) {
    let nearest = null;

    for (const [speciesId, profile] of this.speciesProfiles) {
      if (speciesId === excludedSpeciesId || profile.currentPopulation <= 0) continue;

      const divergence = PhenotypeComparator.calculateDivergence(
        organism,
        this.getSpeciesReference(speciesId)
      );
      if (!nearest || divergence.combinedScore < nearest.divergence.combinedScore) {
        nearest = { speciesId, divergence };
      }
    }

    return nearest;
  }

  assignOrganismToSpecies(organism, speciesId) {
    organism.speciesFounderId = speciesId;
    organism._cachedSpeciesId = null;
    organism._provisionalStrainId = null;
    organism.refreshVisualPhenotype();
    organism.setSpeciesInfo(this.getSpeciesName(speciesId));
  }

  createProvisionalStrain(organism, divergence = null) {
    const strainId = `strain-${this.nextProvisionalStrainId++}`;
    this.provisionalStrains.set(strainId, {
      id: strainId,
      parentSpeciesId: organism.speciesFounderId,
      founderId: organism.id,
      reference: PhenotypeComparator.createReference(organism),
      divergence,
      firstSeen: this.time,
      lastSeen: this.time
    });
    organism._provisionalStrainId = strainId;
    return strainId;
  }

  registerProvisionalOffspring(organism, strainId, mutationOccurred) {
    const strain = this.provisionalStrains.get(strainId);
    if (!strain) {
      organism._provisionalStrainId = null;
      if (mutationOccurred) {
        return this.evaluateSpeciesCandidate(organism);
      }
      return false;
    }

    const divergence = PhenotypeComparator.calculateDivergence(
      organism,
      strain.reference
    );
    if (
      divergence.combinedScore <
      PhenotypeComparator.SPECIATION_THRESHOLD
    ) {
      strain.lastSeen = this.time;
      return true;
    }

    organism._provisionalStrainId = null;
    return this.evaluateSpeciesCandidate(organism);
  }

  updateSpeciesProfiles() {
    const populations = new Map();

    for (const organism of this.organisms) {
      if (!organism.isAlive) continue;
      const speciesId = organism.speciesFounderId;
      if (!populations.has(speciesId)) {
        populations.set(speciesId, []);
      }
      populations.get(speciesId).push(organism);
    }

    for (const [speciesId, profile] of this.speciesProfiles) {
      const members = populations.get(speciesId) || [];
      profile.currentPopulation = members.length;
      const referenceMembers = members.filter(
        member => !member._provisionalStrainId
      );

      if (referenceMembers.length > 0) {
        const centroid =
          PhenotypeComparator.calculatePhenotypeCentroid(referenceMembers);
        profile.centroidPhenotype = PhenotypeComparator.blendPhenotypes(
          profile.centroidPhenotype,
          centroid
        );
      }
    }
  }

  updateProvisionalStrains() {
    const membersByStrain = new Map();

    for (const organism of this.organisms) {
      if (!organism.isAlive || !organism._provisionalStrainId) continue;
      if (!membersByStrain.has(organism._provisionalStrainId)) {
        membersByStrain.set(organism._provisionalStrainId, []);
      }
      membersByStrain.get(organism._provisionalStrainId).push(organism);
    }

    for (const [strainId, strain] of this.provisionalStrains) {
      const members = membersByStrain.get(strainId) || [];
      const age = this.time - strain.firstSeen;

      if (members.length >= 3 || (members.length >= 2 && age >= 6000)) {
        this.confirmProvisionalStrain(strain, members);
      } else if (members.length === 0 && age >= 12000) {
        this.provisionalStrains.delete(strainId);
      }
    }
  }

  confirmProvisionalStrain(strain, members) {
    const founder =
      members.find(member => member.id === strain.founderId) ||
      members.reduce((oldest, member) => member.id < oldest.id ? member : oldest);
    const newSpeciesId = founder.id;

    for (const member of members) {
      member.speciesFounderId = newSpeciesId;
      member._cachedSpeciesId = null;
      member._provisionalStrainId = null;
      member.refreshVisualPhenotype();
    }

    founder._founderPhenotype = founder.basePhenotype || founder.phenotype;
    this.onSpeciationEvent(founder, strain.parentSpeciesId);
    const profile = this.speciesProfiles.get(newSpeciesId);
    if (profile) {
      profile.currentPopulation = members.length;
    }
    const parentProfile = this.speciesProfiles.get(strain.parentSpeciesId);
    if (parentProfile) {
      parentProfile.currentPopulation = Math.max(
        0,
        parentProfile.currentPopulation - members.length
      );
    }

    const speciesInfo = this.getSpeciesName(newSpeciesId);
    for (const member of members) {
      member.setSpeciesInfo(speciesInfo);
    }

    this.provisionalStrains.delete(strain.id);
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
    this.registerSpeciesProfile(newFounder, oldSpeciesId);

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
      const { x, y } = this.getRandomArenaPosition(20);
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

      const position = this.constrainPointToArena(x, y, 20);

      const energy = 15 + Math.random() * 15;
      this.addFood(position.x, position.y, energy);
    }
  }

  /**
   * Spawn random food clusters
   */
  spawnRandomFoodClusters(clusterCount = 1, foodPerCluster = 5) {
    for (let i = 0; i < clusterCount; i++) {
      const { x: centerX, y: centerY } = this.getRandomArenaPosition(80);
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
    this.prioritizedOrganisms = [];

    for (const organism of this.organisms) {
      if (!organism.isAlive) continue;
      const priority = this.calculateUpdatePriority(organism);
      this.organismPriorities.set(organism, priority);
      this.prioritizedOrganisms.push(organism);
    }

    this.prioritizedOrganisms.sort((first, second) => {
      const firstPriority = this.organismPriorities.get(first) || 1;
      const secondPriority = this.organismPriorities.get(second) || 1;
      return secondPriority - firstPriority;
    });
  }

  /**
   * Get organisms sorted by update priority
   */
  getPrioritizedOrganisms() {
    return this.prioritizedOrganisms.length > 0
      ? this.prioritizedOrganisms
      : this.organisms;
  }

  /**
   * Spread expensive AI decisions across more frames as populations grow.
   */
  getAITargetFrames() {
    const population = this.organisms.length;
    if (population >= 1200) return 12;
    if (population >= 700) return 8;
    if (population >= 350) return 5;
    if (population >= 150) return 3;
    return this.targetUpdatesPerFrame;
  }

  /**
   * Update world (called each frame)
   */
  update(deltaTime, options = {}) {
    if (this.isPaused && !options.force) return;

    this.time += options.calendarDelta ?? deltaTime;
    this.updateCycle++;
    const tempModifiedDelta = deltaTime * this.temperature;

    // Update all organisms (physics only)
    for (const organism of this.organisms) {
      organism.update(tempModifiedDelta);

      // Update spatial grid position
      this.updateGrid(organism);
    }

    this.colonyManager.update(tempModifiedDelta, this.time);

    // Update priorities every 500ms
    if (this.time - this.lastPriorityUpdate > 500) {
      this.updateOrganismPriorities();
      this.lastPriorityUpdate = this.time;
    }

    // Dynamic batch sizing: aim to update all organisms within targetUpdatesPerFrame frames
    const aiTargetFrames = this.getAITargetFrames();
    const dynamicBatchSize = Math.ceil(this.organisms.length / aiTargetFrames);
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
        const lastAIUpdate = organism._lastAIUpdateTime ?? (this.time - deltaTime);
        const aiDeltaTime = Math.min(250, Math.max(deltaTime, this.time - lastAIUpdate));
        organism._lastAIUpdateTime = this.time;
        ai.update(aiDeltaTime);

        // Try to reproduce
        const offspring = ai.tryReproduce(aiDeltaTime);
        if (offspring) {
          this.addOrganism(offspring);
        }
      }
    }

    // Move to next batch for next frame
    this.currentUpdateIndex = (this.currentUpdateIndex + batchSize) % Math.max(1, prioritizedOrganisms.length);

    const interactionStride = this.organisms.length >= 800
      ? 3
      : this.organisms.length >= 300
        ? 2
        : 1;

    if (this.updateCycle % interactionStride === 0) {
      this.handleCollisions();
      this.handleFoodConsumption();
    }

    // Remove dead organisms
    this.removeDeadOrganisms();

    if (this.time - this.lastProvisionalStrainUpdate >= 500) {
      this.updateProvisionalStrains();
      this.lastProvisionalStrainUpdate = this.time;
    }

    if (this.time - this.lastSpeciesProfileUpdate >= 1000) {
      this.updateSpeciesProfiles();
      this.lastSpeciesProfileUpdate = this.time;
    }

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

    if (!options.offline || options.recordStats) {
      this.statsTracker.collectStats(this, options.offline === true);
      this.genealogyTracker.update(this, options.offline === true);
    }
  }

  /**
   * Handle collisions between organisms (optimized with spatial grid)
   */
  handleCollisions() {
    for (const organism of this.organisms) {
      if (!organism.isAlive) continue;

      const searchRadius = organism.phenotype.size * 3;
      const minCellX = Math.floor((organism.x - searchRadius) / this.cellSize);
      const maxCellX = Math.floor((organism.x + searchRadius) / this.cellSize);
      const minCellY = Math.floor((organism.y - searchRadius) / this.cellSize);
      const maxCellY = Math.floor((organism.y + searchRadius) / this.cellSize);

      for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
        for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
          const cell = this.grid.get(`${cellX},${cellY}`);
          if (!cell) continue;

          for (const other of cell) {
            if (!other.isAlive || other.id <= organism.id) continue;

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
  }

  /**
   * Resolve collision between two organisms
   */
  resolveCollision(org1, org2) {
    // Check if parent-child relationship exists
    if (org1.isParentChildRelation(org2)) {
      this.colonyManager.tryCreateBond(org1, org2, this.time);
      // Just push apart, no combat
      this.pushOrganismsApart(org1, org2);
      return;
    }

    // Get AI states
    const ai1 = this.organismAIs.get(org1);
    const ai2 = this.organismAIs.get(org2);
    const org1Attacking = ai1 && ai1.state === 'attacking';
    const org2Attacking = ai2 && ai2.state === 'attacking';
    // Check for cooperation first (if same species and no one is attacking)
    if (!org1Attacking && !org2Attacking && org1.isSameSpecies(org2)) {
      const createdBond = this.colonyManager.tryCreateBond(org1, org2, this.time);
      const bonded = createdBond || this.colonyManager.hasBond(org1, org2);
      const cooperated1 = bonded ? false : org1.cooperateWith(org2);
      const cooperated2 = bonded ? false : org2.cooperateWith(org1);

      // Track cooperation for visual feedback
      if (createdBond || cooperated1 || cooperated2) {
        org1._lastCooperation = Date.now();
        org2._lastCooperation = Date.now();
        this.cooperationEvents++; // Increment cooperation counter
      }

      // Push apart and return
      this.pushOrganismsApart(org1, org2);
      return;
    }

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

      const searchRadius = organism.phenotype.size + 20;
      const minCellX = Math.floor((organism.x - searchRadius) / this.cellSize);
      const maxCellX = Math.floor((organism.x + searchRadius) / this.cellSize);
      const minCellY = Math.floor((organism.y - searchRadius) / this.cellSize);
      const maxCellY = Math.floor((organism.y + searchRadius) / this.cellSize);
      let consumedForOrganism = false;

      for (
        let cellX = minCellX;
        cellX <= maxCellX && !consumedForOrganism;
        cellX++
      ) {
        for (
          let cellY = minCellY;
          cellY <= maxCellY && !consumedForOrganism;
          cellY++
        ) {
          const cell = this.foodGrid.get(`${cellX},${cellY}`);
          if (!cell) continue;

          for (const food of cell) {
            if (consumedFood.has(food)) continue;

            const dx = organism.x - food.x;
            const dy = organism.y - food.y;
            const distSq = dx * dx + dy * dy;
            const minDist = organism.phenotype.size + food.radius;

            if (distSq < minDist * minDist) {
              organism.consume(food.energy);
              consumedFood.add(food);
              consumedForOrganism = true;
              break;
            }
          }
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
        this.addFood(organism.x, organism.y, organism.phenotype.size * 5);
        this.removeFromGrid(organism);
        this.organismAIs.delete(organism);
        this.organismPriorities.delete(organism);
        this.colonyManager.removeOrganism(organism);
        const profile = this.speciesProfiles.get(organism.speciesFounderId);
        if (profile) {
          profile.currentPopulation = Math.max(
            0,
            profile.currentPopulation - 1
          );
        }
        if (organism.speciesFounderId === organism.id) {
          this.speciesFounders.delete(organism.id);
        }
        this.organisms.splice(i, 1);
      }
    }

    if (this.prioritizedOrganisms.length !== this.organisms.length) {
      this.prioritizedOrganisms = [];
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
      }

      const { centerX, centerY, radius } = this.getArenaGeometry(size + 8);
      const dx = organism.x - centerX;
      const dy = organism.y - centerY;
      const distance = Math.hypot(dx, dy);

      if (distance > radius && distance > 0) {
        const normalX = dx / distance;
        const normalY = dy / distance;
        organism.x = centerX + normalX * radius;
        organism.y = centerY + normalY * radius;

        const outwardVelocity = organism.vx * normalX + organism.vy * normalY;
        if (outwardVelocity > 0) {
          organism.vx -= 1.5 * outwardVelocity * normalX;
          organism.vy -= 1.5 * outwardVelocity * normalY;
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
    const radiusSq = radius * radius;
    const minCellX = Math.floor((x - radius) / this.cellSize);
    const maxCellX = Math.floor((x + radius) / this.cellSize);
    const minCellY = Math.floor((y - radius) / this.cellSize);
    const maxCellY = Math.floor((y + radius) / this.cellSize);

    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
        const cell = this.grid.get(`${cellX},${cellY}`);
        if (!cell) continue;

        for (const organism of cell) {
          if (!organism.isAlive) continue;

          const dx = organism.x - x;
          const dy = organism.y - y;
          if (dx * dx + dy * dy <= radiusSq) {
            nearby.push(organism);
          }
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
    const radiusSq = radius * radius;
    const minCellX = Math.floor((x - radius) / this.cellSize);
    const maxCellX = Math.floor((x + radius) / this.cellSize);
    const minCellY = Math.floor((y - radius) / this.cellSize);
    const maxCellY = Math.floor((y + radius) / this.cellSize);

    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
        const cell = this.foodGrid.get(`${cellX},${cellY}`);
        if (!cell) continue;

        for (const food of cell) {
          const dx = food.x - x;
          const dy = food.y - y;
          if (dx * dx + dy * dy <= radiusSq) {
            nearby.push(food);
          }
        }
      }
    }

    return nearby;
  }

  /**
   * Get organisms in a rectangular view using the spatial grid.
   */
  getOrganismsInArea(left, top, right, bottom) {
    const organisms = [];
    const minCellX = Math.floor(left / this.cellSize);
    const maxCellX = Math.floor(right / this.cellSize);
    const minCellY = Math.floor(top / this.cellSize);
    const maxCellY = Math.floor(bottom / this.cellSize);

    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
        const cell = this.grid.get(`${cellX},${cellY}`);
        if (!cell) continue;

        for (const organism of cell) {
          if (
            organism.isAlive &&
            organism.x >= left &&
            organism.x <= right &&
            organism.y >= top &&
            organism.y <= bottom
          ) {
            organisms.push(organism);
          }
        }
      }
    }

    return organisms;
  }

  /**
   * Get food in a rectangular view using the spatial grid.
   */
  getFoodInArea(left, top, right, bottom) {
    const foodParticles = [];
    const minCellX = Math.floor(left / this.cellSize);
    const maxCellX = Math.floor(right / this.cellSize);
    const minCellY = Math.floor(top / this.cellSize);
    const maxCellY = Math.floor(bottom / this.cellSize);

    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
        const cell = this.foodGrid.get(`${cellX},${cellY}`);
        if (!cell) continue;

        for (const food of cell) {
          if (
            food.x >= left &&
            food.x <= right &&
            food.y >= top &&
            food.y <= bottom
          ) {
            foodParticles.push(food);
          }
        }
      }
    }

    return foodParticles;
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
        const candidateX = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
        const candidateY = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
        const position = sections > 1
          ? this.constrainPointToArena(candidateX, candidateY, 28)
          : this.getRandomArenaPosition(28);

        // Clone base genome so organisms are independent but remain same species
        const genome = baseGenomes[s].clone();

        // Create organism with founder ID
        // First organism (speciesFounderId=null): becomes its own founder
        // Subsequent organisms: inherit the first organism's ID as founder
        const organism = new Organism(position.x, position.y, genome, null, speciesFounderId);

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

      const position = this.constrainPointToArena(food.x, food.y, 20);
      food.x = position.x;
      food.y = position.y;

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
   * Get current environment parameters
   */
  getEnvironmentParams() {
    return {
      foodSpawnRate: this.foodSpawnRate,
      temperature: this.temperature,
      mutationRate: this.mutationRate,
      initialPopulation: this.initialPopulation,
      initialFoodCount: this.initialFoodCount,
      initialSpecies: this.initialSpecies,
      separationSections: this.separationSections,
    };
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
    this.organismPriorities.clear();
    this.prioritizedOrganisms = [];
    this.currentUpdateIndex = 0;
    this.lastPriorityUpdate = 0;
    this.updateCycle = 0;
    this.time = 0;
    this.playerOrganism = null;
    this.statsTracker.clear();
    this.genealogyTracker.clear();
    this.combatKills = 0;
    this.cooperationEvents = 0;
    this.colonyManager.clear();

    // Clear species tracking
    this.speciesFounders.clear();
    this.speciationEvents = [];
    this.speciesNames.clear();
    this.speciesProfiles.clear();
    this.provisionalStrains.clear();
    this.nextProvisionalStrainId = 1;
    this.lastSpeciesProfileUpdate = 0;
    this.lastProvisionalStrainUpdate = 0;

    // Reset organism ID counter for clean restarts
    Organism.nextId = 1;
  }

  /**
   * Get world statistics
   */
  getStats() {
    const alive = this.getAliveOrganisms();
    const colonyStats = this.colonyManager.getStats();
    return {
      totalOrganisms: this.organisms.length,
      aliveOrganisms: alive.length,
      foodParticles: this.foodParticles.length,
      worldTime: this.time.toFixed(1),
      averageEnergy: alive.length > 0
        ? (alive.reduce((sum, org) => sum + org.energy, 0) / alive.length).toFixed(1)
        : 0,
      ...colonyStats
    };
  }
}
