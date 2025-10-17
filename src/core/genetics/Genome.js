import { Gene } from './Gene.js';
import { MutationFactory } from './mutations/Mutation.js';

/**
 * Genome - Collection of genes that define an organism
 * Manages gene expression and mutations
 */
export class Genome {
  constructor(genes = {}) {
    this.genes = genes; // Map of gene name -> Gene instance
    this.expressedProteins = {};
  }

  /**
   * Add a gene to the genome
   */
  addGene(name, gene) {
    this.genes[name] = gene;
    return this;
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
      const mutatedGene = new Gene(result.dna, geneName);
      this.genes[geneName] = mutatedGene;

      // Re-express the mutated gene
      this.expressGene(geneName);

      return {
        success: true,
        gene: mutatedGene,
        description: result.description,
        cost: mutation.cost
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

  /**
   * Clone the genome (for reproduction)
   */
  clone() {
    const clonedGenes = {};
    for (const [name, gene] of Object.entries(this.genes)) {
      clonedGenes[name] = new Gene(gene.dna.sequence, name);
    }
    return new Genome(clonedGenes);
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
        length: gene.length
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
      pigmentation: Gene.createRandom('pigmentation', 15, 24),
      structure: Gene.createRandom('structure', 24, 48)
    });
  }

  /**
   * Create a random genome
   */
  static createRandom(geneCount = 6) {
    const geneNames = ['size', 'speed', 'defense', 'metabolism', 'reproduction', 'sensory', 'pigmentation', 'structure'];
    const genes = {};

    for (let i = 0; i < Math.min(geneCount, geneNames.length); i++) {
      const name = geneNames[i];
      genes[name] = Gene.createRandom(name, 12, 30);
    }

    return new Genome(genes);
  }
}
