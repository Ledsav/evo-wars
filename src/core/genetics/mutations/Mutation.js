import { DNASequence } from '../DNASequence.js';

/**
 * Mutation - Base class for all mutation types
 * Follows Strategy pattern for different mutation behaviors
 */
export class Mutation {
  constructor(type, cost = 1) {
    this.type = type;
    this.cost = cost;
  }

  /**
   * Apply mutation to DNA sequence
   * Must be implemented by subclasses
   */
  apply(dnaSequence, position) {
    throw new Error('apply() must be implemented by subclass');
  }

  /**
   * Get mutation description
   */
  getDescription() {
    return `${this.type} mutation`;
  }
}

/**
 * Point Mutation - Single nucleotide substitution
 */
export class PointMutation extends Mutation {
  constructor() {
    super('point', 1);
  }

  apply(dnaSequence, position) {
    const sequence = dnaSequence.toString();
    if (position < 0 || position >= sequence.length) {
      throw new Error('Position out of bounds');
    }

    const bases = DNASequence.VALID_BASES;
    const currentBase = sequence[position];
    const availableBases = bases.filter(b => b !== currentBase);
    const newBase = availableBases[Math.floor(Math.random() * availableBases.length)];

    const newSequence = sequence.slice(0, position) + newBase + sequence.slice(position + 1);

    return {
      dna: new DNASequence(newSequence),
      description: `Point mutation at position ${position}: ${currentBase} → ${newBase}`
    };
  }
}

/**
 * Insertion Mutation - Add a nucleotide
 */
export class InsertionMutation extends Mutation {
  constructor() {
    super('insertion', 2);
  }

  apply(dnaSequence, position) {
    const sequence = dnaSequence.toString();
    if (position < 0 || position > sequence.length) {
      throw new Error('Position out of bounds');
    }

    const bases = DNASequence.VALID_BASES;
    const newBase = bases[Math.floor(Math.random() * bases.length)];

    const newSequence = sequence.slice(0, position) + newBase + sequence.slice(position);

    return {
      dna: new DNASequence(newSequence),
      description: `Insertion at position ${position}: added ${newBase}`
    };
  }
}

/**
 * Deletion Mutation - Remove a nucleotide
 */
export class DeletionMutation extends Mutation {
  constructor() {
    super('deletion', 2);
  }

  apply(dnaSequence, position) {
    const sequence = dnaSequence.toString();
    if (position < 0 || position >= sequence.length) {
      throw new Error('Position out of bounds');
    }

    if (sequence.length <= 6) {
      throw new Error('Sequence too short for deletion');
    }

    const deletedBase = sequence[position];
    const newSequence = sequence.slice(0, position) + sequence.slice(position + 1);

    return {
      dna: new DNASequence(newSequence),
      description: `Deletion at position ${position}: removed ${deletedBase}`
    };
  }
}

/**
 * Duplication Mutation - Duplicate a segment of DNA
 */
export class DuplicationMutation extends Mutation {
  constructor() {
    super('duplication', 3);
  }

  apply(dnaSequence, position, length = null) {
    const sequence = dnaSequence.toString();
    if (position < 0 || position >= sequence.length) {
      throw new Error('Position out of bounds');
    }

    // Auto-calculate length if not provided
    if (length === null) {
      length = Math.min(6, Math.floor(sequence.length / 3));
    }

    const endPos = Math.min(position + length, sequence.length);
    const segment = sequence.slice(position, endPos);
    const newSequence = sequence.slice(0, endPos) + segment + sequence.slice(endPos);

    return {
      dna: new DNASequence(newSequence),
      description: `Duplication at position ${position}: duplicated ${segment}`
    };
  }
}

/**
 * Inversion Mutation - Reverse a segment of DNA
 */
export class InversionMutation extends Mutation {
  constructor() {
    super('inversion', 2);
  }

  apply(dnaSequence, startPosition, endPosition) {
    const sequence = dnaSequence.toString();
    if (startPosition < 0 || endPosition >= sequence.length || startPosition >= endPosition) {
      throw new Error('Invalid position range');
    }

    const segment = sequence.slice(startPosition, endPosition + 1);
    const reversed = segment.split('').reverse().join('');
    const newSequence = sequence.slice(0, startPosition) + reversed + sequence.slice(endPosition + 1);

    return {
      dna: new DNASequence(newSequence),
      description: `Inversion from position ${startPosition} to ${endPosition}`
    };
  }
}

/**
 * Mutation Factory - Creates mutation instances
 */
export class MutationFactory {
  static MUTATION_TYPES = {
    point: PointMutation,
    insertion: InsertionMutation,
    deletion: DeletionMutation,
    duplication: DuplicationMutation,
    inversion: InversionMutation
  };

  static createMutation(type) {
    const MutationClass = this.MUTATION_TYPES[type];
    if (!MutationClass) {
      throw new Error(`Unknown mutation type: ${type}`);
    }
    return new MutationClass();
  }

  static getAllTypes() {
    return Object.keys(this.MUTATION_TYPES);
  }
}
