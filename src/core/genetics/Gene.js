import { DNASequence } from './DNASequence.js';
import { GeneticCode } from './GeneticCode.js';
import { Protein } from './Protein.js';

/**
 * Gene - Represents a gene that can be expressed into a protein
 * Handles transcription and translation following central dogma
 */
export class Gene {
  constructor(dnaSequence, name = 'unnamed_gene', options = {}) {
    if (typeof dnaSequence === 'string') {
      this.dna = new DNASequence(dnaSequence);
    } else {
      this.dna = dnaSequence;
    }
    this.name = name;
    this.stability = Math.max(
      0.08,
      Math.min(0.92, options.stability ?? (0.42 + Math.random() * 0.3))
    );
    this.mutationCount = Math.max(0, options.mutationCount || 0);
  }

  /**
   * Transcribe DNA to mRNA
   */
  transcribe() {
    return this.dna.transcribe();
  }

  /**
   * Translate mRNA to protein sequence
   * Follows biological rules: starts at AUG (start codon), stops at stop codons
   */
  translate() {
    const mRNA = this.transcribe();
    let proteinSequence = '';
    let started = false;

    // Read codons (3 nucleotides at a time)
    for (let i = 0; i <= mRNA.length - 3; i += 3) {
      const codon = mRNA.substr(i, 3);

      // Look for start codon
      if (!started) {
        if (GeneticCode.isStartCodon(codon)) {
          started = true;
          proteinSequence += GeneticCode.translateCodon(codon);
        }
        continue;
      }

      // Check for stop codon
      if (GeneticCode.isStopCodon(codon)) {
        break;
      }

      // Translate codon to amino acid
      const aminoAcid = GeneticCode.translateCodon(codon);
      if (aminoAcid !== '?') {
        proteinSequence += aminoAcid;
      }
    }

    return new Protein(proteinSequence);
  }

  /**
   * Express the gene (transcribe and translate)
   */
  express() {
    return this.translate();
  }

  /**
   * Check if gene has valid start codon
   */
  hasStartCodon() {
    const mRNA = this.transcribe();
    for (let i = 0; i <= mRNA.length - 3; i += 3) {
      const codon = mRNA.substr(i, 3);
      if (GeneticCode.isStartCodon(codon)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if gene has valid stop codon
   */
  hasStopCodon() {
    const mRNA = this.transcribe();
    for (let i = 0; i <= mRNA.length - 3; i += 3) {
      const codon = mRNA.substr(i, 3);
      if (GeneticCode.isStopCodon(codon)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if gene is valid (has both start and stop codons)
   */
  isValid() {
    return this.hasStartCodon() && this.hasStopCodon();
  }

  /**
   * Get gene length
   */
  get length() {
    return this.dna.length;
  }

  getSequenceInstability() {
    const sequence = this.dna.toString();
    if (!sequence.length) return 1;

    const gcBases = sequence
      .split('')
      .filter(base => base === 'G' || base === 'C').length;
    const gcDeviation = Math.abs(gcBases / sequence.length - 0.5) * 2;
    let repeatedBases = 0;
    for (let index = 1; index < sequence.length; index++) {
      if (sequence[index] === sequence[index - 1]) repeatedBases++;
    }

    const codons = sequence.match(/.{3}/g) || [];
    let repeatedCodons = 0;
    for (let index = 1; index < codons.length; index++) {
      if (codons[index] === codons[index - 1]) repeatedCodons++;
    }

    const lengthPressure = Math.min(1, sequence.length / 48);
    const baseRepeatPressure = repeatedBases / Math.max(1, sequence.length - 1);
    const codonRepeatPressure = repeatedCodons / Math.max(1, codons.length - 1);
    const mutationHistoryPressure = Math.min(0.3, this.mutationCount * 0.025);

    return Math.max(
      0.08,
      Math.min(
        1,
        0.18 +
          lengthPressure * 0.24 +
          gcDeviation * 0.16 +
          baseRepeatPressure * 0.22 +
          codonRepeatPressure * 0.2 +
          mutationHistoryPressure
      )
    );
  }

  getMutationWeight() {
    const repairEscape = Math.max(0.04, 1 - this.stability);
    return this.getSequenceInstability() * repairEscape;
  }

  /**
   * Get DNA sequence as string
   */
  toString() {
    return this.dna.toString();
  }

  /**
   * Create a valid random gene with proper start and stop codons
   */
  static createRandom(name, minLength = 12, maxLength = 30) {
    const length = minLength + Math.floor(Math.random() * (maxLength - minLength));
    const codingLength = Math.floor(length / 3) * 3; // Ensure divisible by 3

    // Start with ATG (start codon)
    let sequence = 'ATG';

    // Add random codons
    const bases = ['A', 'T', 'C', 'G'];
    for (let i = 3; i < codingLength - 3; i++) {
      sequence += bases[Math.floor(Math.random() * 4)];
    }

    // End with stop codon
    const stopCodons = ['TAA', 'TAG', 'TGA'];
    sequence += stopCodons[Math.floor(Math.random() * stopCodons.length)];

    return new Gene(sequence, name);
  }
}
