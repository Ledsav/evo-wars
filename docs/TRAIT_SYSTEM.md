# Trait Calculation System

The trait calculation system in Evo Wars is designed to be explicit, well-documented, and easy to modify. All genetic-to-phenotype mappings are centralized in the `TraitCalculator` class.

## Architecture

```
Genome → Proteins → TraitCalculator → Phenotype
```

1. **Genome**: DNA sequences for each gene
2. **Proteins**: Expressed amino acid sequences with chemical properties
3. **TraitCalculator**: Explicit formulas converting protein properties to traits
4. **Phenotype**: Physical and behavioral traits of the organism

## File Structure

- `src/core/organisms/TraitCalculator.js` - All trait calculation logic and rules
- `src/core/organisms/Organism.js` - Uses TraitCalculator to build phenotype
- `src/core/genetics/Protein.js` - Amino acid property analysis

## Trait Rules

All traits follow this pattern:

```javascript
traitName: {
  baseValue: number,           // Default value when protein is missing
  formula: (protein) => number, // How to calculate from protein
  expectedRange: [min, max],    // Expected output range
  weights: {},                  // Scaling factors used in formula
  description: string           // Human-readable explanation
}
```

### Example: Armor

```javascript
armor: {
  baseValue: 0,
  formula: (protein) => protein.properties.hydrophobicRatio * 8,
  expectedRange: [0, 8],
  weights: { hydrophobicRatio: 8 },
  description: 'Physical armor - hydrophobic proteins create tough protective layers'
}
```

This means:
- Armor ranges from 0-8
- It's calculated as: `hydrophobicRatio * 8`
- Hydrophobic amino acids (A, I, L, M, F, W, V, P) create armor
- 100% hydrophobic protein = 8 armor (max)
- 0% hydrophobic protein = 0 armor (min)

## Modifying Traits

To change how a trait works:

1. Open `src/core/organisms/TraitCalculator.js`
2. Find the trait in `TRAIT_RULES`
3. Modify the `formula`, `weights`, or `expectedRange`
4. Update the `description` to explain your changes

### Example: Make Speed Faster

```javascript
// Before
maxSpeed: {
  baseValue: 1,
  formula: (protein) => 1 + protein.getFlexibility() * 0.3,
  expectedRange: [1.0, 3.0],
  weights: { flexibility: 0.3 }
}

// After - 2x faster max speed
maxSpeed: {
  baseValue: 1,
  formula: (protein) => 1 + protein.getFlexibility() * 0.6,  // Changed from 0.3
  expectedRange: [1.0, 5.0],                                   // Updated range
  weights: { flexibility: 0.6 }                                // Updated weight
}
```

## Protein Properties

Each protein has these properties available:

### Counts (raw numbers)
- `length` - Total amino acids
- `hydrophobic`, `hydrophilic` - Water interaction
- `positive`, `negative` - Electrical charge
- `polar`, `nonpolar` - Polarity
- `aromatic` - Ring structures (F, Y, W) - **rare**
- `aliphatic` - Linear chains (A, I, L, V)
- `tiny`, `small`, `large` - Size categories

### Ratios (0-1, normalized by length)
- `hydrophobicRatio = hydrophobic / length`
- `polarRatio = polar / length`
- etc.

### Derived Properties
- `getFlexibility()` - Returns `tiny + small` count
- `getCharge()` - Returns `positive - negative`
- `getHydrophobicity()` - Returns `hydrophobicRatio - hydrophilicRatio`
- `getStructuralComplexity()` - Returns `aromatic + large`

## Design Principles

### 1. Use Ratios, Not Counts
✅ **Good**: `protein.properties.hydrophobicRatio * 8`
❌ **Bad**: `protein.properties.hydrophobic * 0.5`

Ratios are normalized (0-1) regardless of protein length, giving consistent scaling.

### 2. Common Properties for Common Traits
- **Hydrophobic** (A, I, L, M, F, W, V, P) - ~40-60% of random proteins
- **Polar** (S, T, N, Q, Y, C) - ~30-50% of random proteins
- **Positive** (K, R, H) - ~15-25% of random proteins

Use these for traits that should vary widely.

### 3. Rare Properties for Special Traits
- **Aromatic** (F, Y, W) - ~5-15% of random proteins

Use these for traits that should be rare/special (like toxicity).

### 4. Clear Expected Ranges
Each trait specifies its expected output range:
- Helps validate trait calculations
- Makes balancing easier
- Documents expected behavior

### 5. Explicit Weights
All scaling factors are documented in `weights`:
```javascript
weights: { hydrophobicRatio: 8, polarRatio: 1.5 }
```

This makes it easy to see and modify how strongly each property affects the trait.

## API Usage

### Get Trait Documentation
```javascript
const docs = TraitCalculator.getTraitDocumentation();
// Returns all trait rules, ranges, and descriptions
```

### Validate a Trait Value
```javascript
const validation = TraitCalculator.validateTrait('armor', 6.5);
// Returns: { valid: true, value: 6.5, expectedRange: [0, 8], percentile: 81.25 }
```

### Analyze Protein Impact
```javascript
const impact = TraitCalculator.analyzeProteinImpact('defense', defenseProtein);
// Returns which traits are affected and how
```

### Calculate Specific Traits
```javascript
// Individual trait groups
const defense = TraitCalculator.calculateDefense(defenseProtein);
// Returns: { armor: 6.4, toxicity: 0.2 }

const movement = TraitCalculator.calculateMovement(speedProtein);
// Returns: { maxSpeed: 2.1, acceleration: 0.08 }
```

## Complete Trait List

| Trait | Range | Based On | Description |
|-------|-------|----------|-------------|
| **Size** | 8-20 | Protein length | Physical size |
| **Mass** | 0.8-2.0 | Size/10 | Derived from size |
| **Max Speed** | 1-3 | Flexibility | Movement speed |
| **Acceleration** | 0.05-0.25 | Tiny amino acids | Quick response |
| **Armor** | 0-8 | Hydrophobic ratio | Physical defense |
| **Toxicity** | 0-1 | Aromatic ratio | Chemical defense (rare) |
| **Metabolic Rate** | 0.5-2.0 | Polar ratio | Energy consumption |
| **Energy Efficiency** | 1-2 | Hydrophobic ratio | Food absorption |
| **Reproduction Cost** | 40-88 | Protein length | Energy to reproduce |
| **Reproduction Threshold** | 70-100 | Large amino acid ratio | Min energy to reproduce |
| **Vision Range** | 80-200 | Polar ratio | Detection distance |
| **Detection Radius** | 40-100 | Positive ratio | Close-range sensing |
| **Aggression** | 0-1 | Positive + hydrophobic | Attack tendency |
| **Cooperativeness** | 0-1 | 1 - aggression | Cooperation tendency |

## Evolution Through Mutations

When DNA mutates:
1. Gene sequence changes (A, T, G, C)
2. Protein sequence changes (amino acids)
3. Protein properties change (ratios, counts)
4. TraitCalculator formulas apply
5. Phenotype traits change
6. Organism behavior/appearance changes
7. Natural selection acts on fitness

This creates emergent evolution where beneficial mutations (e.g., more hydrophobic amino acids → better armor) are selected for over time.
