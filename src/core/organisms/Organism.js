import { Genome } from '../genetics/Genome.js';

/**
 * Organism - Base class for all living entities in the simulation
 * Organisms have DNA, phenotype, and behaviors
 */
export class Organism {
  static nextId = 1;

  constructor(x, y, genome = null) {
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
    this.isAlive = true;

    // DNA points for mutations
    this.dnaPoints = 0;

    // Express genome to set phenotype
    this.expressGenome();
  }

  /**
   * Express genome to determine phenotype
   */
  expressGenome() {
    const proteins = this.genome.expressAllGenes();

    // Calculate phenotype from expressed proteins
    this.phenotype = this.calculatePhenotype(proteins);
  }

  /**
   * Calculate phenotype from proteins
   * This is where genes affect physical traits
   */
  calculatePhenotype(proteins) {
    const phenotype = {
      // Size
      size: 10,
      mass: 1,

      // Movement
      maxSpeed: 2,
      acceleration: 0.1,

      // Defense
      armor: 0,
      toxicity: 0,

      // Metabolism
      metabolicRate: 1,
      energyEfficiency: 1,

      // Reproduction
      reproductionCost: 50,
      reproductionThreshold: 80,

      // Sensory
      visionRange: 100,
      detectionRadius: 50,

      // Visual
      color: { h: 180, s: 60, l: 50 },
      segments: 1
    };

    // Size gene
    if (proteins.size) {
      const sizeProtein = proteins.size;
      phenotype.size = 8 + sizeProtein.properties.length * 0.8;
      phenotype.mass = phenotype.size / 10;
    }

    // Speed gene
    if (proteins.speed) {
      const speedProtein = proteins.speed;
      const flexibility = speedProtein.getFlexibility();
      phenotype.maxSpeed = 1 + flexibility * 0.3;
      phenotype.acceleration = 0.05 + speedProtein.properties.tiny * 0.02;
    }

    // Defense gene
    if (proteins.defense) {
      const defenseProtein = proteins.defense;
      phenotype.armor = defenseProtein.properties.hydrophobic * 0.5;
      phenotype.toxicity = defenseProtein.properties.aromatic > 2 ? 1 : 0;
    }

    // Metabolism gene
    if (proteins.metabolism) {
      const metabProtein = proteins.metabolism;
      const charge = Math.abs(metabProtein.getCharge());
      phenotype.metabolicRate = 0.5 + charge * 0.1;
      phenotype.energyEfficiency = 1 + metabProtein.properties.hydrophobicRatio;
    }

    // Reproduction gene
    if (proteins.reproduction) {
      const reproProtein = proteins.reproduction;
      phenotype.reproductionCost = 40 + reproProtein.properties.length * 2;
      phenotype.reproductionThreshold = 70 + reproProtein.properties.large;
    }

    // Sensory gene
    if (proteins.sensory) {
      const sensoryProtein = proteins.sensory;
      phenotype.visionRange = 80 + sensoryProtein.properties.aromatic * 15;
      phenotype.detectionRadius = 40 + sensoryProtein.properties.positive * 8;
    }

    // Pigmentation (if gene exists)
    if (proteins.pigmentation) {
      const pigmentProtein = proteins.pigmentation;
      const hue = (pigmentProtein.properties.positive * 60 +
                   pigmentProtein.properties.negative * 30 +
                   pigmentProtein.properties.aromatic * 90) % 360;
      const saturation = Math.min(40 + pigmentProtein.properties.hydrophobic * 5, 95);
      const lightness = Math.max(30, Math.min(70, 50 - pigmentProtein.properties.tiny * 3));

      phenotype.color = { h: hue, s: saturation, l: lightness };
    }

    // Structure (if gene exists)
    if (proteins.structure) {
      const structProtein = proteins.structure;
      phenotype.segments = Math.max(1, Math.min(4, Math.floor(structProtein.properties.length / 4)));
    }

    return phenotype;
  }

  /**
   * Update organism state (called each frame)
   */
  update(deltaTime) {
    if (!this.isAlive) return;

    // Age
    this.age += deltaTime;

    // Convert deltaTime from ms to seconds for energy calculation
    const deltaSeconds = deltaTime / 1000;

    // Consume energy based on metabolism (MUCH slower now)
    const energyCost = this.phenotype.metabolicRate * deltaSeconds *
                       (this.phenotype.size / 10) *
                       (1 + Math.abs(this.vx) + Math.abs(this.vy)) * 0.05; // Reduced to 5% of original
    this.energy -= energyCost;

    // Die if out of energy
    if (this.energy <= 0) {
      this.die();
      return;
    }

    // Generate DNA points over time (slower)
    this.dnaPoints += deltaSeconds * 0.1;

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

    // Generate DNA points from feeding
    this.dnaPoints += absorbed * 0.05;
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
   * Reproduce (asexual)
   */
  reproduce() {
    if (!this.canReproduce()) return null;

    // Pay reproduction cost
    this.energy -= this.phenotype.reproductionCost;

    // Clone genome with potential mutations
    const childGenome = this.genome.clone();

    // Create offspring near parent
    const offsetX = (Math.random() - 0.5) * 30;
    const offsetY = (Math.random() - 0.5) * 30;
    const offspring = new Organism(this.x + offsetX, this.y + offsetY, childGenome);

    // Give some initial energy
    offspring.energy = this.phenotype.reproductionCost * 0.3;

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
}
