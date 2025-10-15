import { Genome } from '../genetics/Genome.js';

/**
 * Organism - Base class for all living entities in the simulation
 * Organisms have DNA, phenotype, and behaviors
 */
export class Organism {
  static nextId = 1;

  constructor(x, y, genome = null, parentId = null) {
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
    this.maxAge = 60000 + Math.random() * 30000; // 60-90 seconds lifespan
    this.isAlive = true;

    // Parent tracking (for offspring protection)
    this.parentId = parentId;
    this.birthTime = Date.now();

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

    // Aggression gene
    if (proteins.aggression) {
      const aggressionProtein = proteins.aggression;
      // Aggression based on charged amino acids and aromatic content
      const aggFactor = (aggressionProtein.properties.aromatic * 2 +
                        aggressionProtein.properties.positive) / aggressionProtein.properties.length;
      phenotype.aggression = Math.max(0, Math.min(1, aggFactor * 0.3)); // 0-1 scale
      phenotype.cooperativeness = 1 - phenotype.aggression; // Inverse relationship
    } else {
      phenotype.aggression = 0.5;
      phenotype.cooperativeness = 0.5;
    }

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
   * Check if can reproduce
   */
  canReproduce() {
    return this.isAlive &&
           this.energy >= this.phenotype.reproductionThreshold &&
           this.age > 100; // Minimum age
  }

  /**
   * Reproduce (asexual) with automatic mutations
   */
  reproduce(mutationRate = 0.05) {
    if (!this.canReproduce()) return null;

    // Pay reproduction cost
    this.energy -= this.phenotype.reproductionCost;

    // Clone genome
    const childGenome = this.genome.clone();

    // Apply random mutations based on mutation rate
    if (Math.random() < mutationRate) {
      const geneNames = childGenome.getGeneNames();
      const randomGene = geneNames[Math.floor(Math.random() * geneNames.length)];
      const gene = childGenome.getGene(randomGene);
      const sequence = gene.dna.toString();

      // Choose random mutation type (favor smaller mutations)
      const mutationTypes = ['point', 'point', 'point', 'insertion', 'deletion']; // Weighted toward point mutations
      const mutationType = mutationTypes[Math.floor(Math.random() * mutationTypes.length)];
      const randomPosition = Math.floor(Math.random() * sequence.length);

      try {
        childGenome.mutateGene(randomGene, mutationType, randomPosition);
      } catch (error) {
        // Mutation failed, continue without it
        console.log('Mutation failed during reproduction:', error.message);
      }
    }

    // Create offspring near parent
    const offsetX = (Math.random() - 0.5) * 30;
    const offsetY = (Math.random() - 0.5) * 30;
    const offspring = new Organism(this.x + offsetX, this.y + offsetY, childGenome, this.id);

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

  /**
   * Calculate genome similarity with another organism (0-1 scale)
   * Used to determine if organisms are same species
   */
  getGenomeSimilarity(other) {
    if (!other || !other.genome) return 0;

    const genes1 = this.genome.getGeneNames();
    const genes2 = other.genome.getGeneNames();

    // Must have same genes to be considered
    if (genes1.length !== genes2.length) return 0;

    let totalSimilarity = 0;
    let geneCount = 0;

    for (const geneName of genes1) {
      const gene1 = this.genome.getGene(geneName);
      const gene2 = other.genome.getGene(geneName);

      if (!gene1 || !gene2) continue;

      const seq1 = gene1.dna.toString();
      const seq2 = gene2.dna.toString();

      // Calculate sequence similarity (simple matching)
      const maxLen = Math.max(seq1.length, seq2.length);
      const minLen = Math.min(seq1.length, seq2.length);
      let matches = 0;

      for (let i = 0; i < minLen; i++) {
        if (seq1[i] === seq2[i]) matches++;
      }

      const geneSimilarity = matches / maxLen;
      totalSimilarity += geneSimilarity;
      geneCount++;
    }

    return geneCount > 0 ? totalSimilarity / geneCount : 0;
  }

  /**
   * Check if organism is same species as another (>80% genome similarity)
   */
  isSameSpecies(other) {
    return this.getGenomeSimilarity(other) > 0.8;
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
   * Get species identifier (hash of genome structure)
   */
  getSpeciesId() {
    if (this._speciesId) return this._speciesId;

    // Create a simple hash based on genome structure
    const genes = this.genome.getGeneNames().sort();
    let hash = 0;

    for (const geneName of genes) {
      const gene = this.genome.getGene(geneName);
      const seq = gene.dna.toString();

      // Simple hash function
      for (let i = 0; i < seq.length; i++) {
        hash = ((hash << 5) - hash) + seq.charCodeAt(i);
        hash = hash & hash; // Convert to 32bit integer
      }
    }

    this._speciesId = Math.abs(hash);
    return this._speciesId;
  }
}
