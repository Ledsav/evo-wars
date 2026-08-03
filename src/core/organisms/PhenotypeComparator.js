/**
 * PhenotypeComparator - Calculates phenotypic distance between organisms
 * Used for determining species boundaries in asexual reproduction
 *
 * Biological basis: In asexual organisms (bacteria, archaea), species are defined
 * by phenotypic clustering and phylogenetic distance rather than reproductive compatibility.
 */
export class PhenotypeComparator {
  static SPECIATION_THRESHOLD = 0.6;
  static EXISTING_SPECIES_MATCH_THRESHOLD = 0.45;

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
    adhesion: 0.8,

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
    adhesion: { min: 0, max: 1 },
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
    const pheno1 = this.getComparablePhenotype(organism1);
    const pheno2 = this.getComparablePhenotype(organism2);
    if (!pheno1 || !pheno2) {
      return 1.0; // Maximum distance if phenotype missing
    }

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
    const allGeneNames = new Set([...genes1, ...genes2]);

    let totalSimilarity = 0;
    let totalWeight = 0;

    for (const geneName of allGeneNames) {
      const gene1 = organism1.genome.getGene(geneName);
      const gene2 = organism2.genome.getGene(geneName);

      if (!gene1 || !gene2) {
        totalWeight++;
        continue;
      }

      const seq1 = gene1.dna.toString();
      const seq2 = gene2.dna.toString();
      const geneWeight = Math.max(seq1.length, seq2.length, 1);
      const sequenceSimilarity = this.calculateSequenceSimilarity(seq1, seq2);
      const stabilitySimilarity = 1 - Math.min(
        1,
        Math.abs((gene1.stability || 0.5) - (gene2.stability || 0.5))
      );
      totalSimilarity += (
        sequenceSimilarity * 0.92 + stabilitySimilarity * 0.08
      ) * geneWeight;
      totalWeight += geneWeight;
    }

    return totalWeight > 0 ? totalSimilarity / totalWeight : 0;
  }

  static getComparablePhenotype(organism) {
    return organism?.basePhenotype || organism?.phenotype || null;
  }

  /**
   * Compare sequences using k-mer Jaccard similarity.
   * Insertions and deletions affect local neighborhoods instead of shifting every base.
   */
  static calculateSequenceSimilarity(sequence1, sequence2, kmerSize = 4) {
    if (sequence1 === sequence2) return 1;
    if (!sequence1.length || !sequence2.length) return 0;

    const kmers1 = this.createKmerSet(sequence1, kmerSize);
    const kmers2 = this.createKmerSet(sequence2, kmerSize);
    let intersection = 0;

    for (const kmer of kmers1) {
      if (kmers2.has(kmer)) intersection++;
    }

    const union = kmers1.size + kmers2.size - intersection;
    const jaccardSimilarity = union > 0 ? intersection / union : 0;
    const lengthSimilarity =
      Math.min(sequence1.length, sequence2.length) /
      Math.max(sequence1.length, sequence2.length);

    return jaccardSimilarity * 0.85 + lengthSimilarity * 0.15;
  }

  static createKmerSet(sequence, kmerSize) {
    if (sequence.length <= kmerSize) {
      return new Set([sequence]);
    }

    const kmers = new Set();
    for (let index = 0; index <= sequence.length - kmerSize; index++) {
      kmers.add(sequence.slice(index, index + kmerSize));
    }
    return kmers;
  }

  /**
   * Create an immutable comparison reference for a species.
   */
  static createReference(organism) {
    return {
      genome: organism.genome.clone(),
      phenotype: this.copyComparablePhenotype(this.getComparablePhenotype(organism))
    };
  }

  static copyComparablePhenotype(phenotype) {
    const copy = {
      color: {
        h: phenotype.color?.h || 0,
        s: phenotype.color?.s || 0,
        l: phenotype.color?.l || 0
      }
    };

    for (const trait of Object.keys(this.TRAIT_WEIGHTS)) {
      if (!trait.startsWith('color')) {
        copy[trait] = phenotype[trait] || 0;
      }
    }

    return copy;
  }

  /**
   * Build the current phenotype centroid for a species population.
   */
  static calculatePhenotypeCentroid(organisms) {
    if (!organisms.length) return null;

    const centroid = { color: { h: 0, s: 0, l: 0 } };
    let hueX = 0;
    let hueY = 0;

    for (const organism of organisms) {
      const phenotype = this.getComparablePhenotype(organism);
      for (const trait of Object.keys(this.TRAIT_WEIGHTS)) {
        if (!trait.startsWith('color')) {
          centroid[trait] = (centroid[trait] || 0) + (phenotype[trait] || 0);
        }
      }

      const hueRadians = ((phenotype.color?.h || 0) * Math.PI) / 180;
      hueX += Math.cos(hueRadians);
      hueY += Math.sin(hueRadians);
      centroid.color.s += phenotype.color?.s || 0;
      centroid.color.l += phenotype.color?.l || 0;
    }

    for (const trait of Object.keys(this.TRAIT_WEIGHTS)) {
      if (!trait.startsWith('color')) {
        centroid[trait] /= organisms.length;
      }
    }

    centroid.color.h = (Math.atan2(hueY, hueX) * 180 / Math.PI + 360) % 360;
    centroid.color.s /= organisms.length;
    centroid.color.l /= organisms.length;
    return centroid;
  }

  /**
   * Blend a species centroid slowly so temporary outliers do not redefine it.
   */
  static blendPhenotypes(current, target, alpha = 0.12) {
    if (!current) return this.copyComparablePhenotype(target);
    if (!target) return current;

    const blended = this.copyComparablePhenotype(current);
    for (const trait of Object.keys(this.TRAIT_WEIGHTS)) {
      if (!trait.startsWith('color')) {
        blended[trait] = current[trait] + (target[trait] - current[trait]) * alpha;
      }
    }

    const hueDifference = ((target.color.h - current.color.h + 540) % 360) - 180;
    blended.color.h = (current.color.h + hueDifference * alpha + 360) % 360;
    blended.color.s = current.color.s + (target.color.s - current.color.s) * alpha;
    blended.color.l = current.color.l + (target.color.l - current.color.l) * alpha;
    return blended;
  }

  /**
   * Return normalized divergence components and a combined speciation score.
   */
  static calculateDivergence(organism, reference) {
    const phenotypicDistance = this.calculateDistance(organism, reference);
    const genomicSimilarity = this.calculateGenomeSimilarity(organism, reference);
    const geneticDistance = 1 - genomicSimilarity;
    const phenotypicScore = phenotypicDistance / 0.25;
    const geneticScore = geneticDistance / 0.25;
    const combinedScore = phenotypicScore * 0.6 + geneticScore * 0.4;

    return {
      phenotypicDistance,
      genomicSimilarity,
      geneticDistance,
      combinedScore
    };
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
    return this.calculateDivergence(organism, founder).combinedScore >=
      this.SPECIATION_THRESHOLD;
  }

  /**
   * Get detailed comparison report between two organisms
   * Useful for debugging and visualization
   */
  static getComparisonReport(organism1, organism2) {
    const divergence = this.calculateDivergence(organism1, organism2);
    const shouldSpeciate =
      divergence.combinedScore >= this.SPECIATION_THRESHOLD;

    const traitDifferences = {};
    const phenotype1 = this.getComparablePhenotype(organism1);
    const phenotype2 = this.getComparablePhenotype(organism2);
    for (const trait of Object.keys(this.TRAIT_WEIGHTS)) {
      let value1, value2;

      if (trait.startsWith('color')) {
        const colorProp = trait.replace('color', '').toLowerCase();
        value1 = phenotype1.color?.[colorProp[0]] || 0;
        value2 = phenotype2.color?.[colorProp[0]] || 0;
      } else {
        value1 = phenotype1[trait] || 0;
        value2 = phenotype2[trait] || 0;
      }

      traitDifferences[trait] = {
        organism1: value1,
        organism2: value2,
        difference: Math.abs(value1 - value2)
      };
    }

    return {
      phenotypicDistance: divergence.phenotypicDistance,
      genomicSimilarity: divergence.genomicSimilarity,
      combinedScore: divergence.combinedScore,
      shouldSpeciate: shouldSpeciate,
      traitDifferences: traitDifferences
    };
  }
}
