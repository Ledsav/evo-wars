/**
 * TraitCalculator - Encapsulates all rules for converting protein properties to phenotype traits
 *
 * This class defines the explicit mapping between genetic information (proteins) and
 * physical/behavioral traits (phenotype). Each trait has:
 * - A clear formula showing which protein properties are used
 * - Expected output range
 * - Weights and scaling factors
 *
 * Design Philosophy:
 * - Use RATIOS (0-1) instead of raw counts for consistent scaling
 * - Common amino acids (hydrophobic, polar, positive) for traits that should vary widely
 * - Rare amino acids (aromatic) for special/rare traits
 * - Each trait formula is independent and clearly documented
 */
export class TraitCalculator {
  /**
   * TRAIT CONFIGURATION
   * Defines all rules, weights, and ranges for trait calculations
   */
  static TRAIT_RULES = {
    // SIZE: Physical size of organism
    // Based on: Protein length (longer proteins = larger organisms)
    // Range: 8-20 units
    size: {
      baseValue: 8,
      formula: (protein) => 8 + protein.properties.length * 0.8,
      expectedRange: [8, 20],
      weights: { length: 0.8 },
      description: 'Physical size - longer size genes create larger organisms'
    },

    // MASS: Physical mass derived from size
    // Based on: Size (direct proportion)
    // Range: 0.8-2.0 units
    mass: {
      baseValue: 1,
      formula: (protein, phenotype) => phenotype.size / 10,
      expectedRange: [0.8, 2.0],
      weights: { sizeFactor: 0.1 },
      description: 'Mass calculated from size (size/10)'
    },

    // MAX SPEED: Maximum movement speed
    // Based on: Protein flexibility (tiny + small amino acids)
    // Range: 1.0-3.0 units
    maxSpeed: {
      baseValue: 1,
      formula: (protein) => {
        const flexibility = protein.getFlexibility(); // tiny + small count
        return 1 + flexibility * 0.3;
      },
      expectedRange: [1.0, 3.0],
      weights: { flexibility: 0.3 },
      description: 'Movement speed - flexible proteins (small/tiny amino acids) enable faster movement'
    },

    // ACCELERATION: How quickly organism reaches max speed
    // Based on: Tiny amino acids (quick, nimble movement)
    // Range: 0.05-0.25
    acceleration: {
      baseValue: 0.05,
      formula: (protein) => 0.05 + protein.properties.tiny * 0.02,
      expectedRange: [0.05, 0.25],
      weights: { tiny: 0.02 },
      description: 'Acceleration rate - tiny amino acids provide quick response'
    },

    // ARMOR: Physical defense (damage reduction)
    // Based on: Hydrophobic amino acids (tough, water-resistant exterior)
    // Range: 0-8 (chart expects 0-10, but 8 is practical max)
    armor: {
      baseValue: 0,
      formula: (protein) => protein.properties.hydrophobicRatio * 8,
      expectedRange: [0, 8],
      weights: { hydrophobicRatio: 8 },
      description: 'Physical armor - hydrophobic proteins create tough protective layers'
    },

    // TOXICITY: Chemical defense
    // Based on: Aromatic amino acids (rare, special compounds)
    // Range: 0-1 (intentionally rare - aromatic amino acids are uncommon)
    toxicity: {
      baseValue: 0,
      formula: (protein) => protein.properties.aromaticRatio,
      expectedRange: [0, 1],
      weights: { aromaticRatio: 1 },
      description: 'Chemical toxins - rare aromatic amino acids produce toxic compounds'
    },

    // METABOLIC RATE: Energy consumption rate
    // Based on: Polar amino acids (active metabolism)
    // Range: 0.5-2.0
    metabolicRate: {
      baseValue: 0.5,
      formula: (protein) => 0.5 + protein.properties.polarRatio * 1.5,
      expectedRange: [0.5, 2.0],
      weights: { polarRatio: 1.5 },
      description: 'Energy burn rate - polar proteins drive active metabolism'
    },

    // ENERGY EFFICIENCY: How much energy absorbed from food
    // Based on: Hydrophobic amino acids (efficient energy storage)
    // Range: 1.0-2.0 (multiplier on food energy)
    energyEfficiency: {
      baseValue: 1,
      formula: (protein) => 1 + protein.properties.hydrophobicRatio,
      expectedRange: [1.0, 2.0],
      weights: { hydrophobicRatio: 1 },
      description: 'Energy absorption efficiency - hydrophobic proteins store energy better'
    },

    // REPRODUCTION COST: Energy cost to reproduce
    // Based on: Protein length (more complex = more expensive)
    // Range: 40-88 energy units
    reproductionCost: {
      baseValue: 40,
      formula: (protein) => 40 + protein.properties.length * 2,
      expectedRange: [40, 88],
      weights: { length: 2 },
      description: 'Energy cost of reproduction - longer genes require more energy to copy'
    },

    // REPRODUCTION THRESHOLD: Minimum energy to reproduce
    // Based on: Large amino acids (maturity requirement)
    // Range: 70-100 energy units
    reproductionThreshold: {
      baseValue: 70,
      formula: (protein) => 70 + protein.properties.largeRatio * 30,
      expectedRange: [70, 100],
      weights: { largeRatio: 30 },
      description: 'Energy threshold for reproduction - large proteins require more maturity'
    },

    // VISION RANGE: How far organism can detect food/threats
    // Based on: Polar amino acids (sensory proteins)
    // Range: 80-200 pixels
    visionRange: {
      baseValue: 80,
      formula: (protein) => 80 + protein.properties.polarRatio * 120,
      expectedRange: [80, 200],
      weights: { polarRatio: 120 },
      description: 'Visual detection range - polar amino acids enhance sensory perception'
    },

    // DETECTION RADIUS: Close-range detection (collision avoidance, etc.)
    // Based on: Positive amino acids (active sensing)
    // Range: 40-100 pixels
    detectionRadius: {
      baseValue: 40,
      formula: (protein) => 40 + protein.properties.positiveRatio * 60,
      expectedRange: [40, 100],
      weights: { positiveRatio: 60 },
      description: 'Close-range detection - charged positive proteins enable proximity sensing'
    },

    // AGGRESSION: Tendency to attack other organisms
    // Based on: Positive charge (aggressive) + hydrophobic (territorial)
    // Range: 0-1 (0 = peaceful, 1 = highly aggressive)
    aggression: {
      baseValue: 0.5,
      formula: (protein) => {
        const aggFactor = (protein.properties.positiveRatio * 1.5 +
                          protein.properties.hydrophobicRatio * 0.5);
        return Math.max(0, Math.min(1, aggFactor));
      },
      expectedRange: [0, 1],
      weights: { positiveRatio: 1.5, hydrophobicRatio: 0.5 },
      description: 'Aggression level - positive charge drives aggressive behavior, hydrophobic adds territoriality'
    },

    // COOPERATIVENESS: Tendency to cooperate with same species
    // Based on: Inverse of aggression
    // Range: 0-1 (inverse of aggression)
    cooperativeness: {
      baseValue: 0.5,
      formula: (protein, phenotype) => 1 - phenotype.aggression,
      expectedRange: [0, 1],
      weights: { inverseDependency: 'aggression' },
      description: 'Cooperation level - inverse of aggression'
    }
  };

  /**
   * Calculate size trait from size protein
   */
  static calculateSize(sizeProtein) {
    if (!sizeProtein) return TraitCalculator.TRAIT_RULES.size.baseValue;
    return TraitCalculator.TRAIT_RULES.size.formula(sizeProtein);
  }

  /**
   * Calculate mass trait from size
   */
  static calculateMass(phenotype) {
    return TraitCalculator.TRAIT_RULES.mass.formula(null, phenotype);
  }

  /**
   * Calculate movement traits from speed protein
   */
  static calculateMovement(speedProtein) {
    if (!speedProtein) {
      return {
        maxSpeed: TraitCalculator.TRAIT_RULES.maxSpeed.baseValue,
        acceleration: TraitCalculator.TRAIT_RULES.acceleration.baseValue
      };
    }

    return {
      maxSpeed: TraitCalculator.TRAIT_RULES.maxSpeed.formula(speedProtein),
      acceleration: TraitCalculator.TRAIT_RULES.acceleration.formula(speedProtein)
    };
  }

  /**
   * Calculate defense traits from defense protein
   */
  static calculateDefense(defenseProtein) {
    if (!defenseProtein) {
      return {
        armor: TraitCalculator.TRAIT_RULES.armor.baseValue,
        toxicity: TraitCalculator.TRAIT_RULES.toxicity.baseValue
      };
    }

    return {
      armor: TraitCalculator.TRAIT_RULES.armor.formula(defenseProtein),
      toxicity: TraitCalculator.TRAIT_RULES.toxicity.formula(defenseProtein)
    };
  }

  /**
   * Calculate metabolism traits from metabolism protein
   */
  static calculateMetabolism(metabolismProtein) {
    if (!metabolismProtein) {
      return {
        metabolicRate: TraitCalculator.TRAIT_RULES.metabolicRate.baseValue,
        energyEfficiency: TraitCalculator.TRAIT_RULES.energyEfficiency.baseValue
      };
    }

    return {
      metabolicRate: TraitCalculator.TRAIT_RULES.metabolicRate.formula(metabolismProtein),
      energyEfficiency: TraitCalculator.TRAIT_RULES.energyEfficiency.formula(metabolismProtein)
    };
  }

  /**
   * Calculate reproduction traits from reproduction protein
   */
  static calculateReproduction(reproductionProtein) {
    if (!reproductionProtein) {
      return {
        reproductionCost: TraitCalculator.TRAIT_RULES.reproductionCost.baseValue,
        reproductionThreshold: TraitCalculator.TRAIT_RULES.reproductionThreshold.baseValue
      };
    }

    return {
      reproductionCost: TraitCalculator.TRAIT_RULES.reproductionCost.formula(reproductionProtein),
      reproductionThreshold: TraitCalculator.TRAIT_RULES.reproductionThreshold.formula(reproductionProtein)
    };
  }

  /**
   * Calculate sensory traits from sensory protein
   */
  static calculateSensory(sensoryProtein) {
    if (!sensoryProtein) {
      return {
        visionRange: TraitCalculator.TRAIT_RULES.visionRange.baseValue,
        detectionRadius: TraitCalculator.TRAIT_RULES.detectionRadius.baseValue
      };
    }

    return {
      visionRange: TraitCalculator.TRAIT_RULES.visionRange.formula(sensoryProtein),
      detectionRadius: TraitCalculator.TRAIT_RULES.detectionRadius.formula(sensoryProtein)
    };
  }

  /**
   * Calculate behavioral traits from aggression protein
   */
  static calculateBehavior(aggressionProtein) {
    if (!aggressionProtein) {
      return {
        aggression: TraitCalculator.TRAIT_RULES.aggression.baseValue,
        cooperativeness: TraitCalculator.TRAIT_RULES.cooperativeness.baseValue
      };
    }

    const aggression = TraitCalculator.TRAIT_RULES.aggression.formula(aggressionProtein);
    const cooperativeness = TraitCalculator.TRAIT_RULES.cooperativeness.formula(null, { aggression });

    return {
      aggression,
      cooperativeness
    };
  }

  /**
   * Get documentation for all traits
   */
  static getTraitDocumentation() {
    const docs = {};
    for (const [traitName, config] of Object.entries(TraitCalculator.TRAIT_RULES)) {
      docs[traitName] = {
        description: config.description,
        baseValue: config.baseValue,
        expectedRange: config.expectedRange,
        weights: config.weights
      };
    }
    return docs;
  }

  /**
   * Validate that a phenotype trait is within expected range
   */
  static validateTrait(traitName, value) {
    const rule = TraitCalculator.TRAIT_RULES[traitName];
    if (!rule) return { valid: false, error: 'Unknown trait' };

    const [min, max] = rule.expectedRange;
    const withinRange = value >= min && value <= max;

    return {
      valid: withinRange,
      value,
      expectedRange: rule.expectedRange,
      outOfBounds: !withinRange,
      percentile: ((value - min) / (max - min)) * 100
    };
  }

  /**
   * Get a summary of how a specific protein affects traits
   */
  static analyzeProteinImpact(proteinName, protein) {
    const impact = {
      proteinName,
      sequence: protein.sequence,
      properties: protein.properties,
      traits: {}
    };

    // Map protein names to their trait calculation methods
    const proteinTraitMap = {
      size: ['size', 'mass'],
      speed: ['maxSpeed', 'acceleration'],
      defense: ['armor', 'toxicity'],
      metabolism: ['metabolicRate', 'energyEfficiency'],
      reproduction: ['reproductionCost', 'reproductionThreshold'],
      sensory: ['visionRange', 'detectionRadius'],
      aggression: ['aggression', 'cooperativeness']
    };

    const traits = proteinTraitMap[proteinName] || [];
    for (const traitName of traits) {
      const rule = TraitCalculator.TRAIT_RULES[traitName];
      if (rule) {
        impact.traits[traitName] = {
          description: rule.description,
          weights: rule.weights
        };
      }
    }

    return impact;
  }
}
