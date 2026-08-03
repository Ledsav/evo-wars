import { Genome } from '../genetics/Genome.js';
import { VisualPhenotype } from '../../rendering/visual/VisualPhenotype.js';
import { PhenotypeComparator } from './PhenotypeComparator.js';
import { TraitCalculator } from './TraitCalculator.js';
import { applyCellSpecialization } from './CellSpecialization.js';

/**
 * Organism - Base class for all living entities in the simulation
 * Organisms have DNA, phenotype, and behaviors
 *
 * Species concept: Phylotype clustering for asexual organisms
 * - Organisms inherit species founder from parent
 * - Become new species founder if phenotypic/genetic distance exceeds threshold
 * - Mimics bacterial speciation (ecotype differentiation)
 */
export class Organism {
  static nextId = 1;

  constructor(x, y, genome = null, parentId = null, speciesFounderId = null) {
    this.id = Organism.nextId++;
    this.genome = genome || Genome.createDefault();

    // Position and physics
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.rotation = 0;

    // Phenotype (physical traits derived from genes)
    this.phenotype = {};

    // Life stats
    this.energy = 100;
    this.maxEnergy = 100;
    this.age = 0;
    this.longevityVariation = 0.86 + Math.random() * 0.28;
    this.maxAge = 60000;
    this.isAlive = true;

    // Parent tracking (for offspring protection)
    this.parentId = parentId;
    this.birthTime = Date.now();

    // Species tracking (phylotype clustering)
    // If no founder specified, this organism is its own species founder
    this.speciesFounderId = speciesFounderId !== null ? speciesFounderId : this.id;
    this._cachedSpeciesId = null; // Cache for getSpeciesId()
    this._founderPhenotype = null; // Will be set after expressing genome
    this._speciesInfo = null; // Cache for species name/emoji (set by World)
    this._provisionalStrainId = null;
    this.cellRole = 'generalist';
    this.cellRoleTarget = 'generalist';
    this.roleExpression = 0;
    this.roleTargetSince = 0;
    this._roleExpressionBucket = -1;

    // Express genome to set phenotype
    this.expressGenome();
    this.maxAge = this.calculateMaximumAge();

    // If this is a founder, cache its phenotype for comparison
    if (this.speciesFounderId === this.id) {
      this._founderPhenotype = this.basePhenotype;
    }
  }

  /**
   * Express genome to determine phenotype
   */
  expressGenome() {
    const proteins = this.genome.expressAllGenes();

    this.basePhenotype = this.calculatePhenotype(proteins);
    this.applyCellRoleExpression(true);
  }

  setCellRoleTarget(role, currentTime = 0) {
    const nextRole = role || 'generalist';
    if (this.cellRoleTarget === nextRole) return;
    this.cellRoleTarget = nextRole;
    this.roleTargetSince = currentTime;
  }

  updateCellDifferentiation(deltaSeconds) {
    if (this.cellRole === this.cellRoleTarget) {
      if (this.cellRole === 'generalist') {
        this.roleExpression = 0;
      } else {
        this.roleExpression = Math.min(1, this.roleExpression + deltaSeconds * 0.12);
      }
    } else if (this.roleExpression > 0) {
      this.roleExpression = Math.max(0, this.roleExpression - deltaSeconds * 0.08);
    } else {
      this.cellRole = this.cellRoleTarget;
    }

    this.applyCellRoleExpression();
  }

  applyCellRoleExpression(force = false) {
    if (!this.basePhenotype) return;
    const expressionBucket = Math.round(this.roleExpression * 20);
    if (!force && expressionBucket === this._roleExpressionBucket) return;

    this._roleExpressionBucket = expressionBucket;
    this.phenotype = applyCellSpecialization(
      this.basePhenotype,
      this.cellRole,
      this.roleExpression
    );
  }

  getExpressedCellRole() {
    return this.cellRole !== 'generalist' && this.roleExpression >= 0.25
      ? this.cellRole
      : 'generalist';
  }

  calculateMaximumAge() {
    const size = this.basePhenotype?.size || this.phenotype.size || 8;
    const metabolicRate =
      this.basePhenotype?.metabolicRate ||
      this.phenotype.metabolicRate ||
      0.5;
    const sizeProgress = Math.max(0, Math.min(1, (size - 8) / 12));
    const sizeAdjustedLife = 55000 + sizeProgress * 90000;
    const metabolicPenalty = 1 + Math.max(0, metabolicRate - 0.5) * 0.18;

    return sizeAdjustedLife * this.longevityVariation / metabolicPenalty;
  }

  refreshVisualPhenotype() {
    const proteins = this.genome.expressAllGenes();
    const visual = VisualPhenotype.create(
      this.genome,
      proteins,
      this.basePhenotype || this.phenotype,
      this.speciesFounderId
    );
    if (this.basePhenotype) this.basePhenotype.visual = visual;
    this.phenotype.visual = visual;
  }

  /**
   * Calculate color pattern based on pigmentation protein
   */
  calculateColorPattern(pigmentProtein) {
    const { properties } = pigmentProtein;

    // Determine pattern type based on amino acid distribution
    const polarRatio = properties.polar / Math.max(1, properties.length);
    const largeRatio = properties.large / Math.max(1, properties.length);
    const tinyRatio = properties.tiny / Math.max(1, properties.length);

    let patternType = 'solid';
    let intensity = 0;

    // Pattern selection based on protein structure
    if (largeRatio > 0.5) {
      patternType = 'spots';
      intensity = Math.min(1, largeRatio * 1.5);
    } else if (polarRatio > 0.6) {
      patternType = 'stripes';
      intensity = Math.min(1, polarRatio * 1.3);
    } else if (tinyRatio > 0.4) {
      patternType = 'gradient';
      intensity = Math.min(1, tinyRatio * 2);
    } else if (properties.aromatic > properties.length * 0.3) {
      patternType = 'mottled';
      intensity = Math.min(1, (properties.aromatic / properties.length) * 2);
    }

    return {
      type: patternType,
      intensity: intensity,
      secondaryHueShift: (properties.aliphatic * 30) % 60 // Secondary color variation
    };
  }

  /**
   * Calculate phenotype from proteins
   * Uses TraitCalculator for explicit, well-documented trait formulas
   */
  calculatePhenotype(proteins) {
    // Initialize phenotype with default values (used when proteins are missing)
    const phenotype = {
      // Visual (non-genetic defaults)
      color: { h: 180, s: 60, l: 50 },
      segments: 1
    };

    // Calculate size traits
    phenotype.size = TraitCalculator.calculateSize(proteins.size);
    phenotype.mass = TraitCalculator.calculateMass(phenotype);

    // Calculate movement traits
    const movement = TraitCalculator.calculateMovement(proteins.speed);
    Object.assign(phenotype, movement);

    // Calculate defense traits
    const defense = TraitCalculator.calculateDefense(proteins.defense);
    Object.assign(phenotype, defense);

    // Calculate metabolism traits
    const metabolism = TraitCalculator.calculateMetabolism(proteins.metabolism);
    Object.assign(phenotype, metabolism);

    // Calculate reproduction traits
    const reproduction = TraitCalculator.calculateReproduction(proteins.reproduction);
    Object.assign(phenotype, reproduction);

    // Calculate sensory traits
    const sensory = TraitCalculator.calculateSensory(proteins.sensory);
    Object.assign(phenotype, sensory);

    // Calculate behavioral traits
    const behavior = TraitCalculator.calculateBehavior(proteins.aggression, proteins.cooperation);
    Object.assign(phenotype, behavior);

    const adhesion = TraitCalculator.calculateAdhesion(proteins.adhesion);
    Object.assign(phenotype, adhesion);

    // Pigmentation (if gene exists)
    if (proteins.pigmentation) {
      const pigmentProtein = proteins.pigmentation;

      // Enhanced color calculation based on protein properties
      // Hue: Based on charged and aromatic amino acids (0-360 degrees)
      const hue = (pigmentProtein.properties.positive * 45 +
                   pigmentProtein.properties.negative * 120 +
                   pigmentProtein.properties.aromatic * 180 +
                   pigmentProtein.properties.hydrophobic * 15) % 360;

      // Saturation: Based on aromatic content and charge (30-95%)
      const aromaticFactor = pigmentProtein.properties.aromatic / Math.max(1, pigmentProtein.properties.length);
      const chargeFactor = (pigmentProtein.properties.positive + pigmentProtein.properties.negative) /
                          Math.max(1, pigmentProtein.properties.length);
      const saturation = Math.min(Math.max(30, 40 + aromaticFactor * 80 + chargeFactor * 40), 95);

      // Lightness: Based on hydrophobic vs hydrophilic balance (25-75%)
      const hydrophobicRatio = pigmentProtein.properties.hydrophobic / Math.max(1, pigmentProtein.properties.length);
      const hydrophilicRatio = pigmentProtein.properties.hydrophilic / Math.max(1, pigmentProtein.properties.length);
      const lightness = Math.max(25, Math.min(75, 50 + (hydrophilicRatio - hydrophobicRatio) * 50));

      phenotype.color = { h: hue, s: saturation, l: lightness };

      // Add visual variation properties based on protein structure
      phenotype.colorPattern = this.calculateColorPattern(pigmentProtein);
    } else {
      // Default color if no pigmentation gene
      phenotype.color = { h: 180, s: 60, l: 50 };
      phenotype.colorPattern = { type: 'solid', intensity: 0 };
    }

    // Structure (if gene exists)
    if (proteins.structure) {
      const structProtein = proteins.structure;
      phenotype.segments = Math.max(1, Math.min(4, Math.floor(structProtein.properties.length / 4)));
    }

    phenotype.visual = VisualPhenotype.create(
      this.genome,
      proteins,
      phenotype,
      this.speciesFounderId
    );

    return phenotype;
  }

  /**
   * Update organism state (called each frame)
   */
  update(deltaTime) {
    if (!this.isAlive) return;

    // Age
    this.age += deltaTime;

    // Die of old age
    if (this.age >= this.maxAge) {
      this.die();
      return;
    }

    // Convert deltaTime from ms to seconds for energy calculation
    const deltaSeconds = deltaTime / 1000;
    this.updateCellDifferentiation(deltaSeconds);

    // Consume energy based on metabolism (increased from 0.05 to 0.15 - 3x faster death)
    const energyCost = this.phenotype.metabolicRate * deltaSeconds *
                       (this.phenotype.size / 10) *
                       (1 + Math.abs(this.vx) + Math.abs(this.vy)) * 0.15;
    this.energy -= energyCost;

    // Die if out of energy
    if (this.energy <= 0) {
      this.die();
      return;
    }

    // Update physics
    this.updatePhysics(deltaTime);
  }

  /**
   * Update physics
   */
  updatePhysics(deltaTime) {
    // Convert deltaTime to seconds and scale down movement
    const deltaSeconds = deltaTime / 1000;

    // Apply velocity (scaled down to 30 pixels per second per unit velocity)
    this.x += this.vx * deltaSeconds * 30;
    this.y += this.vy * deltaSeconds * 30;

    // Apply friction
    const friction = 0.95;
    this.vx *= friction;
    this.vy *= friction;

    // Update rotation based on velocity
    if (Math.abs(this.vx) > 0.1 || Math.abs(this.vy) > 0.1) {
      this.rotation = Math.atan2(this.vy, this.vx);
    }
  }

  /**
   * Move in a direction
   */
  move(dx, dy) {
    if (!this.isAlive) return;

    const speed = this.phenotype.maxSpeed;
    const accel = this.phenotype.acceleration;

    this.vx += dx * accel * speed;
    this.vy += dy * accel * speed;

    // Limit speed
    const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (currentSpeed > speed) {
      this.vx = (this.vx / currentSpeed) * speed;
      this.vy = (this.vy / currentSpeed) * speed;
    }
  }

  /**
   * Consume food/energy
   */
  consume(energyAmount) {
    if (!this.isAlive) return;

    const absorbed = energyAmount * this.phenotype.energyEfficiency;
    this.energy = Math.min(this.maxEnergy, this.energy + absorbed);
  }

  /**
   * Share energy with another organism (cooperation)
   * Returns true if cooperation occurred
   */
  cooperateWith(other) {
    if (!this.isAlive || !other.isAlive) return false;

    // Must be same species to cooperate
    if (!this.isSameSpecies(other)) return false;

    // Don't cooperate with self
    if (this.id === other.id) return false;

    // Check if this organism is cooperative enough
    if (this.phenotype.cooperativeness < 0.3) return false;

    // Check if this organism has enough energy to share
    const sharingThreshold = this.maxEnergy * 0.4; // Only share if above 40% energy
    if (this.energy < sharingThreshold) return false;

    // Check if other needs energy (below 70% energy)
    const needsHelp = other.energy < other.maxEnergy * 0.7;
    if (!needsHelp) return false;

    // Share energy based on cooperationAmount trait
    const amountToShare = Math.min(
      this.phenotype.cooperationAmount,
      this.energy - sharingThreshold, // Don't go below threshold
      other.maxEnergy - other.energy  // Don't overfill recipient
    );

    if (amountToShare > 0) {
      this.energy -= amountToShare;
      other.energy = Math.min(other.maxEnergy, other.energy + amountToShare);
      return true;
    }

    return false;
  }

  /**
   * Check if can reproduce
   */
  canReproduce() {
    return this.isAlive &&
           this.energy >= this.phenotype.reproductionThreshold &&
           this.age > 100; // Minimum age
  }

  /**
   * Reproduce (asexual) with automatic mutations
   * Implements phylotype-based speciation for asexual organisms
   */
  reproduce(mutationRate = 0.05, world = null) {
    if (!this.canReproduce()) return null;

    // Pay reproduction cost
    this.energy -= this.phenotype.reproductionCost;

    // Clone genome
    const childGenome = this.genome.clone();

    // Track if mutation occurred
    let mutationOccurred = false;

    // Apply mutations using each gene's inherited repair stability
    if (Math.random() < mutationRate) {
      const mutationPlan = childGenome.createMutationPlan();

      try {
        if (mutationPlan) {
          const mutationResult = childGenome.mutateGene(
            mutationPlan.geneName,
            mutationPlan.mutationType,
            mutationPlan.position,
            mutationPlan.extraParams
          );
          mutationOccurred = mutationResult.success;
          if (mutationOccurred) childGenome.maybeReallocateStability();
        }
      } catch (error) {
        // Mutation failed, continue without it
        console.log('Mutation failed during reproduction:', error.message);
      }
    }

    // Create offspring at the parent membrane so cytokinesis can retain a bond
    const divisionAngle = Math.random() * Math.PI * 2;

    // Initially inherit parent's species founder
    const offspring = new Organism(
      this.x,
      this.y,
      childGenome,
      this.id,
      this.speciesFounderId
    );
    const membraneDistance =
      (this.phenotype.size + offspring.phenotype.size) * 1.04;
    offspring.x = this.x + Math.cos(divisionAngle) * membraneDistance;
    offspring.y = this.y + Math.sin(divisionAngle) * membraneDistance;

    // Give some initial energy
    offspring.energy = this.phenotype.reproductionCost * 0.3;

    // Inherit parent's section assignment (for species segregation)
    if (this._assignedSection !== undefined) {
      offspring._assignedSection = this._assignedSection;
    }

    if (this._provisionalStrainId) {
      offspring._provisionalStrainId = this._provisionalStrainId;
    }

    if (world) {
      if (offspring._provisionalStrainId && world.registerProvisionalOffspring) {
        world.registerProvisionalOffspring(
          offspring,
          offspring._provisionalStrainId,
          mutationOccurred
        );
      } else if (mutationOccurred) {
        offspring.checkSpeciation(world);
      }
    }

    return offspring;
  }

  /**
   * Take damage
   */
  takeDamage(amount) {
    if (!this.isAlive) return;

    const actualDamage = Math.max(0, amount - this.phenotype.armor);
    this.energy -= actualDamage;

    if (this.energy <= 0) {
      this.die();
    }
  }

  /**
   * Die
   */
  die() {
    this.isAlive = false;
    this.energy = 0;
  }

  /**
   * Check collision with another organism
   */
  collidesWith(other) {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = this.phenotype.size + other.phenotype.size;

    return distance < minDistance;
  }

  /**
   * Get distance to another organism
   */
  distanceTo(other) {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate genome similarity with another organism (0-1 scale)
   * Used to determine if organisms are same species
   */
  getGenomeSimilarity(other) {
    return PhenotypeComparator.calculateGenomeSimilarity(this, other);
  }


  /**
   * Check if this organism is parent or child of another
   * Protection window: 10 seconds after birth
   */
  isParentChildRelation(other) {
    const protectionWindow = 10000; // 10 seconds in ms
    const timeSinceBirth = Date.now() - this.birthTime;
    const timeSinceOtherBirth = Date.now() - other.birthTime;

    // Check if this is child of other (within protection window)
    if (this.parentId === other.id && timeSinceBirth < protectionWindow) {
      return true;
    }

    // Check if other is child of this (within protection window)
    if (other.parentId === this.id && timeSinceOtherBirth < protectionWindow) {
      return true;
    }

    return false;
  }

  /**
   * Check if this organism should become a new species founder
   * Called after mutations to detect speciation events
   *
   * Biological rationale:
   * - In asexual organisms, species diverge through accumulated mutations
   * - When phenotypic/genetic distance from founder exceeds threshold, speciation occurs
   * - This mimics bacterial adaptive radiation and ecotype differentiation
   */
  checkSpeciation(world) {
    if (world?.evaluateSpeciesCandidate) {
      return world.evaluateSpeciesCandidate(this);
    }

    // Can't speciate if we ARE the founder
    if (this.speciesFounderId === this.id) {
      return false;
    }

    // Get the species founder organism from world
    const founder = world.getOrganismById(this.speciesFounderId);

    // If founder not found (extinct), become new founder
    if (!founder) {
      this.becomeSpeciesFounder(world);
      return true;
    }

    // Check phenotypic and genetic distance from founder
    const shouldSpeciate = PhenotypeComparator.shouldSpeciate(this, founder);

    if (shouldSpeciate) {
      this.becomeSpeciesFounder(world);
      return true;
    }

    return false;
  }

  /**
   * Promote this organism to species founder
   * Creates a new species lineage
   */
  becomeSpeciesFounder(world) {
    const oldSpeciesId = this.speciesFounderId;
    this.speciesFounderId = this.id;
    this._cachedSpeciesId = null; // Clear cache
    this.refreshVisualPhenotype();
    this._founderPhenotype = this.basePhenotype; // Cache phenotype for descendants

    // Notify world of speciation event
    if (world && world.onSpeciationEvent) {
      world.onSpeciationEvent(this, oldSpeciesId);
    }
  }

  /**
   * Get species identifier
   * Returns the ID of the species founder organism
   *
   * This is stable across generations until speciation occurs,
   * unlike hash-based approaches which change with every mutation.
   */
  getSpeciesId() {
    if (this._cachedSpeciesId !== null) {
      return this._cachedSpeciesId;
    }

    this._cachedSpeciesId = this.speciesFounderId;
    return this._cachedSpeciesId;
  }

  /**
   * Get phenotypic distance from species founder
   * Useful for tracking evolutionary divergence
   */
  getPhenotypicDistanceFromFounder(world) {
    if (this.speciesFounderId === this.id) {
      return 0; // We ARE the founder
    }

    const reference = world?.getSpeciesReference
      ? world.getSpeciesReference(this.speciesFounderId)
      : world?.getOrganismById(this.speciesFounderId);
    if (!reference) {
      return 1.0; // Maximum distance if founder not found
    }

    return PhenotypeComparator.calculateDistance(this, reference);
  }

  /**
   * Check if organism is same species as another
   * Now based on shared species founder rather than genome similarity
   */
  isSameSpecies(other) {
    return this.speciesFounderId === other.speciesFounderId;
  }

  /**
   * Get species name information
   * Returns cached {name, code, emoji} or generates default if not set
   */
  getSpeciesInfo() {
    if (this._speciesInfo) {
      return this._speciesInfo;
    }

    // Return default if not yet assigned by World
    return {
      name: `Species ${this.speciesFounderId}`,
      code: `SP-${String(this.speciesFounderId).padStart(3, '0')}`,
      emoji: '🦠'
    };
  }

  /**
   * Set species info (called by World when organism is added)
   */
  setSpeciesInfo(info) {
    this._speciesInfo = info;
  }
}
