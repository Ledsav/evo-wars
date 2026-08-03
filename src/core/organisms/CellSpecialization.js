export const CELL_ROLE_DEFINITIONS = {
  generalist: {
    label: 'Generalist',
    color: '#8b938e',
    description: 'Undifferentiated cell retaining balanced capabilities.'
  },
  stem: {
    label: 'Stem',
    color: '#8b6f83',
    description: 'Reproductive cell specialized for colony growth.'
  },
  feeder: {
    label: 'Feeder',
    color: '#a18448',
    description: 'Resource-acquisition cell optimized for energy uptake.'
  },
  defender: {
    label: 'Defender',
    color: '#a54a3f',
    description: 'Peripheral cell specialized for armor and toxicity.'
  },
  motor: {
    label: 'Motor',
    color: '#687f91',
    description: 'Contractile cell contributing locomotion to the colony.'
  },
  matrix: {
    label: 'Matrix',
    color: '#4f8177',
    description: 'Structural cell producing adhesion and extracellular matrix.'
  }
};

export const SPECIALIZED_CELL_ROLES = [
  'stem',
  'feeder',
  'defender',
  'motor',
  'matrix'
];

const ROLE_MULTIPLIERS = {
  stem: {
    reproductionThreshold: 0.76,
    reproductionCost: 0.9,
    maxSpeed: 0.84,
    armor: 0.9
  },
  feeder: {
    energyEfficiency: 1.3,
    visionRange: 1.18,
    detectionRadius: 1.15,
    metabolicRate: 0.88,
    maxSpeed: 0.9,
    energyConductivity: 1.2
  },
  defender: {
    armor: 1.45,
    toxicity: 1.3,
    aggression: 1.15,
    metabolicRate: 1.1,
    maxSpeed: 0.72
  },
  motor: {
    maxSpeed: 1.38,
    acceleration: 1.3,
    metabolicRate: 1.2,
    armor: 0.78,
    adhesion: 1.08
  },
  matrix: {
    adhesion: 1.45,
    bondStrength: 1.5,
    energyConductivity: 1.2,
    bondMaintenance: 0.72,
    maxSpeed: 0.58,
    acceleration: 0.7,
    reproductionThreshold: 1.28
  }
};

const UNIT_INTERVAL_TRAITS = new Set([
  'adhesion',
  'aggression',
  'cooperativeness',
  'energyConductivity',
  'toxicity',
  'bondStrength'
]);

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function applyCellSpecialization(basePhenotype, role, expression) {
  const phenotype = {
    ...basePhenotype,
    color: { ...basePhenotype.color },
    colorPattern: basePhenotype.colorPattern
      ? { ...basePhenotype.colorPattern }
      : basePhenotype.colorPattern,
    visual: basePhenotype.visual
  };
  const regulatedExpression = clamp(expression, 0, 1);
  const multipliers = ROLE_MULTIPLIERS[role] || {};

  for (const [trait, multiplier] of Object.entries(multipliers)) {
    const baseValue = basePhenotype[trait];
    if (!Number.isFinite(baseValue)) continue;

    const expressedMultiplier = 1 + (multiplier - 1) * regulatedExpression;
    phenotype[trait] = baseValue * expressedMultiplier;
    if (UNIT_INTERVAL_TRAITS.has(trait)) {
      phenotype[trait] = clamp(phenotype[trait], 0, 1);
    }
  }

  if (role === 'matrix') {
    phenotype.bondCapacity = clamp(
      Math.round(basePhenotype.bondCapacity + regulatedExpression * 2),
      1,
      7
    );
  }

  return phenotype;
}
