/**
 * OrganismAI - AI behaviors for autonomous organisms
 * Handles food seeking, movement, and species interaction
 * Uses bacterial chemotaxis (run-and-tumble) for realistic exploration
 */
export class OrganismAI {
  constructor(organism, world) {
    this.organism = organism;
    this.world = world;
    this.target = null;
    this.state = 'idle'; // idle, seeking_food, fleeing, attacking, cooperating
    this.stateTimer = 0;
    this.stuckTimer = 0;
    this.lowSpeedTimer = 0;
    this.lastSpeed = 0;
    this.minSpeedThreshold = 0.03; // below this considered low speed
    this.stuckThresholdMs = 600;   // time before applying recovery

    // Chemotaxis parameters (run-and-tumble)
    this.runState = 'run'; // 'run' or 'tumble'
    this.runTimer = 0;
    this.runDuration = this.generateRunDuration();
    this.baselineTumbleRate = 0.15; // baseline probability to tumble per second
    this.tumbleRate = this.baselineTumbleRate;
    this.runDirection = { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 };
    this.normalizeVector(this.runDirection);

    // Gradient sensing
    this.currentConcentration = 0;
    this.previousConcentration = 0;
    this.concentrationMemory = [];
    this.memoryWindow = 5; // remember last N measurements

    // Exploration bias
    this.explorationBias = 0.3; // tendency to explore new areas
    this.lastPosition = { x: organism.x, y: organism.y };
    this.territoryRadius = 200; // radius around spawn point
  }

  /**
   * Generate exponentially distributed run duration (in milliseconds)
   */
  generateRunDuration(mean = 1000) {
    // Exponential distribution: -mean * ln(1 - random())
    return -mean * Math.log(1 - Math.random());
  }

  /**
   * Normalize a vector to unit length
   */
  normalizeVector(vec) {
    const len = Math.sqrt(vec.x * vec.x + vec.y * vec.y);
    if (len > 0) {
      vec.x /= len;
      vec.y /= len;
    }
    return vec;
  }

  /**
   * Measure chemical concentration (food density) at current position
   */
  measureConcentration() {
    const searchRadius = this.organism.phenotype.visionRange * 0.5;
    let totalConcentration = 0;

    // Use spatial grid lookup instead of iterating all food
    const nearbyFood = this.world.getFoodNear(this.organism.x, this.organism.y, searchRadius);

    for (const food of nearbyFood) {
      const dx = food.x - this.organism.x;
      const dy = food.y - this.organism.y;
      const distSq = dx * dx + dy * dy;

      // Inverse square law for concentration (closer food = stronger signal)
      const concentration = food.energy / Math.max(1, distSq * 0.01);
      totalConcentration += concentration;
    }

    // Also consider crowding as negative concentration (avoidance)
    const crowdPenalty = this.measureCrowding() * 0.3;

    return Math.max(0, totalConcentration - crowdPenalty);
  }

  /**
   * Measure crowding around the organism
   */
  measureCrowding() {
    const radius = Math.max(30, this.organism.phenotype.size * 3);
    const neighbors = this.world.getOrganismsNear(this.organism.x, this.organism.y, radius);
    let crowding = 0;

    for (const other of neighbors) {
      if (other === this.organism || !other.isAlive) continue;
      const distance = this.organism.distanceTo(other);
      if (distance > 0 && distance < radius) {
        crowding += 1 / distance;
      }
    }

    return crowding;
  }

  /**
   * Update AI behavior with chemotaxis
   */
  update(deltaTime) {
    if (!this.organism.isAlive) return;

    this.stateTimer += deltaTime;
    this.runTimer += deltaTime;

    // Urgency based on low energy: 0 when >= 30%, up to 1 when 0%
    const energyRatio = Math.max(0, Math.min(1, this.organism.energy / Math.max(1, this.organism.maxEnergy)));
    this.urgency = energyRatio < 0.3 ? (0.3 - energyRatio) / 0.3 : 0;

    // Track movement to detect stuck/standby
    const speed = Math.hypot(this.organism.vx, this.organism.vy);
    if (speed < this.minSpeedThreshold) {
      this.lowSpeedTimer += deltaTime;
      this.stuckTimer += deltaTime;
    } else {
      this.lowSpeedTimer = 0;
      this.stuckTimer = 0;
    }

    // Wall avoidance only (gentler, always active)
    this.avoidWalls();

    // If stuck for > threshold, force a tumble
    if (this.stuckTimer > this.stuckThresholdMs) {
      this.tumble();
      this.stuckTimer = 0;
      this.lowSpeedTimer = 0;
    }

    // Main AI decision tree
    switch (this.state) {
      case 'idle':
        this.chemotaxis(deltaTime);
        // Apply gentle crowd avoidance only during exploration
        if (Math.random() < 0.3) {
          this.avoidCrowding();
        }
        // Periodically check for nearby food to target
        if (this.stateTimer > 300) {
          this.seekFood();
          this.stateTimer = 0;
        }
        break;
      case 'seeking_food':
        { this.moveTowardTarget();
        // Apply collision avoidance when seeking food
        this.avoidCrowding();
        // Re-evaluate more frequently when urgent
        const reevaluateMs = (this.urgency && this.urgency > 0) ? 250 : 500;
        if (this.stateTimer > reevaluateMs) {
          this.seekFood();
          this.stateTimer = 0;
        }
        // Add slight exploration while seeking
        if (Math.random() < 0.15) {
          this.chemotaxis(deltaTime);
        }
        break; }
      case 'fleeing':
        this.fleeFromThreat();
        // No crowd avoidance when fleeing - just run!
        if (this.stateTimer > 2000) {
          this.state = 'idle';
          this.stateTimer = 0;
        }
        break;
      case 'attacking':
        this.moveTowardTarget();
        // Minimal crowd avoidance when attacking
        if (Math.random() < 0.2) {
          this.avoidCrowding();
        }
        if (this.stateTimer > 3000) {
          this.state = 'idle';
          this.stateTimer = 0;
        }
        break;
      case 'cooperating':
        this.moveTowardTarget();
        // Apply collision avoidance when cooperating
        this.avoidCrowding();
        if (this.stateTimer > 2000) {
          this.state = 'idle';
          this.stateTimer = 0;
        }
        break;
    }

    // Check for nearby organisms
    this.evaluateNearbyOrganisms();
  }

  /**
   * Bacterial chemotaxis: run-and-tumble algorithm
   */
  chemotaxis(deltaTime) {
    // Measure current concentration
    this.previousConcentration = this.currentConcentration;
    this.currentConcentration = this.measureConcentration();

    // Store in memory
    this.concentrationMemory.push(this.currentConcentration);
    if (this.concentrationMemory.length > this.memoryWindow) {
      this.concentrationMemory.shift();
    }

    // Calculate gradient (change in concentration)
    const gradient = this.currentConcentration - this.previousConcentration;

    // Adjust tumble rate based on gradient
    if (gradient > 0) {
      // Moving up gradient (favorable) - reduce tumble probability
      this.tumbleRate = this.baselineTumbleRate * 0.3;
    } else if (gradient < 0) {
      // Moving down gradient (unfavorable) - increase tumble probability
      this.tumbleRate = this.baselineTumbleRate * 2.5;
    } else {
      // No change - baseline tumble rate
      this.tumbleRate = this.baselineTumbleRate;
    }

    // Increase tumble rate when urgent (more exploration)
    if (this.urgency > 0.5) {
      this.tumbleRate *= (1 + this.urgency);
    }

    // Run state
    if (this.runState === 'run') {
      // Move in current run direction
      const thrust = 0.8 + this.urgency * 0.4; // faster when urgent
      this.organism.move(this.runDirection.x * thrust, this.runDirection.y * thrust);

      // Check if should tumble
      const shouldTumble =
        this.runTimer >= this.runDuration ||
        Math.random() < (this.tumbleRate * deltaTime / 1000);

      if (shouldTumble) {
        this.tumble();
      }
    } else if (this.runState === 'tumble') {
      // Tumbling: choose new random direction
      if (this.runTimer >= 100) { // tumble for 100ms
        this.runState = 'run';
        this.runTimer = 0;
        this.runDuration = this.generateRunDuration(800 + Math.random() * 400);
      }
    }
  }

  /**
   * Tumble: choose a new random direction
   */
  tumble() {
    this.runState = 'tumble';
    this.runTimer = 0;

    // Generate new direction with bias toward exploration
    const angle = Math.random() * Math.PI * 2;
    this.runDirection.x = Math.cos(angle);
    this.runDirection.y = Math.sin(angle);

    // Add slight bias away from crowded areas
    const neighbors = this.world.getOrganismsNear(
      this.organism.x,
      this.organism.y,
      this.organism.phenotype.size * 5
    );

    if (neighbors.length > 3) {
      let avgX = 0, avgY = 0;
      for (const other of neighbors) {
        if (other === this.organism) continue;
        avgX += other.x;
        avgY += other.y;
      }
      avgX /= neighbors.length;
      avgY /= neighbors.length;

      // Bias away from center of crowd
      const awayX = this.organism.x - avgX;
      const awayY = this.organism.y - avgY;
      const awayLen = Math.sqrt(awayX * awayX + awayY * awayY);

      if (awayLen > 0) {
        const bias = 0.4;
        this.runDirection.x = this.runDirection.x * (1 - bias) + (awayX / awayLen) * bias;
        this.runDirection.y = this.runDirection.y * (1 - bias) + (awayY / awayLen) * bias;
        this.normalizeVector(this.runDirection);
      }
    }

    // Give a small impulse in new direction
    this.organism.vx += this.runDirection.x * 0.3;
    this.organism.vy += this.runDirection.y * 0.3;
  }

  /**
   * Find and seek nearest food
   */
  seekFood() {
    let nearestFood = null;
    let nearestDistSq = Infinity;

    // Expand search when urgent; at very high urgency, use large search
    const vision = (this.urgency && this.urgency > 0.7)
      ? Math.max(this.world.width, this.world.height)
      : this.organism.phenotype.visionRange * (1 + (this.urgency || 0) * 0.75);

    // Use spatial grid lookup
    const nearbyFood = this.world.getFoodNear(this.organism.x, this.organism.y, vision);

    for (const food of nearbyFood) {
      const dx = food.x - this.organism.x;
      const dy = food.y - this.organism.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearestFood = food;
      }
    }

    if (nearestFood) {
      this.target = nearestFood;
      this.state = 'seeking_food';
    } else {
      // No food found - return to idle state for chemotaxis exploration
      this.state = 'idle';
      this.target = null;
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
      const boost = 1 + (this.urgency || 0) * 1.5; // move faster when urgent
      this.organism.move((dx / distance) * boost, (dy / distance) * boost);
    }
  }

  /**
   * Apply a small separation force to avoid crowding (only when very close)
   */
  avoidCrowding() {
    const collisionRadius = this.organism.phenotype.size * 2; // Only avoid when very close
    const neighbors = this.world.getOrganismsNear(this.organism.x, this.organism.y, collisionRadius);
    let ax = 0, ay = 0, count = 0;

    for (const other of neighbors) {
      if (other === this.organism || !other.isAlive) continue;
      const dx = this.organism.x - other.x;
      const dy = this.organism.y - other.y;
      const dist = Math.hypot(dx, dy);

      // Only apply force if actually overlapping or very close
      if (dist > 0 && dist < collisionRadius) {
        // Gentler weighting - linear falloff instead of 1/distance
        const weight = (collisionRadius - dist) / collisionRadius;
        ax += (dx / dist) * weight;
        ay += (dy / dist) * weight;
        count++;
      }
    }

    if (count > 0) {
      const strength = 0.3; // Reduced separation strength
      this.organism.move(ax * strength, ay * strength);
    }
  }

  /**
   * Nudge away from walls to prevent getting stuck along edges
   */
  avoidWalls() {
    const margin = Math.max(50, this.organism.phenotype.size * 3);
    const { x, y } = this.organism;
    const { width, height } = this.world;
    let fx = 0, fy = 0;

    // Gentler wall avoidance with smoother falloff
    if (x < margin) {
      fx += ((margin - x) / margin) * 0.8; // Reduced strength
    }
    if (x > width - margin) {
      fx -= ((x - (width - margin)) / margin) * 0.8;
    }
    if (y < margin) {
      fy += ((margin - y) / margin) * 0.8;
    }
    if (y > height - margin) {
      fy -= ((y - (height - margin)) / margin) * 0.8;
    }

    if (fx !== 0 || fy !== 0) {
      const k = 0.6; // Reduced wall avoidance gain
      this.organism.move(fx * k, fy * k);
    }
  }

  /**
   * Evaluate nearby organisms for interaction
   */
  evaluateNearbyOrganisms() {
    const detection = this.organism.phenotype.detectionRadius * (1 + (this.urgency || 0));
    const nearby = this.world.getOrganismsNear(
      this.organism.x,
      this.organism.y,
      detection
    );

    for (const other of nearby) {
      if (other === this.organism || !other.isAlive) continue;

      // Never target parent or offspring
      if (this.organism.isParentChildRelation(other)) {
        continue;
      }

      const isSameSpecies = this.organism.isSameSpecies(other);
      const distance = this.organism.distanceTo(other);

      // Same species - check for cooperation opportunity
      if (isSameSpecies) {
        // Highly cooperative organisms actively seek to help struggling kin
        if (this.organism.phenotype.cooperativeness > 0.5) {
          // Check if other needs help (low energy)
          const otherNeedsHelp = other.energy < other.maxEnergy * 0.5;
          const canHelp = this.organism.energy > this.organism.maxEnergy * 0.5;

          if (otherNeedsHelp && canHelp && distance < this.organism.phenotype.size * 4) {
            // Enter cooperation state to move toward struggling kin
            this.target = other;
            this.state = 'cooperating';
            this.stateTimer = 0;
            continue; // Skip other checks
          }
        }

        // Very cooperative organisms don't attack same species
        if (this.organism.phenotype.cooperativeness > 0.7) {
          continue;
        }
      }

      // Different species - evaluate threat
      const myPower = this.organism.phenotype.size + this.organism.phenotype.toxicity * 10;
      const theirPower = other.phenotype.size + other.phenotype.toxicity * 10;

      // Aggressive organisms attack if stronger; thresholds tuned to phenotype cap (~0.3)
      const baseAggression = this.organism.phenotype.aggression;
      // Lower baseline threshold and allow urgency to reduce it slightly (but not below 0.15)
      const attackAggressionThreshold = Math.max(0.15, 0.25 - (this.urgency || 0) * 0.15);
      // Require modest power advantage; at high urgency allow near-parity but not disadvantage
      const powerAdvantage = Math.max(0.95, 1.1 - (this.urgency || 0) * 0.3);
      if (baseAggression >= attackAggressionThreshold && myPower >= theirPower * powerAdvantage) {
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
      return this.organism.reproduce(this.world.mutationRate || 0.05, this.world);
    }
    return null;
  }
}
