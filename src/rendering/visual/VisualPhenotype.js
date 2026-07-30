const BODY_PLANS = [
  'coccoid',
  'capsule',
  'spindle',
  'segmented',
  'radial',
  'amoeboid',
  'colonial'
];

const PATTERNS = ['bands', 'spots', 'mottled', 'axial', 'rings'];

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalize(value, minimum, maximum) {
  return clamp((value - minimum) / (maximum - minimum), 0, 1);
}

function hashString(value) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function seededFraction(seed, salt) {
  let value = (seed + Math.imul(salt + 1, 0x6D2B79F5)) >>> 0;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function genomeSignature(genome) {
  return Object.entries(genome?.genes || {})
    .sort(([leftName], [rightName]) => leftName.localeCompare(rightName))
    .map(([name, gene]) => `${name}:${gene?.dna?.sequence || ''}`)
    .join('|');
}

function getLineageSeed(signature, speciesFounderId) {
  if (speciesFounderId !== null && speciesFounderId !== undefined) {
    return hashString(`species:${speciesFounderId}`);
  }

  return hashString(signature);
}

function proteinRatio(protein, property) {
  return protein?.properties?.[`${property}Ratio`] || 0;
}

function pickBodyPlan(proteins, signature) {
  const structureSequence = proteins.structure?.sequence || signature;
  const stablePrefix = structureSequence.slice(0, 6);
  return BODY_PLANS[hashString(stablePrefix) % BODY_PLANS.length];
}

function pickLocomotion(bodyPlan, speedIntensity, seed) {
  if (bodyPlan === 'amoeboid') return 'pseudopods';
  if (bodyPlan === 'radial' || bodyPlan === 'colonial') return 'cilia';
  if (speedIntensity > 0.72) {
    return seededFraction(seed, 4) > 0.5 ? 'flagella' : 'fins';
  }
  if (speedIntensity > 0.28) return 'cilia';
  return 'pseudopods';
}

function pickSymmetry(bodyPlan) {
  if (bodyPlan === 'radial' || bodyPlan === 'coccoid' || bodyPlan === 'colonial') {
    return 'radial';
  }
  if (bodyPlan === 'amoeboid') return 'asymmetric';
  return 'bilateral';
}

export class VisualPhenotype {
  static create(genome, proteins, phenotype, speciesFounderId = null) {
    const signature = genomeSignature(genome);
    const seed = getLineageSeed(signature, speciesFounderId);
    const bodyPlan = pickBodyPlan(proteins, signature);
    const speedIntensity = normalize(phenotype.maxSpeed, 1, 3);
    const armorIntensity = normalize(phenotype.armor, 0, 8);
    const sensoryIntensity = normalize(phenotype.visionRange, 80, 200);
    const aggressionIntensity = clamp(phenotype.aggression || 0, 0, 1);
    const cooperationIntensity = clamp(phenotype.cooperativeness || 0, 0, 1);
    const metabolismIntensity = normalize(phenotype.metabolicRate, 0.5, 2);
    const reproductionIntensity = normalize(phenotype.reproductionCost, 40, 88);
    const structureComplexity = clamp(
      proteinRatio(proteins.structure, 'large') +
      proteinRatio(proteins.structure, 'aromatic'),
      0,
      1
    );

    const baseSegments = phenotype.segments || 1;
    const segmentCount = bodyPlan === 'segmented'
      ? clamp(baseSegments + 2 + Math.floor(seededFraction(seed, 1) * 3), 3, 8)
      : clamp(baseSegments, 1, 5);

    const aspectRatioByPlan = {
      coccoid: 1,
      capsule: 1.35 + speedIntensity * 0.55,
      spindle: 1.55 + speedIntensity * 0.75,
      segmented: 1.4 + segmentCount * 0.12,
      radial: 1,
      amoeboid: 1.05 + seededFraction(seed, 2) * 0.35,
      colonial: 1.1 + seededFraction(seed, 3) * 0.3
    };

    const locomotionType = pickLocomotion(bodyPlan, speedIntensity, seed);
    const sensorCount = bodyPlan === 'radial'
      ? clamp(Math.round(3 + sensoryIntensity * 5), 3, 8)
      : clamp(Math.round(sensoryIntensity * 4), 0, 4);
    const defenseType = armorIntensity > 0.62
      ? 'shell'
      : armorIntensity > 0.2
        ? 'plates'
        : 'membrane';
    const feedingType = aggressionIntensity > 0.68
      ? 'mandible'
      : cooperationIntensity > 0.64
        ? 'filter'
        : 'aperture';
    const patternType = PATTERNS[
      (hashString(proteins.pigmentation?.sequence || signature) + bodyPlan.length) % PATTERNS.length
    ];

    const visual = {
      seed,
      bodyPlan,
      symmetry: pickSymmetry(bodyPlan),
      segmentCount,
      aspectRatio: aspectRatioByPlan[bodyPlan],
      taper: clamp(speedIntensity * 0.65 + seededFraction(seed, 5) * 0.2, 0, 0.85),
      curvature: (seededFraction(seed, 6) - 0.5) * (bodyPlan === 'segmented' ? 0.8 : 0.3),
      lobes: clamp(5 + Math.floor(structureComplexity * 5), 5, 10),
      membrane: {
        thickness: clamp(0.22 + armorIntensity * 0.65, 0.2, 0.9),
        translucency: clamp(0.1 + proteinRatio(proteins.structure, 'polar') * 0.42, 0.08, 0.42),
        texture: structureComplexity > 0.55 ? 'ridged' : metabolismIntensity > 0.55 ? 'granular' : 'smooth'
      },
      locomotion: {
        type: locomotionType,
        count: locomotionType === 'cilia'
          ? clamp(10 + Math.round(speedIntensity * 18), 10, 28)
          : clamp(1 + Math.round(speedIntensity * 4), 1, 5),
        length: 0.35 + speedIntensity * 0.7,
        placement: locomotionType === 'flagella' ? 'rear' : 'perimeter'
      },
      sensory: {
        type: sensoryIntensity > 0.7 ? 'lens' : 'eyespots',
        count: sensorCount,
        size: 0.16 + sensoryIntensity * 0.3,
        placement: bodyPlan === 'radial' ? 'radial' : 'front'
      },
      defense: {
        type: defenseType,
        coverage: armorIntensity,
        spineCount: aggressionIntensity > 0.35
          ? clamp(Math.round(aggressionIntensity * 10), 2, 10)
          : 0,
        spineLength: 0.2 + aggressionIntensity * 0.5
      },
      feeding: {
        type: feedingType,
        aperture: 0.16 + aggressionIntensity * 0.28
      },
      internal: {
        nucleusCount: bodyPlan === 'colonial'
          ? clamp(4 + Math.floor(seededFraction(seed, 7) * 5), 4, 8)
          : clamp(1 + Math.floor(reproductionIntensity * 3), 1, 3),
        vacuoleCount: clamp(2 + Math.floor(metabolismIntensity * 5), 2, 7),
        toxinSacCount: phenotype.toxicity > 0.2
          ? clamp(1 + Math.floor(phenotype.toxicity * 2), 1, 4)
          : 0
      },
      pattern: {
        type: patternType,
        density: clamp(0.18 + proteinRatio(proteins.pigmentation, 'aromatic') * 1.8, 0.18, 0.82),
        contrast: clamp(
          0.18 +
          (
            proteinRatio(proteins.pigmentation, 'positive') +
            proteinRatio(proteins.pigmentation, 'negative')
          ) * 0.7,
          0.18,
          0.62
        )
      },
      palette: {
        primaryHue: phenotype.color.h,
        secondaryHue: (
          phenotype.color.h +
          (phenotype.colorPattern?.secondaryHueShift || 34)
        ) % 360,
        saturation: clamp(phenotype.color.s * 0.72, 28, 68),
        lightness: clamp(phenotype.color.l + 5, 38, 68)
      }
    };

    visual.signature = [
      visual.seed,
      visual.bodyPlan,
      visual.symmetry,
      visual.segmentCount,
      visual.aspectRatio.toFixed(2),
      visual.taper.toFixed(2),
      visual.curvature.toFixed(2),
      visual.lobes,
      visual.membrane.thickness.toFixed(2),
      visual.locomotion.type,
      visual.locomotion.count,
      visual.sensory.type,
      visual.sensory.count,
      visual.defense.type,
      visual.defense.coverage.toFixed(2),
      visual.defense.spineCount,
      visual.feeding.type,
      visual.internal.nucleusCount,
      visual.internal.vacuoleCount,
      visual.internal.toxinSacCount,
      visual.pattern.type,
      visual.pattern.density.toFixed(2),
      visual.palette.primaryHue.toFixed(0),
      visual.palette.secondaryHue.toFixed(0)
    ].join('_');

    return visual;
  }
}
