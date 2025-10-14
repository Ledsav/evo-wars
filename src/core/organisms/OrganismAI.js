/**
 * OrganismAI - AI behaviors for autonomous organisms
 * Handles food seeking, movement, and species interaction
 */
export class OrganismAI {
  constructor(organism, world) {
    this.organism = organism;
    this.world = world;
    this.target = null;
    this.state = 'idle'; // idle, seeking_food, fleeing, attacking
    this.stateTimer = 0;
  }

  /**
   * Update AI behavior
   */
  update(deltaTime) {
    if (!this.organism.isAlive) return;

    this.stateTimer += deltaTime;

    // Main AI decision tree
    switch (this.state) {
      case 'idle':
        this.seekFood();
        break;
      case 'seeking_food':
        this.moveTowardTarget();
        // Re-evaluate every 500ms
        if (this.stateTimer > 500) {
          this.seekFood();
          this.stateTimer = 0;
        }
        break;
      case 'fleeing':
        this.fleeFromThreat();
        if (this.stateTimer > 2000) {
          this.state = 'idle';
          this.stateTimer = 0;
        }
        break;
      case 'attacking':
        this.moveTowardTarget();
        if (this.stateTimer > 3000) {
          this.state = 'idle';
          this.stateTimer = 0;
        }
        break;
    }

    // Check for nearby organisms
    this.evaluateNearbyOrganisms();
  }

  /**
   * Find and seek nearest food
   */
  seekFood() {
    let nearestFood = null;
    let nearestDistance = Infinity;

    for (const food of this.world.foodParticles) {
      const dx = food.x - this.organism.x;
      const dy = food.y - this.organism.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < nearestDistance && distance < this.organism.phenotype.visionRange) {
        nearestDistance = distance;
        nearestFood = food;
      }
    }

    if (nearestFood) {
      this.target = nearestFood;
      this.state = 'seeking_food';
    } else {
      // Wander randomly if no food found
      this.wander();
    }
  }

  /**
   * Move toward current target
   */
  moveTowardTarget() {
    if (!this.target) {
      this.state = 'idle';
      return;
    }

    const dx = this.target.x - this.organism.x;
    const dy = this.target.y - this.organism.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0) {
      this.organism.move(dx / distance, dy / distance);
    }
  }

  /**
   * Wander randomly
   */
  wander() {
    // Random movement with some persistence
    if (!this.wanderDirection || Math.random() < 0.02) {
      const angle = Math.random() * Math.PI * 2;
      this.wanderDirection = {
        x: Math.cos(angle),
        y: Math.sin(angle)
      };
    }

    this.organism.move(this.wanderDirection.x * 0.5, this.wanderDirection.y * 0.5);
  }

  /**
   * Evaluate nearby organisms for interaction
   */
  evaluateNearbyOrganisms() {
    const nearby = this.world.getOrganismsNear(
      this.organism.x,
      this.organism.y,
      this.organism.phenotype.detectionRadius
    );

    for (const other of nearby) {
      if (other === this.organism || !other.isAlive) continue;

      // Never target parent or offspring
      if (this.organism.isParentChildRelation(other)) {
        continue;
      }

      const isSameSpecies = this.organism.isSameSpecies(other);
      const distance = this.organism.distanceTo(other);

      // Same species - cooperation or neutral
      if (isSameSpecies) {
        // Cooperative organisms might share space peacefully
        if (this.organism.phenotype.cooperativeness > 0.7) {
          // Don't attack, just coexist
          continue;
        }
      }

      // Different species - evaluate threat
      const myPower = this.organism.phenotype.size + this.organism.phenotype.toxicity * 10;
      const theirPower = other.phenotype.size + other.phenotype.toxicity * 10;

      // Aggressive organisms attack if stronger
      if (this.organism.phenotype.aggression > 0.6 && myPower > theirPower * 1.2) {
        if (distance < this.organism.phenotype.size * 3) {
          this.target = other;
          this.state = 'attacking';
          this.stateTimer = 0;
        }
      }
      // Flee if much weaker
      else if (theirPower > myPower * 1.5 && distance < this.organism.phenotype.size * 4) {
        this.target = other;
        this.state = 'fleeing';
        this.stateTimer = 0;
      }
    }
  }

  /**
   * Flee from threat
   */
  fleeFromThreat() {
    if (!this.target) {
      this.state = 'idle';
      return;
    }

    const dx = this.organism.x - this.target.x;
    const dy = this.organism.y - this.target.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0) {
      this.organism.move(dx / distance, dy / distance);
    }
  }

  /**
   * Try to reproduce if conditions are met
   */
  tryReproduce() {
    if (this.organism.canReproduce() && Math.random() < 0.01) {
      return this.organism.reproduce(this.world.mutationRate || 0.05);
    }
    return null;
  }
}
