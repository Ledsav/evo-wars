/**
 * PhenotypeComparator - Calculates phenotypic distance between organisms
 * Used for determining species boundaries in asexual reproduction
 *
 * Biological basis: In asexual organisms (bacteria, archaea), species are defined
 * by phenotypic clustering and phylogenetic distance rather than reproductive compatibility.
 */
export class PhenotypeComparator {
  /**
   * Trait weights for phenotypic distance calculation
   * Higher weights = more important for species differentiation
   * Based on ecological and fitness significance
   */
  static TRAIT_WEIGHTS = {
    // Core survival traits (high weight)
    size: 2.0,              // Body size affects all interactions
    metabolicRate: 2.0,     // Fundamental metabolic difference

    // Functional traits (medium-high weight)
    maxSpeed: 1.5,          // Movement capability
    armor: 1.5,             // Defense mechanism
    visionRange: 1.2,       // Sensory capability

    // Behavioral traits (medium weight)
    aggression: 1.0,        // Behavioral ecology
    reproductionThreshold: 1.0,

    // Secondary traits (lower weight)
    energyEfficiency: 0.8,
    acceleration: 0.5,

    // Visual traits (lowest weight - less ecologically significant)
    colorHue: 0.3,
    colorSaturation: 0.2,
    colorLightness: 0.2
  };

  /**
   * Normalization ranges for each trait
   * Used to convert trait values to 0-1 scale for comparison
   */
  static TRAIT_RANGES = {
    size: { min: 8, max: 20 },
    metabolicRate: { min: 0.5, max: 2.0 },
    maxSpeed: { min: 1, max: 3 },
    armor: { min: 0, max: 10 },
    visionRange: { min: 80, max: 200 },
    aggression: { min: 0, max: 1 },
    reproductionThreshold: { min: 70, max: 100 },
    energyEfficiency: { min: 1, max: 3 },
    acceleration: { min: 0.1, max: 0.3 },
    colorHue: { min: 0, max: 360 },
    colorSaturation: { min: 0, max: 100 },
    colorLightness: { min: 0, max: 100 }
  };

  /**
   * Calculate phenotypic distance between two organisms
   * Returns a value between 0 (identical) and 1+ (very different)
   *
   * @param {Organism} organism1 - First organism
   * @param {Organism} organism2 - Second organism (typically the species founder)
   * @returns {number} Phenotypic distance (0-1+)
   */
  static calculateDistance(organism1, organism2) {
    if (!organism1?.phenotype || !organism2?.phenotype) {
      return 1.0; // Maximum distance if phenotype missing
    }

    const pheno1 = organism1.phenotype;
    const pheno2 = organism2.phenotype;

    let totalWeightedDistance = 0;
    let totalWeight = 0;

    // Calculate weighted Euclidean distance in trait space
    for (const [trait, weight] of Object.entries(this.TRAIT_WEIGHTS)) {
      let value1, value2;

      // Extract trait values (handle nested properties like color)
      if (trait.startsWith('color')) {
        const colorProp = trait.replace('color', '').toLowerCase();
        value1 = pheno1.color?.[colorProp[0]] || 0;
        value2 = pheno2.color?.[colorProp[0]] || 0;

        // Special handling for hue (circular scale 0-360)
        if (colorProp === 'hue') {
          const diff = Math.abs(value1 - value2);
          value1 = Math.min(diff, 360 - diff); // Shortest angular distance
          value2 = 0;
        }
      } else {
        value1 = pheno1[trait] || 0;
        value2 = pheno2[trait] || 0;
      }

      // Normalize to 0-1 scale
      const range = this.TRAIT_RANGES[trait];
      const normalized1 = this.normalize(value1, range.min, range.max);
      const normalized2 = this.normalize(value2, range.min, range.max);

      // Calculate squared difference (for Euclidean distance)
      const diff = normalized1 - normalized2;
      totalWeightedDistance += weight * diff * diff;
      totalWeight += weight;
    }

    // Return normalized distance (0-1+ scale)
    return Math.sqrt(totalWeightedDistance / totalWeight);
  }

  /**
   * Normalize a value to 0-1 scale based on min/max range
   */
  static normalize(value, min, max) {
    if (max === min) return 0;
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }

  /**
   * Calculate genome similarity between two organisms
   * Used as secondary check for speciation
   *
   * @param {Organism} organism1
   * @param {Organism} organism2
   * @returns {number} Similarity score (0-1, where 1 = identical)
   */
  static calculateGenomeSimilarity(organism1, organism2) {
    if (!organism1?.genome || !organism2?.genome) return 0;

    const genes1 = organism1.genome.getGeneNames();
    const genes2 = organism2.genome.getGeneNames();

    // Must have same genes
    if (genes1.length !== genes2.length) return 0;

    let totalSimilarity = 0;
    let geneCount = 0;

    for (const geneName of genes1) {
      const gene1 = organism1.genome.getGene(geneName);
      const gene2 = organism2.genome.getGene(geneName);

      if (!gene1 || !gene2) continue;

      const seq1 = gene1.dna.toString();
      const seq2 = gene2.dna.toString();

      // Calculate sequence similarity
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
   * Check if organism should speciate (become new species founder)
   * Uses combined phenotypic distance and genetic distance thresholds
   *
   * Biological rationale:
   * - Phenotypic distance > 0.25 = ~25% trait divergence (significant ecotype difference)
   * - Genetic similarity < 0.75 = ~25% DNA divergence (equivalent to bacterial species threshold)
   *
   * @param {Organism} organism - Organism to check
   * @param {Organism} founder - Species founder organism
   * @returns {boolean} True if organism should become new species
   */
  static shouldSpeciate(organism, founder) {
    const PHENOTYPIC_THRESHOLD = 0.25; // 25% phenotypic divergence
    const GENETIC_SIMILARITY_THRESHOLD = 0.75; // 75% genetic similarity minimum

    const phenoDistance = this.calculateDistance(organism, founder);
    const genoSimilarity = this.calculateGenomeSimilarity(organism, founder);

    // Speciate if either threshold is crossed
    return phenoDistance >= PHENOTYPIC_THRESHOLD ||
           genoSimilarity < GENETIC_SIMILARITY_THRESHOLD;
  }

  /**
   * Get detailed comparison report between two organisms
   * Useful for debugging and visualization
   */
  static getComparisonReport(organism1, organism2) {
    const phenoDistance = this.calculateDistance(organism1, organism2);
    const genoSimilarity = this.calculateGenomeSimilarity(organism1, organism2);
    const shouldSpeciate = this.shouldSpeciate(organism1, organism2);

    const traitDifferences = {};
    for (const trait of Object.keys(this.TRAIT_WEIGHTS)) {
      let value1, value2;

      if (trait.startsWith('color')) {
        const colorProp = trait.replace('color', '').toLowerCase();
        value1 = organism1.phenotype.color?.[colorProp[0]] || 0;
        value2 = organism2.phenotype.color?.[colorProp[0]] || 0;
      } else {
        value1 = organism1.phenotype[trait] || 0;
        value2 = organism2.phenotype[trait] || 0;
      }

      traitDifferences[trait] = {
        organism1: value1,
        organism2: value2,
        difference: Math.abs(value1 - value2)
      };
    }

    return {
      phenotypicDistance: phenoDistance,
      genomicSimilarity: genoSimilarity,
      shouldSpeciate: shouldSpeciate,
      traitDifferences: traitDifferences
    };
  }
}
