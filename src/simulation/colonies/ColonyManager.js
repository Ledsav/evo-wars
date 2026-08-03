const MIN_INDIVIDUAL_ADHESION = 0.24;
const MIN_PAIR_ADHESION = 0.32;
const GEOMETRY_UPDATE_INTERVAL = 120;
const CONTACT_BOND_MATURATION_TIME = 26000;
const DIVISION_BOND_MATURATION_TIME = 10000;
const MATURE_BOND_THRESHOLD = 0.9;
const DIFFERENTIATION_UPDATE_INTERVAL = 900;
const MIN_SPECIALIZATION_MEMBERS = 3;
const MIN_SPECIALIZATION_MATURITY = 0.42;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function getBondKey(first, second) {
  return first.id < second.id
    ? `${first.id}:${second.id}`
    : `${second.id}:${first.id}`;
}

function cross(origin, first, second) {
  return (
    (first.x - origin.x) * (second.y - origin.y) -
    (first.y - origin.y) * (second.x - origin.x)
  );
}

function convexHull(points) {
  if (points.length <= 3) return points;

  const sorted = [...points].sort((first, second) => (
    first.x === second.x ? first.y - second.y : first.x - second.x
  ));
  const lower = [];
  const upper = [];

  for (const point of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0
    ) {
      lower.pop();
    }
    lower.push(point);
  }

  for (let index = sorted.length - 1; index >= 0; index--) {
    const point = sorted[index];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0
    ) {
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function getMemberBoundaryPoints(member) {
  const radius = Math.max(4, member.phenotype.size * 0.88);
  const points = [];

  for (let index = 0; index < 8; index++) {
    const angle = (index / 8) * Math.PI * 2;
    points.push({
      x: member.x + Math.cos(angle) * radius,
      y: member.y + Math.sin(angle) * radius
    });
  }

  return points;
}

export class ColonyManager {
  constructor() {
    this.bonds = new Map();
    this.bondsByOrganism = new Map();
    this.colonies = [];
    this.colonyByOrganism = new Map();
    this.rebindCooldowns = new Map();
    this.ruptureCount = 0;
    this.topologyDirty = false;
    this.lastGeometryUpdate = 0;
    this.lastDifferentiationUpdate = 0;
  }

  getBondCount(organism) {
    return this.bondsByOrganism.get(organism.id)?.size || 0;
  }

  hasBond(first, second) {
    return this.bonds.has(getBondKey(first, second));
  }

  canCreateBond(first, second) {
    if (!first?.isAlive || !second?.isAlive || first === second) return false;
    if (!first.isSameSpecies(second) || this.hasBond(first, second)) return false;

    const firstAdhesion = first.phenotype.adhesion || 0;
    const secondAdhesion = second.phenotype.adhesion || 0;
    const pairAdhesion = (firstAdhesion + secondAdhesion) / 2;
    if (
      firstAdhesion < MIN_INDIVIDUAL_ADHESION ||
      secondAdhesion < MIN_INDIVIDUAL_ADHESION ||
      pairAdhesion < MIN_PAIR_ADHESION
    ) {
      return false;
    }

    return (
      this.getBondCount(first) < (first.phenotype.bondCapacity || 1) &&
      this.getBondCount(second) < (second.phenotype.bondCapacity || 1)
    );
  }

  tryCreateBond(first, second, currentTime = 0, options = {}) {
    const key = getBondKey(first, second);
    const cooldownUntil = this.rebindCooldowns.get(key) || 0;
    if (currentTime < cooldownUntil) return false;
    if (cooldownUntil > 0) this.rebindCooldowns.delete(key);
    if (!this.canCreateBond(first, second)) return false;

    const distance = Math.hypot(second.x - first.x, second.y - first.y);
    const contactDistance = first.phenotype.size + second.phenotype.size;
    const contactRange = options.inheritedFromDivision ? 1.65 : 1.35;
    if (distance > contactDistance * contactRange) return false;

    const strength = clamp(
      ((first.phenotype.bondStrength || 0) +
        (second.phenotype.bondStrength || 0)) / 2,
      0,
      1
    );
    const pairAdhesion =
      ((first.phenotype.adhesion || 0) +
        (second.phenotype.adhesion || 0)) / 2;
    const restLength = Math.max(contactDistance * 1.04, distance);
    const inheritedFromDivision = options.inheritedFromDivision === true;
    const bond = {
      key,
      first,
      second,
      restLength,
      maxLength: restLength,
      geneticStrength: strength,
      strength: 0,
      pairAdhesion,
      inheritedFromDivision,
      initialMaturity: inheritedFromDivision ? 0.55 : 0.16,
      maturationTime: inheritedFromDivision
        ? DIVISION_BOND_MATURATION_TIME
        : CONTACT_BOND_MATURATION_TIME,
      maturity: 0,
      strain: 0,
      ruptureTolerance: 0,
      ruptureCost: 0,
      baseConductivity: Math.min(
        first.phenotype.energyConductivity || 0,
        second.phenotype.energyConductivity || 0
      ),
      conductivity: 0,
      baseMaintenance:
        ((first.phenotype.bondMaintenance || 0.04) +
          (second.phenotype.bondMaintenance || 0.04)) / 2,
      maintenance: 0,
      matrixInvestment: 0,
      createdAt: currentTime,
      lastTransfer: 0,
      lastDonorId: null
    };
    this.updateBondMaturation(bond, currentTime);

    this.bonds.set(key, bond);
    this.addBondReference(first.id, key);
    this.addBondReference(second.id, key);
    this.topologyDirty = true;
    return true;
  }

  integrateOffspring(parent, offspring, currentTime = 0) {
    const colony = this.getColonyForOrganism(parent);
    const candidates = [
      parent,
      ...(colony?.members || []).filter(member => member !== parent)
    ].sort((first, second) => (
      Math.hypot(offspring.x - first.x, offspring.y - first.y) -
      Math.hypot(offspring.x - second.x, offspring.y - second.y)
    ));
    let createdBonds = 0;
    const maximumBonds = Math.min(
      2,
      offspring.phenotype.bondCapacity || 1
    );

    for (const candidate of candidates) {
      if (createdBonds >= maximumBonds) break;
      if (
        this.tryCreateBond(candidate, offspring, currentTime, {
          inheritedFromDivision: true
        })
      ) {
        createdBonds++;
      }
    }

    return createdBonds;
  }

  addBondReference(organismId, key) {
    if (!this.bondsByOrganism.has(organismId)) {
      this.bondsByOrganism.set(organismId, new Set());
    }
    this.bondsByOrganism.get(organismId).add(key);
  }

  removeBond(key, options = {}) {
    const bond = this.bonds.get(key);
    if (!bond) return false;

    if (options.ruptured) {
      this.applyRuptureCost(bond);
      this.rebindCooldowns.set(
        key,
        (options.currentTime || 0) + 2500 + bond.strength * 3500
      );
      this.ruptureCount++;
    }

    this.bonds.delete(key);
    for (const organism of [bond.first, bond.second]) {
      const references = this.bondsByOrganism.get(organism.id);
      references?.delete(key);
      if (references?.size === 0) {
        this.bondsByOrganism.delete(organism.id);
      }
    }
    this.topologyDirty = true;
    return true;
  }

  applyRuptureCost(bond) {
    for (const organism of [bond.first, bond.second]) {
      if (!organism.isAlive) continue;
      organism.energy = Math.max(0, organism.energy - bond.ruptureCost);
      organism._lastBondRupture = Date.now();
      if (organism.energy <= 0) organism.die();
    }
  }

  removeOrganism(organism) {
    const references = this.bondsByOrganism.get(organism.id);
    organism.setCellRoleTarget?.('generalist');
    if (!references) return;

    for (const key of [...references]) {
      this.removeBond(key);
    }
    this.bondsByOrganism.delete(organism.id);
    this.colonyByOrganism.delete(organism.id);
    organism._colonyId = null;
  }

  update(deltaTime, currentTime) {
    const deltaSeconds = Math.min(250, Math.max(0, deltaTime)) / 1000;

    for (const bond of [...this.bonds.values()]) {
      if (
        !bond.first.isAlive ||
        !bond.second.isAlive ||
        !bond.first.isSameSpecies(bond.second)
      ) {
        this.removeBond(bond.key);
        continue;
      }

      this.updateBondMaturation(bond, currentTime);
      const deltaX = bond.second.x - bond.first.x;
      const deltaY = bond.second.y - bond.first.y;
      const distance = Math.hypot(deltaX, deltaY);

      if (distance > bond.maxLength) {
        const overload = distance / bond.maxLength - 1;
        bond.strain += deltaSeconds * (0.6 + overload * 1.6);

        if (
          distance >= bond.maxLength * 2.2 ||
          bond.strain >= bond.ruptureTolerance
        ) {
          this.removeBond(bond.key, {
            ruptured: true,
            currentTime
          });
          continue;
        }
      } else {
        bond.strain = Math.max(0, bond.strain - deltaSeconds * 1.8);
      }

      if (distance > 0) {
        this.applyBondPhysics(bond, deltaX, deltaY, distance);
      }
      this.transferEnergy(bond, deltaSeconds, currentTime);
      this.payMaintenance(bond, deltaSeconds);
    }

    if (this.topologyDirty) {
      this.rebuildColonies(currentTime);
    }

    if (currentTime - this.lastGeometryUpdate >= GEOMETRY_UPDATE_INTERVAL) {
      this.updateColonyGeometry();
      this.lastGeometryUpdate = currentTime;
    }

    if (
      currentTime - this.lastDifferentiationUpdate >=
      DIFFERENTIATION_UPDATE_INTERVAL
    ) {
      this.updateCellSpecialization(currentTime);
      this.lastDifferentiationUpdate = currentTime;
    }

    this.coordinateColonyMotion(deltaSeconds);
  }

  updateBondMaturation(bond, currentTime) {
    const elapsed = Math.max(0, currentTime - bond.createdAt);
    const maturationProgress = clamp(elapsed / bond.maturationTime, 0, 1);
    bond.maturity = bond.initialMaturity +
      (1 - bond.initialMaturity) * maturationProgress;

    const regulatedStrength = clamp(
      ((bond.first.phenotype.bondStrength || 0) +
        (bond.second.phenotype.bondStrength || 0)) / 2,
      0,
      1
    );
    bond.pairAdhesion = clamp(
      ((bond.first.phenotype.adhesion || 0) +
        (bond.second.phenotype.adhesion || 0)) / 2,
      0,
      1
    );
    bond.baseConductivity = Math.min(
      bond.first.phenotype.energyConductivity || 0,
      bond.second.phenotype.energyConductivity || 0
    );
    bond.baseMaintenance =
      ((bond.first.phenotype.bondMaintenance || 0.04) +
        (bond.second.phenotype.bondMaintenance || 0.04)) / 2;

    const matrixFactor = 0.58 + bond.maturity * 0.42;
    bond.strength = clamp(
      Math.max(bond.geneticStrength, regulatedStrength) * matrixFactor +
        bond.maturity * 0.08,
      0,
      1
    );
    bond.maxLength = bond.restLength * (
      1.3 + bond.strength * 0.65 + bond.maturity * 0.3
    );
    bond.ruptureTolerance =
      0.3 + bond.strength * 0.62 + bond.maturity * 0.5;
    bond.ruptureCost =
      4 + bond.pairAdhesion * 5 + bond.strength * 7 + bond.maturity * 10;
    bond.conductivity =
      bond.baseConductivity * (0.35 + bond.maturity * 0.65);
    bond.maintenance =
      bond.baseMaintenance * (0.7 + bond.maturity * 0.3);
    bond.matrixInvestment =
      bond.baseMaintenance * (1 - bond.maturity) * 0.65;
  }

  updateCellSpecialization(currentTime) {
    for (const colony of this.colonies) {
      const averageMaturity = colony.bonds.length > 0
        ? colony.bonds.reduce((total, bond) => total + bond.maturity, 0) /
          colony.bonds.length
        : 0;

      if (
        colony.members.length < MIN_SPECIALIZATION_MEMBERS ||
        averageMaturity < MIN_SPECIALIZATION_MATURITY
      ) {
        for (const member of colony.members) {
          member.setCellRoleTarget?.('generalist', currentTime);
        }
        continue;
      }

      const assignments = new Map();
      const memberCount = colony.members.length;
      const radialDistance = member => Math.hypot(
        member.x - colony.centerX,
        member.y - colony.centerY
      ) / Math.max(1, colony.radius);
      const energyRatio = member => member.energy / Math.max(1, member.maxEnergy);
      const roleSlots = [
        {
          role: 'matrix',
          count: Math.max(1, Math.floor(memberCount * 0.2)),
          score: member =>
            this.getBondCount(member) * 2.2 -
            radialDistance(member) +
            (member.phenotype.adhesion || 0)
        },
        {
          role: 'stem',
          count: Math.max(1, Math.floor(memberCount * 0.12)),
          score: member =>
            energyRatio(member) * 2 +
            Math.min(1, member.age / 30000) -
            this.getBondCount(member) * 0.15
        },
        {
          role: 'defender',
          count: memberCount >= 5
            ? Math.max(1, Math.floor(memberCount * 0.15))
            : 0,
          score: member =>
            radialDistance(member) * 2 +
            (member.phenotype.armor || 0) / 8 +
            (member.phenotype.toxicity || 0)
        },
        {
          role: 'feeder',
          count: Math.max(1, Math.floor(memberCount * 0.24)),
          score: member =>
            radialDistance(member) +
            (member.phenotype.energyEfficiency || 1) -
            energyRatio(member) * 0.4
        },
        {
          role: 'motor',
          count: memberCount >= 6
            ? Math.max(1, Math.floor(memberCount * 0.15))
            : 0,
          score: member =>
            radialDistance(member) +
            (member.phenotype.maxSpeed || 0) +
            (member.phenotype.acceleration || 0) * 2
        }
      ];

      for (const slot of roleSlots) {
        this.assignRole(
          colony.members,
          assignments,
          slot.role,
          slot.count,
          slot.score
        );
      }

      for (const member of colony.members) {
        member.setCellRoleTarget?.(
          assignments.get(member.id) || 'generalist',
          currentTime
        );
      }
    }
  }

  assignRole(members, assignments, role, count, score) {
    if (count <= 0) return;

    const candidates = members
      .filter(member => !assignments.has(member.id))
      .sort((first, second) => {
        const firstRetention = first.cellRoleTarget === role ? 100 : 0;
        const secondRetention = second.cellRoleTarget === role ? 100 : 0;
        return (
          secondRetention + score(second) -
          firstRetention - score(first)
        );
      });

    for (let index = 0; index < Math.min(count, candidates.length); index++) {
      assignments.set(candidates[index].id, role);
    }
  }

  coordinateColonyMotion(deltaSeconds) {
    for (const colony of this.colonies) {
      if (colony.members.length < 2) continue;

      let averageVelocityX = 0;
      let averageVelocityY = 0;
      let averageMaturity = 0;
      for (const member of colony.members) {
        averageVelocityX += member.vx;
        averageVelocityY += member.vy;
      }
      for (const bond of colony.bonds) {
        averageMaturity += bond.maturity;
      }

      averageVelocityX /= colony.members.length;
      averageVelocityY /= colony.members.length;
      averageMaturity = colony.bonds.length > 0
        ? averageMaturity / colony.bonds.length
        : 0;
      const alignment = 1 - Math.exp(
        -(1.2 + averageMaturity * 2.4) * deltaSeconds
      );

      for (const member of colony.members) {
        member.vx += (averageVelocityX - member.vx) * alignment;
        member.vy += (averageVelocityY - member.vy) * alignment;
      }
    }
  }

  applyBondPhysics(bond, deltaX, deltaY, distance) {
    const normalX = deltaX / distance;
    const normalY = deltaY / distance;
    const extension = Math.max(0, distance - bond.restLength);
    const pull = Math.min(
      0.22,
      (extension / Math.max(1, bond.restLength)) *
        (0.065 + bond.strength * 0.13)
    );

    bond.first.vx += normalX * pull;
    bond.first.vy += normalY * pull;
    bond.second.vx -= normalX * pull;
    bond.second.vy -= normalY * pull;

    const relativeVelocity =
      (bond.second.vx - bond.first.vx) * normalX +
      (bond.second.vy - bond.first.vy) * normalY;
    const damping = relativeVelocity * 0.035;
    bond.first.vx += normalX * damping;
    bond.first.vy += normalY * damping;
    bond.second.vx -= normalX * damping;
    bond.second.vy -= normalY * damping;
  }

  transferEnergy(bond, deltaSeconds, currentTime) {
    const energyDifference = bond.first.energy - bond.second.energy;
    if (Math.abs(energyDifference) < 2 || bond.conductivity <= 0) return;

    const donor = energyDifference > 0 ? bond.first : bond.second;
    const recipient = donor === bond.first ? bond.second : bond.first;
    const flowRate = 2 + bond.conductivity * 14;
    const amount = Math.min(
      Math.abs(energyDifference) / 2,
      flowRate * deltaSeconds,
      donor.energy,
      recipient.maxEnergy - recipient.energy
    );

    if (amount <= 0) return;

    donor.energy -= amount;
    recipient.energy += amount;
    bond.lastTransfer = currentTime;
    bond.lastDonorId = donor.id;
    donor._lastCooperation = Date.now();
    recipient._lastCooperation = Date.now();
  }

  payMaintenance(bond, deltaSeconds) {
    const cost = (bond.maintenance + bond.matrixInvestment) * deltaSeconds;
    bond.first.energy -= cost;
    bond.second.energy -= cost;

    if (bond.first.energy <= 0) bond.first.die();
    if (bond.second.energy <= 0) bond.second.die();
  }

  rebuildColonies(currentTime) {
    const previousColonies = new Map(
      this.colonies.map(colony => [colony.id, colony])
    );
    const previousMembers = new Set(
      this.colonies.flatMap(colony => colony.members)
    );
    const adjacency = new Map();
    const organisms = new Map();

    for (const bond of this.bonds.values()) {
      organisms.set(bond.first.id, bond.first);
      organisms.set(bond.second.id, bond.second);
      if (!adjacency.has(bond.first.id)) adjacency.set(bond.first.id, new Set());
      if (!adjacency.has(bond.second.id)) adjacency.set(bond.second.id, new Set());
      adjacency.get(bond.first.id).add(bond.second.id);
      adjacency.get(bond.second.id).add(bond.first.id);
    }

    for (const member of previousMembers) {
      member._colonyId = null;
    }

    this.colonies = [];
    this.colonyByOrganism.clear();
    const visited = new Set();

    for (const organismId of adjacency.keys()) {
      if (visited.has(organismId)) continue;

      const memberIds = [];
      const stack = [organismId];
      visited.add(organismId);

      while (stack.length > 0) {
        const currentId = stack.pop();
        memberIds.push(currentId);
        for (const neighborId of adjacency.get(currentId) || []) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            stack.push(neighborId);
          }
        }
      }

      if (memberIds.length < 2) continue;

      memberIds.sort((first, second) => first - second);
      const members = memberIds.map(id => organisms.get(id)).filter(Boolean);
      const id = `colony-${memberIds[0]}`;
      const colony = {
        id,
        members,
        bonds: [],
        speciesId: members[0].getSpeciesId(),
        bornAt: previousColonies.get(id)?.bornAt ?? currentTime,
        hull: [],
        centerX: 0,
        centerY: 0,
        radius: 0,
        totalEnergy: 0
      };

      this.colonies.push(colony);
      for (const member of members) {
        member._colonyId = id;
        this.colonyByOrganism.set(member.id, colony);
      }
    }

    for (const bond of this.bonds.values()) {
      const colony = this.colonyByOrganism.get(bond.first.id);
      if (colony && colony === this.colonyByOrganism.get(bond.second.id)) {
        colony.bonds.push(bond);
      }
    }

    for (const member of previousMembers) {
      if (!this.colonyByOrganism.has(member.id)) {
        member.setCellRoleTarget?.('generalist', currentTime);
      }
    }

    this.topologyDirty = false;
    this.updateColonyGeometry();
  }

  updateColonyGeometry() {
    for (const colony of this.colonies) {
      let centerX = 0;
      let centerY = 0;
      let totalEnergy = 0;
      const boundaryPoints = [];

      for (const member of colony.members) {
        centerX += member.x;
        centerY += member.y;
        totalEnergy += member.energy;
        boundaryPoints.push(...getMemberBoundaryPoints(member));
      }

      centerX /= colony.members.length;
      centerY /= colony.members.length;
      colony.centerX = centerX;
      colony.centerY = centerY;
      colony.totalEnergy = totalEnergy;
      colony.hull = convexHull(boundaryPoints);
      colony.radius = colony.hull.reduce((maximum, point) => (
        Math.max(maximum, Math.hypot(point.x - centerX, point.y - centerY))
      ), 0);
    }
  }

  getBonds() {
    return this.bonds.values();
  }

  getColonies() {
    return this.colonies;
  }

  getColonyForOrganism(organism) {
    return this.colonyByOrganism.get(organism.id) || null;
  }

  getStats() {
    let largestColony = 0;
    let matureBondCount = 0;
    let divisionBondCount = 0;
    let totalBondMaturity = 0;
    for (const colony of this.colonies) {
      largestColony = Math.max(largestColony, colony.members.length);
    }
    for (const bond of this.bonds.values()) {
      if (bond.maturity >= MATURE_BOND_THRESHOLD) matureBondCount++;
      if (bond.inheritedFromDivision) divisionBondCount++;
      totalBondMaturity += bond.maturity;
    }

    return {
      colonyCount: this.colonies.length,
      bondCount: this.bonds.size,
      matureBondCount,
      divisionBondCount,
      averageBondMaturity: this.bonds.size > 0
        ? totalBondMaturity / this.bonds.size
        : 0,
      largestColony,
      ruptureCount: this.ruptureCount
    };
  }

  clear() {
    for (const colony of this.colonies) {
      for (const member of colony.members) {
        member._colonyId = null;
        member.setCellRoleTarget?.('generalist');
      }
    }
    this.bonds.clear();
    this.bondsByOrganism.clear();
    this.colonies = [];
    this.colonyByOrganism.clear();
    this.rebindCooldowns.clear();
    this.ruptureCount = 0;
    this.topologyDirty = false;
    this.lastGeometryUpdate = 0;
    this.lastDifferentiationUpdate = 0;
  }
}
