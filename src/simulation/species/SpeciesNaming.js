/**
 * SpeciesNaming - Generates unique, descriptive names for species based on their traits
 * Names are derived from phenotypic characteristics (color, size, behavior, etc.)
 *
 * Naming scheme: [Color] [Size] [Behavior]vore
 * Examples: "Crimson Titanvore", "Azure Swifthunter", "Golden Peacegrazer"
 */
export class SpeciesNaming {
  /**
   * Color-based prefixes derived from hue
   */
  static COLOR_NAMES = [
    // Reds (0-30)
    { max: 15, names: ['Crimson', 'Ruby', 'Scarlet', 'Vermilion'] },
    { max: 30, names: ['Coral', 'Flame', 'Rust', 'Sunset'] },

    // Oranges (30-60)
    { max: 45, names: ['Amber', 'Bronze', 'Copper', 'Tangerine'] },
    { max: 60, names: ['Gold', 'Saffron', 'Honey', 'Marigold'] },

    // Yellows (60-90)
    { max: 75, names: ['Lemon', 'Cream', 'Ivory', 'Butter'] },
    { max: 90, names: ['Chartreuse', 'Lime', 'Citrus', 'Sulphur'] },

    // Greens (90-150)
    { max: 110, names: ['Emerald', 'Jade', 'Verdant', 'Spring'] },
    { max: 130, names: ['Forest', 'Moss', 'Pine', 'Sage'] },
    { max: 150, names: ['Mint', 'Teal', 'Aqua', 'Marine'] },

    // Cyans (150-180)
    { max: 165, names: ['Cyan', 'Turquoise', 'Caribbean', 'Lagoon'] },
    { max: 180, names: ['Azure', 'Cerulean', 'Sky', 'Ice'] },

    // Blues (180-240)
    { max: 210, names: ['Cobalt', 'Sapphire', 'Ocean', 'Navy'] },
    { max: 240, names: ['Indigo', 'Midnight', 'Storm', 'Steel'] },

    // Purples (240-300)
    { max: 270, names: ['Violet', 'Amethyst', 'Purple', 'Iris'] },
    { max: 300, names: ['Lavender', 'Plum', 'Orchid', 'Mauve'] },

    // Magentas (300-330)
    { max: 315, names: ['Magenta', 'Fuchsia', 'Rose', 'Pink'] },
    { max: 330, names: ['Cerise', 'Berry', 'Wine', 'Mulberry'] },

    // Reds wraparound (330-360)
    { max: 360, names: ['Burgundy', 'Garnet', 'Cherry', 'Blood'] }
  ];

  /**
   * Size-based descriptors
   */
  static SIZE_DESCRIPTORS = [
    { max: 10, names: ['Micro', 'Tiny', 'Mini', 'Dwarf'] },
    { max: 13, names: ['Small', 'Lesser', 'Compact', 'Petite'] },
    { max: 16, names: ['Swift', 'Nimble', 'Agile', 'Quick'] },
    { max: 20, names: ['Titan', 'Giant', 'Mega', 'Colossal'] }
  ];

  /**
   * Behavior-based suffixes (based on aggression)
   */
  static BEHAVIOR_SUFFIXES = [
    { max: 0.3, names: ['grazer', 'drifter', 'wanderer', 'browser'] },
    { max: 0.5, names: ['forager', 'seeker', 'gatherer', 'rover'] },
    { max: 0.7, names: ['hunter', 'stalker', 'prowler', 'chaser'] },
    { max: 1.0, names: ['vore', 'ripper', 'slayer', 'reaver'] }
  ];

  /**
   * Special trait-based modifiers (optional middle descriptors)
   */
  static TRAIT_MODIFIERS = {
    highSpeed: ['Swift', 'Fleet', 'Rapid', 'Fast'],
    highArmor: ['Armored', 'Plated', 'Shielded', 'Tank'],
    highVision: ['Keen', 'Sharp', 'Eagle', 'Hawk'],
    highMetabolism: ['Hyper', 'Active', 'Energetic', 'Vital']
  };

  /**
   * Generate a species name based on organism phenotype
   * @param {Object} phenotype - Organism phenotype
   * @param {number} founderId - Species founder ID (for deterministic randomness)
   * @returns {string} Generated species name
   */
  static generateName(phenotype, founderId) {
    if (!phenotype) return 'Unknown Species';

    // Use founder ID as seed for consistent randomness
    const seed = founderId;

    // Get color name
    const hue = phenotype.color?.h || 180;
    const colorName = this.getColorName(hue, seed);

    // Get size descriptor
    const size = phenotype.size || 10;
    const sizeDesc = this.getSizeDescriptor(size, seed);

    // Get behavior suffix
    const aggression = phenotype.aggression || 0.5;
    const behaviorSuffix = this.getBehaviorSuffix(aggression, seed);

    // Check for special traits (optional modifier)
    const modifier = this.getTraitModifier(phenotype, seed);

    // Construct name
    if (modifier) {
      return `${colorName} ${modifier}${behaviorSuffix}`;
    } else {
      return `${colorName} ${sizeDesc}${behaviorSuffix}`;
    }
  }

  /**
   * Get color name based on hue
   */
  static getColorName(hue, seed) {
    const range = this.COLOR_NAMES.find(r => hue <= r.max);
    if (!range) return 'Gray';

    const index = seed % range.names.length;
    return range.names[index];
  }

  /**
   * Get size descriptor based on size value
   */
  static getSizeDescriptor(size, seed) {
    const range = this.SIZE_DESCRIPTORS.find(r => size <= r.max);
    if (!range) {
      range = this.SIZE_DESCRIPTORS[this.SIZE_DESCRIPTORS.length - 1];
    }

    const index = Math.floor(seed / 7) % range.names.length;
    return range.names[index];
  }

  /**
   * Get behavior suffix based on aggression
   */
  static getBehaviorSuffix(aggression, seed) {
    const range = this.BEHAVIOR_SUFFIXES.find(r => aggression <= r.max);
    if (!range) {
      range = this.BEHAVIOR_SUFFIXES[this.BEHAVIOR_SUFFIXES.length - 1];
    }

    const index = Math.floor(seed / 13) % range.names.length;
    return range.names[index];
  }

  /**
   * Get trait-based modifier if organism has exceptional traits
   */
  static getTraitModifier(phenotype, seed) {
    const modifiers = [];

    // Check for exceptional traits (top 20% of range)
    if (phenotype.maxSpeed && phenotype.maxSpeed > 2.4) {
      modifiers.push('highSpeed');
    }
    if (phenotype.armor && phenotype.armor > 8) {
      modifiers.push('highArmor');
    }
    if (phenotype.visionRange && phenotype.visionRange > 180) {
      modifiers.push('highVision');
    }
    if (phenotype.metabolicRate && phenotype.metabolicRate > 1.6) {
      modifiers.push('highMetabolism');
    }

    // If multiple exceptional traits, pick one based on seed
    if (modifiers.length > 0) {
      const traitKey = modifiers[seed % modifiers.length];
      const traitNames = this.TRAIT_MODIFIERS[traitKey];
      const index = Math.floor(seed / 17) % traitNames.length;
      return traitNames[index];
    }

    return null;
  }

  /**
   * Generate a short species code (for compact display)
   * Format: XX-NNN (e.g., CR-001, AZ-042)
   * @param {string} name - Full species name
   * @param {number} founderId - Species founder ID
   * @returns {string} Species code
   */
  static generateCode(name, founderId) {
    // Get first two letters of first two words
    const words = name.split(' ');
    const prefix = words.slice(0, 2)
      .map(w => w[0])
      .join('')
      .toUpperCase();

    // Use founder ID as number (padded to 3 digits)
    const number = String(founderId).padStart(3, '0');

    return `${prefix}-${number}`;
  }

  /**
   * Get species emoji based on characteristics
   * @param {Object} phenotype - Organism phenotype
   * @returns {string} Emoji representing the species
   */
  static getSpeciesEmoji(phenotype) {
    if (!phenotype) return '🦠';

    const aggression = phenotype.aggression || 0.5;
    const size = phenotype.size || 10;

    // Aggressive species
    if (aggression > 0.7) {
      if (size > 16) return '🦖'; // Large aggressive
      return '🐺'; // Small aggressive
    }

    // Peaceful species
    if (aggression < 0.3) {
      if (size > 16) return '🐋'; // Large peaceful
      return '🐟'; // Small peaceful
    }

    // Balanced species
    if (size > 16) return '🦏'; // Large balanced
    if (size < 10) return '🐛'; // Tiny
    return '🦎'; // Medium balanced
  }
}
