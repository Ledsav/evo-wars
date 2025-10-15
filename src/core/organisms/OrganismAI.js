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
    this.stuckTimer = 0;
    this.lowSpeedTimer = 0;
    this.lastSpeed = 0;
    this.minSpeedThreshold = 0.03; // below this considered low speed
    this.stuckThresholdMs = 600;   // time before applying recovery
  }

  /**
   * Update AI behavior
   */
  update(deltaTime) {
    if (!this.organism.isAlive) return;

    this.stateTimer += deltaTime;
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

    // Global avoidance to reduce crowding/wall sticking
    this.avoidCrowding();
    this.avoidWalls();

    // If stuck for > threshold, force a wander direction change and a stronger nudge
    if (this.stuckTimer > this.stuckThresholdMs) {
      this.resetWander(true);
      // Stronger recovery impulse
      const impulse = 0.8;
      this.organism.vx += this.wanderDirection.x * impulse;
      this.organism.vy += this.wanderDirection.y * impulse;
      this.stuckTimer = 0;
      this.lowSpeedTimer = 0;
    }

    // Main AI decision tree
    switch (this.state) {
      case 'idle':
        this.seekFood();
        // Continuous idle drift to avoid standstill
        this.wander();
        break;
      case 'seeking_food':
        { this.moveTowardTarget();
        // Re-evaluate more frequently when urgent
        const reevaluateMs = (this.urgency && this.urgency > 0) ? 250 : 500;
        if (this.stateTimer > reevaluateMs) {
          this.seekFood();
          this.stateTimer = 0;
        }
        // Keep a bit of drift to avoid zero velocity oscillations
        this.wander(true);
        break; }
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

    // Expand search when urgent; at very high urgency, ignore vision cap
    const vision = (this.urgency && this.urgency > 0.7)
      ? Infinity
      : this.organism.phenotype.visionRange * (1 + (this.urgency || 0) * 0.75);

    for (const food of this.world.foodParticles) {
      const dx = food.x - this.organism.x;
      const dy = food.y - this.organism.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < nearestDistance && distance < vision) {
        nearestDistance = distance;
        nearestFood = food;
      }
    }

    if (nearestFood) {
      this.target = nearestFood;
      this.state = 'seeking_food';
    } else {
      // If urgent, push exploration more than wandering
      if (this.urgency && this.urgency > 0.2) {
        this.resetWander(true);
        this.wander();
      } else {
        // Wander randomly if no food found
        this.wander();
      }
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
   * Wander randomly
   */
  wander() {
    // Random movement with some persistence
    if (!this.wanderDirection || Math.random() < 0.02) {
      this.resetWander();
    }
    // Slight noise to prevent symmetry freezes
    const jitter = 0.05;
    const thrust = 0.9; // stronger continuous thrust
    this.organism.move(
      this.wanderDirection.x * thrust + (Math.random() - 0.5) * jitter,
      this.wanderDirection.y * thrust + (Math.random() - 0.5) * jitter
    );
  }

  resetWander(nudge = false) {
    const angle = Math.random() * Math.PI * 2;
    this.wanderDirection = { x: Math.cos(angle), y: Math.sin(angle) };
    if (nudge) {
      // Give a small push to break inertia
      this.organism.vx += this.wanderDirection.x * 0.5;
      this.organism.vy += this.wanderDirection.y * 0.5;
    }
  }

  /**
   * Apply a small separation force to avoid crowding
   */
  avoidCrowding() {
    const radius = Math.max(30, this.organism.phenotype.size * 3);
    const neighbors = this.world.getOrganismsNear(this.organism.x, this.organism.y, radius);
    let ax = 0, ay = 0, count = 0;
    for (const other of neighbors) {
      if (other === this.organism || !other.isAlive) continue;
      const dx = this.organism.x - other.x;
      const dy = this.organism.y - other.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0 && dist < radius) {
        const weight = 1 / dist;
        ax += (dx / dist) * weight;
        ay += (dy / dist) * weight;
        count++;
      }
    }
    if (count > 0) {
      const strength = 0.6; // separation strength
      this.organism.move(ax * strength, ay * strength);
    }
  }

  /**
   * Nudge away from walls to prevent getting stuck along edges
   */
  avoidWalls() {
    const margin = Math.max(40, this.organism.phenotype.size * 2);
    const { x, y } = this.organism;
    const { width, height } = this.world;
    let fx = 0, fy = 0;
    if (x < margin) fx += (margin - x) / margin;
    if (x > width - margin) fx -= (x - (width - margin)) / margin;
    if (y < margin) fy += (margin - y) / margin;
    if (y > height - margin) fy -= (y - (height - margin)) / margin;
    if (fx !== 0 || fy !== 0) {
      const k = 1.2; // wall avoidance gain
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

      // Aggressive organisms attack if stronger; when urgent, lower threshold
  const baseAggression = this.organism.phenotype.aggression;
  const attackAggressionThreshold = Math.max(0.3, 0.6 - (this.urgency || 0) * 0.2);
  const powerAdvantage = Math.max(0.95, 1.2 - (this.urgency || 0) * 0.25); // from 1.2 down to 0.95
      if (baseAggression > attackAggressionThreshold && myPower > theirPower * powerAdvantage) {
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
