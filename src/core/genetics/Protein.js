/**
 * Protein - Represents a protein with amino acid sequence and properties
 * Analyzes chemical properties that affect phenotype
 */
export class Protein {
  // Amino acid property groups
  static AMINO_ACID_PROPERTIES = {
    hydrophobic: 'AILMFWVP',
    hydrophilic: 'RNDEQHKSTY',
    positive: 'KRH',
    negative: 'DE',
    polar: 'STNQYC',
    nonpolar: 'AILMFWVPG',
    aromatic: 'FYW',
    aliphatic: 'AILV',
    tiny: 'AGS',
    small: 'ABCDGNPSTV',
    large: 'EFHIKLMQRWY'
  };

  constructor(sequence) {
    this.sequence = sequence;
    this.properties = this.analyzeProperties();
  }

  /**
   * Analyze chemical and physical properties of the protein
   */
  analyzeProperties() {
    const counts = {
      length: this.sequence.length,
      hydrophobic: 0,
      hydrophilic: 0,
      positive: 0,
      negative: 0,
      polar: 0,
      nonpolar: 0,
      aromatic: 0,
      aliphatic: 0,
      tiny: 0,
      small: 0,
      large: 0
    };

    for (const aa of this.sequence) {
      for (const [property, aminoAcids] of Object.entries(Protein.AMINO_ACID_PROPERTIES)) {
        if (aminoAcids.includes(aa)) {
          counts[property]++;
        }
      }
    }

    // Calculate ratios
    const length = this.sequence.length || 1;
    const ratios = {};
    for (const [key, count] of Object.entries(counts)) {
      if (key !== 'length') {
        ratios[`${key}Ratio`] = count / length;
      }
    }

    return { ...counts, ...ratios };
  }

  /**
   * Calculate hydrophobicity score (higher = more hydrophobic)
   */
  getHydrophobicity() {
    return this.properties.hydrophobicRatio - this.properties.hydrophilicRatio;
  }

  /**
   * Calculate charge (positive - negative)
   */
  getCharge() {
    return this.properties.positive - this.properties.negative;
  }

  /**
   * Get structural complexity (based on aromatic and large amino acids)
   */
  getStructuralComplexity() {
    return this.properties.aromatic + this.properties.large;
  }

  /**
   * Get flexibility (based on small and tiny amino acids)
   */
  getFlexibility() {
    return this.properties.tiny + this.properties.small;
  }

  /**
   * Calculate molecular weight (simplified)
   */
  getMolecularWeight() {
    // Average amino acid weight ~110 Da
    return this.sequence.length * 110;
  }

  /**
   * Get dominant property
   */
  getDominantProperty() {
    const ratios = {
      hydrophobic: this.properties.hydrophobicRatio,
      hydrophilic: this.properties.hydrophilicRatio,
      charged: (this.properties.positive + this.properties.negative) / this.sequence.length,
      aromatic: this.properties.aromaticRatio
    };

    let maxProperty = 'neutral';
    let maxRatio = 0;

    for (const [property, ratio] of Object.entries(ratios)) {
      if (ratio > maxRatio) {
        maxRatio = ratio;
        maxProperty = property;
      }
    }

    return maxProperty;
  }

  toString() {
    return this.sequence;
  }
}
