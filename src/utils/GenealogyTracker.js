/**
 * GenealogyTracker - Tracks species lineage and evolutionary history
 * Creates a family tree of species showing mutations and branching
 */
export class GenealogyTracker {
  constructor() {
    // Map of speciesId -> SpeciesNode
    this.speciesNodes = new Map();

    // Root species (initial population)
    this.rootSpecies = new Set();

    // Track which organisms we've seen to detect new species
    this.seenOrganisms = new Set();

    // Performance: limit how often we check for new species
    this.lastCheckTime = 0;
    this.checkInterval = 100; // Check every 100ms
  }

  /**
   * Species Node - represents a species in the family tree
   */
  createSpeciesNode(speciesId, parentSpeciesId = null, representative = null) {
    return {
      id: speciesId,
      parentId: parentSpeciesId,
      children: new Set(),
      firstSeen: Date.now(),
      extinct: false,
      extinctTime: null,
      currentPopulation: 0,
      maxPopulation: 0,
      representative: representative, // Store a sample organism for rendering
      // Visual properties for thumbnail
      color: representative?.phenotype?.color || { h: 180, s: 60, l: 50 },
      phenotype: representative?.phenotype || null,
    };
  }

  /**
   * Register initial species (root nodes of the tree)
   */
  registerInitialSpecies(organisms) {
    for (const org of organisms) {
      const speciesId = org.getSpeciesId();

      if (!this.speciesNodes.has(speciesId)) {
        const node = this.createSpeciesNode(speciesId, null, org);
        this.speciesNodes.set(speciesId, node);
        this.rootSpecies.add(speciesId);
        this.seenOrganisms.add(org.id);
      }
    }
  }

  /**
   * Update species information based on current world state
   * This is called periodically (not every frame) for performance
   */
  update(world) {
    const currentTime = Date.now();

    // Throttle updates for performance
    if (currentTime - this.lastCheckTime < this.checkInterval) {
      return;
    }

    this.lastCheckTime = currentTime;

    // Get current alive organisms
    const aliveOrganisms = world.organisms.filter(org => org.isAlive);

    // Count populations per species
    const populationCounts = new Map();
    const speciesRepresentatives = new Map();

    for (const org of aliveOrganisms) {
      const speciesId = org.getSpeciesId();
      populationCounts.set(speciesId, (populationCounts.get(speciesId) || 0) + 1);

      // Store first organism as representative
      if (!speciesRepresentatives.has(speciesId)) {
        speciesRepresentatives.set(speciesId, org);
      }

      // Check if this is a new organism (potential new species from mutation)
      if (!this.seenOrganisms.has(org.id)) {
        this.handleNewOrganism(org, world);
        this.seenOrganisms.add(org.id);
      }
    }

    // Update population counts and check for extinctions
    for (const [speciesId, node] of this.speciesNodes) {
      const currentPop = populationCounts.get(speciesId) || 0;
      node.currentPopulation = currentPop;
      node.maxPopulation = Math.max(node.maxPopulation, currentPop);

      // Update representative if available
      if (speciesRepresentatives.has(speciesId)) {
        node.representative = speciesRepresentatives.get(speciesId);
        node.color = node.representative.phenotype.color;
        node.phenotype = node.representative.phenotype;
      }

      // Mark as extinct if population drops to 0
      if (currentPop === 0 && !node.extinct) {
        node.extinct = true;
        node.extinctTime = currentTime;
      }
    }
  }

  /**
   * Handle a new organism - check if it's a new species (mutation)
   */
  handleNewOrganism(organism, world) {
    const speciesId = organism.getSpeciesId();

    // If we already know about this species, nothing to do
    if (this.speciesNodes.has(speciesId)) {
      return;
    }

    // This is a new species! Find its parent
    const parentId = organism.parentId;
    let parentSpeciesId = null;

    if (parentId) {
      // Find the parent organism's species
      const parent = world.organisms.find(org => org.id === parentId);
      if (parent) {
        parentSpeciesId = parent.getSpeciesId();
      }
    }

    // Create new species node
    const node = this.createSpeciesNode(speciesId, parentSpeciesId, organism);
    this.speciesNodes.set(speciesId, node);

    // Add to parent's children
    if (parentSpeciesId && this.speciesNodes.has(parentSpeciesId)) {
      this.speciesNodes.get(parentSpeciesId).children.add(speciesId);
    }
  }

  /**
   * Get all root species (initial species with no parents)
   */
  getRootSpecies() {
    return Array.from(this.rootSpecies)
      .map(id => this.speciesNodes.get(id))
      .filter(node => node !== undefined);
  }

  /**
   * Get all species nodes as an array
   */
  getAllSpecies() {
    return Array.from(this.speciesNodes.values());
  }

  /**
   * Get children of a species
   */
  getChildren(speciesId) {
    const node = this.speciesNodes.get(speciesId);
    if (!node) return [];

    return Array.from(node.children)
      .map(id => this.speciesNodes.get(id))
      .filter(child => child !== undefined);
  }

  /**
   * Get statistics about the genealogy
   */
  getStats() {
    const all = this.getAllSpecies();
    const alive = all.filter(node => !node.extinct);
    const extinct = all.filter(node => node.extinct);

    return {
      totalSpecies: all.length,
      aliveSpecies: alive.length,
      extinctSpecies: extinct.length,
      rootSpecies: this.rootSpecies.size,
      maxDepth: this.calculateMaxDepth(),
    };
  }

  /**
   * Calculate maximum depth of the tree
   */
  calculateMaxDepth() {
    let maxDepth = 0;

    const calculateDepth = (speciesId, currentDepth) => {
      maxDepth = Math.max(maxDepth, currentDepth);
      const children = this.getChildren(speciesId);
      for (const child of children) {
        calculateDepth(child.id, currentDepth + 1);
      }
    };

    for (const rootId of this.rootSpecies) {
      calculateDepth(rootId, 0);
    }

    return maxDepth;
  }

  /**
   * Get tree structure for rendering (breadth-first layout)
   * Groups extinct species into collapsed nodes
   */
  getTreeLayout(collapseExtinct = true) {
    const layout = [];
    const visited = new Set();

    // Process each root species
    for (const rootId of this.rootSpecies) {
      if (visited.has(rootId)) continue;

      // Breadth-first traversal to create levels
      const queue = [{ id: rootId, depth: 0 }];

      while (queue.length > 0) {
        const { id, depth } = queue.shift();

        if (visited.has(id)) continue;
        visited.add(id);

        const node = this.speciesNodes.get(id);
        if (!node) continue;

        // Ensure level exists
        if (!layout[depth]) {
          layout[depth] = [];
        }

        // Add node to level
        layout[depth].push({
          ...node,
          children: Array.from(node.children),
        });

        // Add children to queue
        for (const childId of node.children) {
          queue.push({ id: childId, depth: depth + 1 });
        }
      }
    }

    // Group extinct species if requested
    if (collapseExtinct) {
      return this.collapseExtinctSpecies(layout);
    }

    return layout;
  }

  /**
   * Collapse extinct species into grouped nodes (one group per generation/level)
   */
  collapseExtinctSpecies(layout) {
    const collapsedLayout = [];

    for (let depth = 0; depth < layout.length; depth++) {
      const level = layout[depth];
      const aliveNodes = [];
      const extinctNodes = [];

      // Separate alive and extinct nodes
      for (const node of level) {
        if (node.extinct) {
          extinctNodes.push(node);
        } else {
          aliveNodes.push(node);
        }
      }

      const collapsedLevel = [...aliveNodes];

      // If there are extinct nodes, create ONE collapsed group node for this generation
      if (extinctNodes.length > 0) {
        const groupNode = {
          id: `extinct-group-${depth}`,
          isExtinctGroup: true,
          extinct: true,
          extinctCount: extinctNodes.length,
          extinctNodes: extinctNodes,
          currentPopulation: 0,
          maxPopulation: extinctNodes.reduce((sum, n) => sum + n.maxPopulation, 0),
          children: [],
          firstSeen: Math.min(...extinctNodes.map(n => n.firstSeen)),
          extinctTime: Math.max(...extinctNodes.map(n => n.extinctTime || n.firstSeen)),
          // Use first extinct node's representative for display
          representative: extinctNodes[0]?.representative,
          color: { h: 0, s: 0, l: 40 },
          phenotype: extinctNodes[0]?.phenotype,
        };
        collapsedLevel.push(groupNode);
      }

      if (collapsedLevel.length > 0) {
        collapsedLayout[depth] = collapsedLevel;
      }
    }

    return collapsedLayout;
  }

  /**
   * Clear all genealogy data
   */
  clear() {
    this.speciesNodes.clear();
    this.rootSpecies.clear();
    this.seenOrganisms.clear();
    this.lastCheckTime = 0;
  }
}
