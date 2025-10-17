# Evo Wars - Project Structure

## Overview
Evo Wars is an evolution simulation game with a scientifically-inspired DNA/genetics system. The game features real protein synthesis following the central dogma of molecular biology.

## Architecture

The project follows **SOLID principles** with a clear separation of concerns:

```
src/
├── core/                     # Core game logic (domain layer)
│   ├── genetics/            # Genetics system
│   │   ├── GeneticCode.js   # Universal genetic code (codon table)
│   │   ├── DNASequence.js   # DNA sequence representation
│   │   ├── Protein.js       # Protein with amino acid analysis
│   │   ├── Gene.js          # Gene expression (DNA → RNA → Protein)
│   │   ├── Genome.js        # Collection of genes
│   │   └── mutations/       # Mutation system
│   │       └── Mutation.js  # All mutation types
│   │
│   ├── organisms/           # Organism system
│   │   └── Organism.js      # Base organism class with phenotype
│   │
│   └── world/               # World/Environment
│       └── World.js         # World simulation & physics
│
├── engine/                  # Game engine layer
│   └── GameEngine.js        # Game loop & timing
│
├── rendering/               # Rendering layer
│   └── OrganismRenderer.js  # Canvas rendering
│
├── components/              # React UI components
│   ├── SimulationCanvas.jsx # Main simulation view
│   ├── DNAEditor.jsx        # DNA editing interface
│   └── ControlPanel.jsx     # Game controls & stats
│
├── App.jsx                  # Main application
└── App.css                  # Styling
```

## Core Systems

### 1. Genetics System

**Scientific Accuracy:**
- Uses the real universal genetic code
- Implements transcription (DNA → RNA)
- Implements translation (RNA → Protein)
- Analyzes amino acid properties (hydrophobic, charged, aromatic, etc.)
- Proteins affect organism phenotype

**Key Classes:**
- `GeneticCode`: Standard codon table
- `DNASequence`: DNA string with validation
- `Gene`: Can be expressed into proteins
- `Protein`: Amino acid sequence with chemical properties
- `Genome`: Collection of genes that define an organism

**Mutations (Strategy Pattern):**
- Point Mutation: Single base substitution
- Insertion: Add a nucleotide
- Deletion: Remove a nucleotide
- Duplication: Copy a DNA segment
- Inversion: Reverse a DNA segment

### 2. Organism System

**Phenotype Calculation:**
Genes → Proteins → Traits

Each gene affects specific traits:
- `size`: Body size and mass
- `speed`: Movement speed and acceleration
- `defense`: Armor and toxicity
- `metabolism`: Energy consumption and efficiency
- `reproduction`: Reproduction cost and threshold
- `sensory`: Vision and detection range

**Life Cycle:**
- Energy management
- Movement and physics
- Feeding and growth
- Reproduction (asexual)
- Death

### 3. World System

**Features:**
- Entity management
- Collision detection
- Food spawning
- Combat resolution
- Boundary enforcement

### 4. Game Engine

**Fixed Time Step Loop:**
- Consistent physics updates
- Decoupled from frame rate
- Callback-based architecture

## Gameplay

### Objective
Survive and reproduce as long as possible by:
1. Collecting food (green particles)
2. Avoiding/defeating other organisms
3. Mutating your DNA to adapt
4. Reproducing to continue your lineage

### Controls
- **WASD / Arrow Keys**: Move your organism
- **DNA Editor**: Click bases to mutate (costs DNA points)
- **Buttons**: Spawn food, spawn organisms, reproduce

### DNA Points
Earned by:
- Collecting food
- Surviving over time
- Defeating other organisms

Used for:
- Applying mutations (different costs per type)

### Mutations → Traits

**How it works:**
1. Select mutation type (point, insertion, deletion, etc.)
2. Click on a DNA base in a gene
3. Mutation changes DNA sequence
4. Gene produces different protein
5. Protein properties affect phenotype
6. Organism gains new traits

**Example:**
- Mutate `defense` gene → More hydrophobic amino acids → Higher armor value
- Mutate `speed` gene → More small amino acids → Higher speed

## Design Principles

### SOLID Principles Applied

**Single Responsibility:**
- Each class has one clear purpose
- GeneticCode only handles codon translation
- Organism only manages entity state
- World only manages simulation

**Open/Closed:**
- Mutation system uses Strategy pattern
- Easy to add new mutation types
- Easy to add new genes

**Liskov Substitution:**
- All mutations inherit from Mutation base class
- Can be used interchangeably

**Interface Segregation:**
- Clean interfaces between layers
- Components only receive needed props

**Dependency Inversion:**
- High-level modules don't depend on low-level details
- GameEngine depends on abstractions (callbacks)

### Design Patterns Used

1. **Strategy Pattern**: Mutations
2. **Factory Pattern**: MutationFactory
3. **Observer Pattern**: Game engine callbacks
4. **Component Pattern**: React components

## Cell-Like Visual Design

The game uses a biological, cell-inspired aesthetic:
- **DNA Bases**: Circular, color-coded (A=green, T=red, C=blue, G=yellow)
- **Organisms**: Cell-like bodies with membranes and nuclei
- **Food**: Glowing particles
- **UI**: Organic shapes with gradients

## Future Enhancements

## Planned Enhancements (TODO)

- [ ] Sexual reproduction (gene crossover) — Two‑parent mating, meiosis‑style recombination and inheritance. Priority: High.
- [ ] Environmental pressures (temperature, toxins) — Global/local environment variables that affect fitness and selection. Priority: High.
- [ ] Gene regulation (promoters, enhancers) — Regulatory sequences and expression control mechanics. Priority: High.
- [ ] More complex phenotypes — Compose traits from multiple genes/proteins and add emergent interactions. Priority: Medium.
- [ ] Epigenetics — Methylation/acetylation effects, reversible modifications and partial inheritance. Priority: Medium.
- [ ] Spider chart for attributes per specie
- [ ] Multi-cellular organisms — Cell adhesion, differentiation and basic body plans. Priority: Long‑term.
- [ ] Predator/prey behaviors — Hunting/fleeing AI, energy transfer and trophic dynamics. Priority: Medium. (Status: in progress)
- [x] Evolution trees / lineage tracking — Implemented.



## Running the Game

```bash
npm install
npm run dev
```

Open browser to the Vite dev server URL.
