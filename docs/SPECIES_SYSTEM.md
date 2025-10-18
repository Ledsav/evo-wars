# Biologically Accurate Species System for Asexual Organisms

## Overview

This simulation now implements a **phylotype-based species concept** that accurately models how biologists classify asexual organisms (like bacteria, archaea, and other organisms that reproduce by division).

## Biological Foundation

### Why Not Use the Biological Species Concept?

The traditional Biological Species Concept (ability to interbreed) doesn't work for asexual organisms. Instead, microbiologists use:

1. **Phylogenetic clustering** - organisms that share recent common ancestry
2. **Phenotypic/ecotype differentiation** - organisms with distinct ecological traits
3. **Genetic distance thresholds** - typically 3-5% DNA divergence for bacterial species

### Our Implementation: Phylotype Clustering

Our system combines all three approaches:

- **Species Founder Tracking**: Each species has a "founder" organism
- **Phenotypic Distance**: ~25% trait divergence triggers speciation
- **Genetic Distance**: ~25% DNA divergence triggers speciation
- **Phylogenetic Continuity**: Species maintain identity across generations

## How It Works

### Species Formation

1. **Initial Organisms**: Each starting organism is its own species founder
2. **Inheritance**: Offspring inherit their parent's species founder ID
3. **Mutation & Comparison**: After mutations, offspring compare their traits to the species founder
4. **Speciation Check**: If phenotypic OR genetic distance exceeds threshold, the organism becomes a NEW species founder

### Speciation Thresholds

```javascript
// Phenotypic distance threshold
PHENOTYPIC_THRESHOLD = 0.25  // 25% trait divergence

// Genetic similarity threshold
GENETIC_SIMILARITY_THRESHOLD = 0.75  // 75% minimum similarity
```

### Trait Weighting

Not all traits are equally important for species differentiation. We weight them by ecological significance:

**High Weight (2.0)**:
- Size (affects all interactions)
- Metabolic rate (fundamental metabolic difference)

**Medium-High Weight (1.2-1.5)**:
- Speed, armor, vision (functional capabilities)

**Medium Weight (1.0)**:
- Aggression, reproduction threshold (behavioral traits)

**Low Weight (0.2-0.8)**:
- Color, efficiency (less ecologically critical)

## Code Structure

### New Files

#### `PhenotypeComparator.js`
Calculates phenotypic and genetic distances between organisms.

**Key Methods**:
- `calculateDistance(org1, org2)` - Returns phenotypic distance (0-1+)
- `calculateGenomeSimilarity(org1, org2)` - Returns genetic similarity (0-1)
- `shouldSpeciate(organism, founder)` - Determines if speciation should occur

#### Modified Files

**`Organism.js`**:
- Added `speciesFounderId` - tracks which organism founded this species
- Added `checkSpeciation(world)` - checks if organism should become new species
- Added `becomeSpeciesFounder(world)` - promotes organism to species founder
- Modified `getSpeciesId()` - now returns founder ID (stable across generations)
- Modified `isSameSpecies(other)` - now compares founder IDs

**`World.js`**:
- Added `speciesFounders` Map - tracks all species founder organisms
- Added `speciationEvents` array - logs speciation events
- Added `getOrganismById(id)` - fast lookup for species founders
- Added `onSpeciationEvent(newFounder, oldSpeciesId)` - handles speciation

**`OrganismAI.js`**:
- Modified `tryReproduce()` - now passes world parameter to enable speciation checks

## Biological Accuracy

### What This Models

✅ **Bacterial speciation** - Like E. coli diverging into different strains
✅ **Adaptive radiation** - Single ancestor → multiple specialized species
✅ **Ecotype differentiation** - Species occupy distinct ecological niches
✅ **Phylogenetic trees** - Clear lineage relationships
✅ **Gradual evolution** - Small mutations accumulate over time

### What Makes It Realistic

1. **Stable species IDs**: Species don't change with every tiny mutation (unlike hash-based systems)
2. **Phenotype matters**: Organisms that look/act similar are same species
3. **Founder tracking**: Clear evolutionary history and lineages
4. **Observable divergence**: You can watch species split in real-time
5. **Extinction handling**: If founder dies, descendants can become new founders

## Examples

### Normal Reproduction (No Speciation)
```
Parent (Species 42, founded by Organism #42)
  ↓ reproduces with small mutation
Child (Species 42, founded by Organism #42)
  → Phenotypic distance: 0.05 (5% different)
  → Still same species as parent
```

### Speciation Event
```
Parent (Species 42, founded by Organism #42)
  ↓ reproduces with significant mutation
Child (Species 128, founded by Organism #128)
  → Phenotypic distance: 0.28 (28% different - exceeds 25% threshold!)
  → Becomes NEW species founder
  → Future descendants will compare to Organism #128
```

### Multi-Generation Divergence
```
Organism #1 (Founder of Species 1)
  ↓
Organism #5 (Species 1, 10% different from #1)
  ↓
Organism #12 (Species 1, 18% different from #1)
  ↓
Organism #23 (Species 1, 24% different from #1)
  ↓
Organism #42 (Species 42 - NEW FOUNDER! 27% different from #1)
  ↓
Organism #89 (Species 42, 8% different from #42)
```

## Performance Considerations

- **Founder lookup**: O(1) via Map data structure
- **Distance calculation**: Only occurs after mutations
- **Memory**: Founders kept in memory, but limited to living organisms
- **Log size**: Speciation events capped at 100 most recent

## Future Enhancements

Possible additions:
- **Hybridization**: Rare horizontal gene transfer events
- **Ring species**: Geographic isolation leading to speciation
- **Subspecies**: Track varieties within species
- **Extinction events**: Track when species lineages end
- **Visualization**: Real-time phylogenetic tree display

## References

This implementation is inspired by:

1. **Bacterial species concepts** (16S rRNA clustering)
2. **Ecotype simulation theory** (Cohan, 2002)
3. **Phylotype-based classification** (used in metagenomics)
4. **Asexual speciation models** (bdelloid rotifers, some lizards)

## Testing the System

To observe speciation in action:

1. Start simulation with 1-2 initial species
2. Set mutation rate to ~5-10% for faster evolution
3. Watch the species count increase over time
4. Check `world.speciationEvents` to see when new species emerged
5. Compare phenotypes of different species - they should be visibly distinct

---

**Last Updated**: 2025-01-18
**System Version**: Phylotype Clustering v1.0
