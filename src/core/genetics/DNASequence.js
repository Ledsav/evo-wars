/**
 * DNASequence - Represents a DNA sequence that can be transcribed to RNA
 * Handles validation and basic DNA operations
 */
export class DNASequence {
  static VALID_BASES = ['A', 'T', 'C', 'G'];

  constructor(sequence = '') {
    this.validateSequence(sequence);
    this._sequence = sequence.toUpperCase();
  }

  validateSequence(sequence) {
    const bases = sequence.toUpperCase().split('');
    for (const base of bases) {
      if (!DNASequence.VALID_BASES.includes(base)) {
        throw new Error(`Invalid DNA base: ${base}`);
      }
    }
  }

  get sequence() {
    return this._sequence;
  }

  get length() {
    return this._sequence.length;
  }

  /**
   * Transcribe DNA to RNA (replace T with U)
   */
  transcribe() {
    return this._sequence.replace(/T/g, 'U');
  }

  /**
   * Get base at specific position
   */
  getBaseAt(index) {
    return this._sequence[index];
  }

  /**
   * Get subsequence
   */
  getSubsequence(start, end) {
    return new DNASequence(this._sequence.slice(start, end));
  }

  /**
   * Get complement base
   */
  static getComplementBase(base) {
    const complements = { 'A': 'T', 'T': 'A', 'C': 'G', 'G': 'C' };
    return complements[base];
  }

  /**
   * Get complement sequence
   */
  getComplement() {
    const complement = this._sequence
      .split('')
      .map(base => DNASequence.getComplementBase(base))
      .join('');
    return new DNASequence(complement);
  }

  /**
   * Get reverse complement
   */
  getReverseComplement() {
    const complement = this.getComplement();
    return new DNASequence(complement.sequence.split('').reverse().join(''));
  }

  toString() {
    return this._sequence;
  }

  /**
   * Create random DNA sequence
   */
  static random(length) {
    let sequence = '';
    for (let i = 0; i < length; i++) {
      sequence += DNASequence.VALID_BASES[Math.floor(Math.random() * 4)];
    }
    return new DNASequence(sequence);
  }
}
