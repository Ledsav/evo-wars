import { Organism } from '../organisms/Organism.js';
import { OrganismAI } from '../organisms/OrganismAI.js';

/**
 * World - Contains all organisms and handles simulation
 * Manages game state, collisions, and interactions
 */
export class World {
  constructor(width = 800, height = 600) {
    this.width = width;
    this.height = height;
    this.organisms = [];
    this.organismAIs = new Map(); // Map organism to AI
    this.playerOrganism = null;
    this.time = 0;
    this.isPaused = false;

    // World resources
    this.foodParticles = [];

    // Environment parameters
    this.foodSpawnRate = 0.5;
    this.temperature = 1.0;
    this.mutationRate = 0.05;
    this.initialPopulation = 10;
  }

  /**
   * Set the player's organism
   */
  setPlayerOrganism(organism) {
    this.playerOrganism = organism;
    if (!this.organisms.includes(organism)) {
      this.addOrganism(organism);
    }
  }

  /**
   * Add organism to world with AI
   */
  addOrganism(organism) {
    // Keep organism within bounds
    organism.x = Math.max(organism.phenotype.size, Math.min(this.width - organism.phenotype.size, organism.x));
    organism.y = Math.max(organism.phenotype.size, Math.min(this.height - organism.phenotype.size, organism.y));

    this.organisms.push(organism);

    // Create AI for organism if not player
    if (!organism.isPlayer) {
      this.organismAIs.set(organism, new OrganismAI(organism, this));
    }
  }

  /**
   * Remove organism from world
   */
  removeOrganism(organism) {
    const index = this.organisms.indexOf(organism);
    if (index > -1) {
      this.organisms.splice(index, 1);
      this.organismAIs.delete(organism);
    }
  }

  /**
   * Add food particle
   */
  addFood(x, y, energy = 20) {
    this.foodParticles.push({
      x,
      y,
      energy,
      radius: 5 + energy / 10
    });
  }

  /**
   * Spawn random food
   */
  spawnRandomFood(count = 1) {
    for (let i = 0; i < count; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      const energy = 10 + Math.random() * 20;
      this.addFood(x, y, energy);
    }
  }

  /**
   * Update world (called each frame)
   */
  update(deltaTime) {
    if (this.isPaused) return;

    this.time += deltaTime;

    // Update all organisms
    for (const organism of this.organisms) {
      // Apply temperature effect to metabolism
      const tempModifiedDelta = deltaTime * this.temperature;
      organism.update(tempModifiedDelta);

      // Update AI behavior
      const ai = this.organismAIs.get(organism);
      if (ai) {
        ai.update(deltaTime);

        // Try to reproduce
        const offspring = ai.tryReproduce();
        if (offspring) {
          this.addOrganism(offspring);
        }
      }
    }

    // Handle collisions
    this.handleCollisions();

    // Handle food consumption
    this.handleFoodConsumption();

    // Remove dead organisms
    this.removeDeadOrganisms();

    // Keep organisms in bounds
    this.keepOrganismsInBounds();

    // Spawn food based on food spawn rate
    const maxFood = Math.floor(10 + this.foodSpawnRate * 20);
    const spawnChance = 0.001 * deltaTime * this.foodSpawnRate;
    if (this.foodParticles.length < maxFood && Math.random() < spawnChance) {
      this.spawnRandomFood(1);
    }
  }

  /**
   * Handle collisions between organisms
   */
  handleCollisions() {
    for (let i = 0; i < this.organisms.length; i++) {
      for (let j = i + 1; j < this.organisms.length; j++) {
        const org1 = this.organisms[i];
        const org2 = this.organisms[j];

        if (org1.isAlive && org2.isAlive && org1.collidesWith(org2)) {
          this.resolveCollision(org1, org2);
        }
      }
    }
  }

  /**
   * Resolve collision between two organisms
   */
  resolveCollision(org1, org2) {
    // Check if parent-child relationship exists
    if (org1.isParentChildRelation(org2)) {
      // Just push apart, no combat
      this.pushOrganismsApart(org1, org2);
      return;
    }

    // Get AI states
    const ai1 = this.organismAIs.get(org1);
    const ai2 = this.organismAIs.get(org2);
    const org1Attacking = ai1 && ai1.state === 'attacking';
    const org2Attacking = ai2 && ai2.state === 'attacking';

    // Only apply combat if at least one is in attacking state
    if (!org1Attacking && !org2Attacking) {
      // Just push apart, no combat
      this.pushOrganismsApart(org1, org2);
      return;
    }

    // Combat: larger/more toxic organism damages smaller one
    const power1 = org1.phenotype.size + org1.phenotype.toxicity * 10;
    const power2 = org2.phenotype.size + org2.phenotype.toxicity * 10;

    // Only the attacker deals damage
    if (org1Attacking && power1 > power2) {
      org2.takeDamage(5);
      if (!org2.isAlive) {
        // Winner consumes loser
        org1.consume(org2.phenotype.size * 10);
        org1.dnaPoints += org2.phenotype.size * 0.5;
      }
    } else if (org2Attacking && power2 > power1) {
      org1.takeDamage(5);
      if (!org1.isAlive) {
        org2.consume(org1.phenotype.size * 10);
        org2.dnaPoints += org1.phenotype.size * 0.5;
      }
    } else if (org1Attacking && org2Attacking) {
      // Both attacking - mutual combat
      if (power1 > power2) {
        org2.takeDamage(5);
        if (!org2.isAlive) {
          org1.consume(org2.phenotype.size * 10);
          org1.dnaPoints += org2.phenotype.size * 0.5;
        }
      } else if (power2 > power1) {
        org1.takeDamage(5);
        if (!org1.isAlive) {
          org2.consume(org1.phenotype.size * 10);
          org2.dnaPoints += org1.phenotype.size * 0.5;
        }
      } else {
        // Equal power - both take damage
        org1.takeDamage(3);
        org2.takeDamage(3);
      }
    }

    // Push organisms apart
    this.pushOrganismsApart(org1, org2);
  }

  /**
   * Push two organisms apart to prevent overlap
   */
  pushOrganismsApart(org1, org2) {
    const dx = org2.x - org1.x;
    const dy = org2.y - org1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = org1.phenotype.size + org2.phenotype.size;

    if (distance < minDistance && distance > 0) {
      const pushForce = (minDistance - distance) / 2;
      const nx = dx / distance;
      const ny = dy / distance;

      org1.x -= nx * pushForce;
      org1.y -= ny * pushForce;
      org2.x += nx * pushForce;
      org2.y += ny * pushForce;
    }
  }

  /**
   * Handle food consumption
   */
  handleFoodConsumption() {
    for (const organism of this.organisms) {
      if (!organism.isAlive) continue;

      for (let i = this.foodParticles.length - 1; i >= 0; i--) {
        const food = this.foodParticles[i];
        const dx = organism.x - food.x;
        const dy = organism.y - food.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < organism.phenotype.size + food.radius) {
          organism.consume(food.energy);
          this.foodParticles.splice(i, 1);
        }
      }
    }
  }

  /**
   * Remove dead organisms
   */
  removeDeadOrganisms() {
    // Convert dead organisms to food
    for (let i = this.organisms.length - 1; i >= 0; i--) {
      const organism = this.organisms[i];
      if (!organism.isAlive && organism !== this.playerOrganism) {
        // Leave food behind
        this.addFood(organism.x, organism.y, organism.phenotype.size * 5);
        this.organisms.splice(i, 1);
      }
    }
  }

  /**
   * Keep organisms within world bounds
   */
  keepOrganismsInBounds() {
    for (const organism of this.organisms) {
      const size = organism.phenotype.size;

      if (organism.x < size) {
        organism.x = size;
        organism.vx = Math.abs(organism.vx) * 0.5;
      } else if (organism.x > this.width - size) {
        organism.x = this.width - size;
        organism.vx = -Math.abs(organism.vx) * 0.5;
      }

      if (organism.y < size) {
        organism.y = size;
        organism.vy = Math.abs(organism.vy) * 0.5;
      } else if (organism.y > this.height - size) {
        organism.y = this.height - size;
        organism.vy = -Math.abs(organism.vy) * 0.5;
      }
    }
  }

  /**
   * Get all alive organisms
   */
  getAliveOrganisms() {
    return this.organisms.filter(org => org.isAlive);
  }

  /**
   * Get organisms near a position
   */
  getOrganismsNear(x, y, radius) {
    return this.organisms.filter(org => {
      if (!org.isAlive) return false;
      const dx = org.x - x;
      const dy = org.y - y;
      return Math.sqrt(dx * dx + dy * dy) <= radius;
    });
  }

  /**
   * Spawn initial population
   */
  spawnInitialPopulation() {
    this.clear();

    for (let i = 0; i < this.initialPopulation; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      const organism = new Organism(x, y);
      organism.energy = 50 + Math.random() * 50; // Random initial energy
      this.addOrganism(organism);
    }

    // Spawn some initial food
    this.spawnRandomFood(Math.floor(this.initialPopulation * 0.5));
  }

  /**
   * Update environment parameters
   */
  setEnvironmentParams(params) {
    if (params.foodSpawnRate !== undefined) {
      this.foodSpawnRate = params.foodSpawnRate;
    }
    if (params.temperature !== undefined) {
      this.temperature = params.temperature;
    }
    if (params.mutationRate !== undefined) {
      this.mutationRate = params.mutationRate;
    }
    if (params.initialPopulation !== undefined) {
      this.initialPopulation = params.initialPopulation;
    }
  }

  /**
   * Toggle pause
   */
  togglePause() {
    this.isPaused = !this.isPaused;
  }

  /**
   * Clear all organisms and reset world
   */
  clear() {
    this.organisms = [];
    this.organismAIs.clear();
    this.foodParticles = [];
    this.time = 0;
    this.playerOrganism = null;
  }

  /**
   * Get world statistics
   */
  getStats() {
    const alive = this.getAliveOrganisms();
    return {
      totalOrganisms: this.organisms.length,
      aliveOrganisms: alive.length,
      foodParticles: this.foodParticles.length,
      worldTime: this.time.toFixed(1),
      averageEnergy: alive.length > 0
        ? (alive.reduce((sum, org) => sum + org.energy, 0) / alive.length).toFixed(1)
        : 0
    };
  }
}
