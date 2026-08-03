import { Gene } from './Gene.js';
import { MutationFactory } from './mutations/Mutation.js';

const DEFAULT_GENE_STABILITY = 0.58;
const MIN_GENE_STABILITY = 0.08;
const MAX_GENE_STABILITY = 0.92;
const STABILITY_REALLOCATION_CHANCE = 0.16;

function weightedChoice(entries) {
  const totalWeight = entries.reduce(
    (total, entry) => total + Math.max(0, entry.weight),
    0
  );
  if (totalWeight <= 0) return entries[0]?.value ?? null;

  let cursor = Math.random() * totalWeight;
  for (const entry of entries) {
    cursor -= Math.max(0, entry.weight);
    if (cursor <= 0) return entry.value;
  }
  return entries[entries.length - 1]?.value ?? null;
}

/**
 * Genome - Collection of genes that define an organism
 * Manages gene expression and mutations
 */
export class Genome {
  constructor(genes = {}, stabilityBudget = null) {
    this.genes = genes; // Map of gene name -> Gene instance
    this.expressedProteins = {};
    this.stabilityBudget = stabilityBudget ??
      Object.keys(genes).length * DEFAULT_GENE_STABILITY;
    this.normalizeStabilityBudget();
  }

  /**
   * Add a gene to the genome
   */
  addGene(name, gene) {
    const isNewGene = !this.genes[name];
    this.genes[name] = gene;
    if (isNewGene) {
      this.stabilityBudget += DEFAULT_GENE_STABILITY;
      this.normalizeStabilityBudget();
    }
    return this;
  }

  normalizeStabilityBudget() {
    const genes = Object.values(this.genes);
    if (!genes.length) return;

    const minimumBudget = genes.length * MIN_GENE_STABILITY;
    const maximumBudget = genes.length * MAX_GENE_STABILITY;
    this.stabilityBudget = Math.max(
      minimumBudget,
      Math.min(maximumBudget, this.stabilityBudget)
    );

    for (let iteration = 0; iteration < 6; iteration++) {
      const currentTotal = genes.reduce(
        (total, gene) => total + gene.stability,
        0
      );
      const difference = this.stabilityBudget - currentTotal;
      if (Math.abs(difference) < 0.0001) break;

      const adjustable = genes.filter(gene => (
        difference > 0
          ? gene.stability < MAX_GENE_STABILITY
          : gene.stability > MIN_GENE_STABILITY
      ));
      if (!adjustable.length) break;

      const adjustment = difference / adjustable.length;
      for (const gene of adjustable) {
        gene.stability = Math.max(
          MIN_GENE_STABILITY,
          Math.min(MAX_GENE_STABILITY, gene.stability + adjustment)
        );
      }
    }
  }

  /**
   * Get a gene by name
   */
  getGene(name) {
    return this.genes[name];
  }

  /**
   * Express all genes to produce proteins
   */
  expressAllGenes() {
    this.expressedProteins = {};

    for (const [name, gene] of Object.entries(this.genes)) {
      try {
        this.expressedProteins[name] = gene.express();
      } catch (error) {
        console.warn(`Failed to express gene ${name}:`, error);
        this.expressedProteins[name] = null;
      }
    }

    return this.expressedProteins;
  }

  /**
   * Express a specific gene
   */
  expressGene(name) {
    const gene = this.genes[name];
    if (!gene) {
      throw new Error(`Gene ${name} not found`);
    }

    try {
      const protein = gene.express();
      this.expressedProteins[name] = protein;
      return protein;
    } catch (error) {
      console.warn(`Failed to express gene ${name}:`, error);
      this.expressedProteins[name] = null;
      return null;
    }
  }

  /**
   * Apply mutation to a specific gene
   */
  mutateGene(geneName, mutationType, position, extraParams = {}) {
    const gene = this.genes[geneName];
    if (!gene) {
      throw new Error(`Gene ${geneName} not found`);
    }

    const mutation = MutationFactory.createMutation(mutationType);

    try {
      let result;
      if (mutationType === 'inversion' && extraParams.endPosition !== undefined) {
        result = mutation.apply(gene.dna, position, extraParams.endPosition);
      } else if (mutationType === 'duplication' && extraParams.length !== undefined) {
        result = mutation.apply(gene.dna, position, extraParams.length);
      } else {
        result = mutation.apply(gene.dna, position);
      }

      // Create new gene with mutated DNA
      const mutatedGene = new Gene(result.dna, geneName, {
        stability: gene.stability,
        mutationCount: gene.mutationCount + 1
      });
      this.genes[geneName] = mutatedGene;

      // Re-express the mutated gene
      this.expressGene(geneName);

      return {
        success: true,
        gene: mutatedGene,
        description: result.description,
        cost: mutation.cost,
        stability: mutatedGene.stability,
        sequenceInstability: mutatedGene.getSequenceInstability()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        cost: 0
      };
    }
  }

  /**
   * Get all gene names
   */
  getGeneNames() {
    return Object.keys(this.genes);
  }

  /**
   * Get genome size (total base pairs)
   */
  getSize() {
    return Object.values(this.genes).reduce((total, gene) => total + gene.length, 0);
  }

  getMutationProfile() {
    const profile = this.getGeneNames().map(name => {
      const gene = this.genes[name];
      return {
        name,
        stability: gene.stability,
        sequenceInstability: gene.getSequenceInstability(),
        weight: gene.getMutationWeight(),
        mutationCount: gene.mutationCount
      };
    });
    const totalWeight = profile.reduce((total, gene) => total + gene.weight, 0);

    return profile.map(gene => ({
      ...gene,
      probability: totalWeight > 0 ? gene.weight / totalWeight : 0
    }));
  }

  createMutationPlan() {
    const profile = this.getMutationProfile();
    const geneName = weightedChoice(
      profile.map(gene => ({ value: gene.name, weight: gene.weight }))
    );
    if (!geneName) return null;

    const gene = this.getGene(geneName);
    const repairEscape = 1 - gene.stability;
    const mutationType = weightedChoice([
      { value: 'point', weight: 0.7 + gene.stability * 0.9 },
      { value: 'insertion', weight: 0.08 + repairEscape * 0.38 },
      { value: 'deletion', weight: 0.08 + repairEscape * 0.34 },
      { value: 'duplication', weight: 0.03 + repairEscape * 0.16 },
      { value: 'inversion', weight: 0.03 + repairEscape * 0.13 }
    ]);
    const sequenceLength = gene.dna.length;
    const positionLimit = mutationType === 'inversion'
      ? Math.max(1, sequenceLength - 1)
      : Math.max(1, sequenceLength);
    const position = Math.floor(Math.random() * positionLimit);
    const extraParams = {};

    if (mutationType === 'duplication') {
      extraParams.length = Math.max(
        1,
        Math.min(6, Math.floor(sequenceLength / 4))
      );
    } else if (mutationType === 'inversion') {
      extraParams.endPosition = Math.min(
        sequenceLength - 1,
        position + Math.max(1, Math.floor(sequenceLength / 4))
      );
      if (extraParams.endPosition <= position) {
        extraParams.endPosition = Math.min(sequenceLength - 1, position + 1);
      }
    }

    return {
      geneName,
      mutationType,
      position,
      extraParams,
      profile
    };
  }

  maybeReallocateStability() {
    const geneNames = this.getGeneNames();
    if (
      geneNames.length < 2 ||
      Math.random() >= STABILITY_REALLOCATION_CHANCE
    ) {
      return null;
    }

    const donorName = geneNames[Math.floor(Math.random() * geneNames.length)];
    const recipientCandidates = geneNames.filter(name => name !== donorName);
    const recipientName = recipientCandidates[
      Math.floor(Math.random() * recipientCandidates.length)
    ];
    const donor = this.genes[donorName];
    const recipient = this.genes[recipientName];
    const available = Math.min(
      donor.stability - MIN_GENE_STABILITY,
      MAX_GENE_STABILITY - recipient.stability
    );
    if (available <= 0) return null;

    const amount = Math.min(available, 0.01 + Math.random() * 0.05);
    donor.stability -= amount;
    recipient.stability += amount;
    this.normalizeStabilityBudget();

    return {
      donor: donorName,
      recipient: recipientName,
      amount
    };
  }

  getAverageStability() {
    const genes = Object.values(this.genes);
    if (!genes.length) return 0;
    return genes.reduce((total, gene) => total + gene.stability, 0) /
      genes.length;
  }

  /**
   * Clone the genome (for reproduction)
   */
  clone() {
    const clonedGenes = {};
    for (const [name, gene] of Object.entries(this.genes)) {
      clonedGenes[name] = new Gene(gene.dna.sequence, name, {
        stability: gene.stability,
        mutationCount: gene.mutationCount
      });
    }
    return new Genome(clonedGenes, this.stabilityBudget);
  }

  /**
   * Get validation status for all genes
   */
  validate() {
    const validation = {};
    for (const [name, gene] of Object.entries(this.genes)) {
      validation[name] = {
        isValid: gene.isValid(),
        hasStartCodon: gene.hasStartCodon(),
        hasStopCodon: gene.hasStopCodon(),
        length: gene.length,
        stability: gene.stability,
        sequenceInstability: gene.getSequenceInstability(),
        mutationCount: gene.mutationCount
      };
    }
    return validation;
  }

  /**
   * Create a default genome with standard genes
   */
  static createDefault() {
    return new Genome({
      size: Gene.createRandom('size', 15, 24),
      speed: Gene.createRandom('speed', 12, 21),
      defense: Gene.createRandom('defense', 15, 24),
      metabolism: Gene.createRandom('metabolism', 12, 21),
      reproduction: Gene.createRandom('reproduction', 15, 24),
      sensory: Gene.createRandom('sensory', 12, 21),
      aggression: Gene.createRandom('aggression', 12, 21),
      cooperation: Gene.createRandom('cooperation', 12, 21),
      adhesion: Gene.createRandom('adhesion', 15, 27),
      pigmentation: Gene.createRandom('pigmentation', 15, 24),
      structure: Gene.createRandom('structure', 24, 48)
    });
  }

  /**
   * Create a random genome
   */
  static createRandom(geneCount = 6) {
    const geneNames = [
      'size',
      'speed',
      'defense',
      'metabolism',
      'reproduction',
      'sensory',
      'aggression',
      'cooperation',
      'adhesion',
      'pigmentation',
      'structure'
    ];
    const genes = {};

    for (let i = 0; i < Math.min(geneCount, geneNames.length); i++) {
      const name = geneNames[i];
      genes[name] = Gene.createRandom(name, 12, 30);
    }

    return new Genome(genes);
  }
}
