function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function seededFraction(seed, salt) {
  let value = (seed + Math.imul(salt + 1, 0x6D2B79F5)) >>> 0;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function color(palette, lightnessOffset = 0, saturationOffset = 0, alpha = 1, secondary = false) {
  const hue = secondary ? palette.secondaryHue : palette.primaryHue;
  const saturation = clamp(palette.saturation + saturationOffset, 12, 76);
  const lightness = clamp(palette.lightness + lightnessOffset, 18, 88);
  return `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
}

function getBounds(visual, size) {
  const planScale = {
    coccoid: { length: 0.86, height: 0.8 },
    capsule: { length: visual.aspectRatio * 0.72, height: 0.62 },
    spindle: { length: visual.aspectRatio * 0.76, height: 0.58 },
    segmented: { length: visual.aspectRatio * 0.72, height: 0.56 },
    radial: { length: 0.95, height: 0.95 },
    amoeboid: { length: visual.aspectRatio * 0.72, height: 0.82 },
    colonial: { length: visual.aspectRatio * 0.72, height: 0.8 }
  };
  const scale = planScale[visual.bodyPlan] || planScale.coccoid;

  return {
    halfLength: size * scale.length,
    halfHeight: size * scale.height
  };
}

function traceSegmentedBody(ctx, visual, size, bounds) {
  const segmentCount = visual.segmentCount;
  const segmentRadius = Math.min(
    bounds.halfHeight,
    (bounds.halfLength * 2) / (segmentCount + 1)
  );
  const spacing = segmentCount === 1
    ? 0
    : (bounds.halfLength * 2 - segmentRadius * 1.5) / (segmentCount - 1);

  for (let index = 0; index < segmentCount; index++) {
    const progress = segmentCount === 1 ? 0.5 : index / (segmentCount - 1);
    const x = -bounds.halfLength + segmentRadius * 0.75 + spacing * index;
    const y = Math.sin((progress - 0.5) * Math.PI) * visual.curvature * size * 0.4;
    const radiusScale = 0.82 + Math.sin(progress * Math.PI) * 0.18;
    ctx.ellipse(
      x,
      y,
      segmentRadius * radiusScale,
      segmentRadius * (0.84 + radiusScale * 0.12),
      0,
      0,
      Math.PI * 2
    );
  }
}

function traceColonialBody(ctx, visual, size) {
  const unitCount = visual.internal.nucleusCount;
  const unitRadius = size * 0.33;

  ctx.arc(0, 0, unitRadius * 1.12, 0, Math.PI * 2);
  for (let index = 0; index < unitCount; index++) {
    const angle = (index / unitCount) * Math.PI * 2;
    const distance = size * (0.42 + seededFraction(visual.seed, index + 31) * 0.08);
    ctx.moveTo(Math.cos(angle) * distance + unitRadius, Math.sin(angle) * distance);
    ctx.arc(
      Math.cos(angle) * distance,
      Math.sin(angle) * distance,
      unitRadius * (0.78 + seededFraction(visual.seed, index + 41) * 0.22),
      0,
      Math.PI * 2
    );
  }
}

function traceRadialBody(ctx, visual, size) {
  const armCount = clamp(visual.lobes, 5, 9);
  const outerRadius = size * 0.96;
  const innerRadius = size * 0.55;
  const pointCount = armCount * 2;

  for (let index = 0; index < pointCount; index++) {
    const angle = (index / pointCount) * Math.PI * 2;
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function traceAmoeboidBody(ctx, visual, size, bounds) {
  const pointCount = 18;

  for (let index = 0; index < pointCount; index++) {
    const angle = (index / pointCount) * Math.PI * 2;
    const irregularity = 0.78 + seededFraction(visual.seed, index + 71) * 0.34;
    const x = Math.cos(angle) * bounds.halfLength * irregularity;
    const y = Math.sin(angle) * bounds.halfHeight * irregularity;

    if (index === 0) ctx.moveTo(x, y);
    else {
      const previousAngle = ((index - 0.5) / pointCount) * Math.PI * 2;
      const controlRadius = 0.9 + seededFraction(visual.seed, index + 91) * 0.14;
      ctx.quadraticCurveTo(
        Math.cos(previousAngle) * bounds.halfLength * controlRadius,
        Math.sin(previousAngle) * bounds.halfHeight * controlRadius,
        x,
        y
      );
    }
  }
  ctx.closePath();
}

function traceBody(ctx, visual, size) {
  const bounds = getBounds(visual, size);
  ctx.beginPath();

  switch (visual.bodyPlan) {
    case 'capsule':
      ctx.ellipse(0, 0, bounds.halfLength, bounds.halfHeight, 0, 0, Math.PI * 2);
      break;
    case 'spindle':
      ctx.moveTo(bounds.halfLength, 0);
      ctx.bezierCurveTo(
        bounds.halfLength * 0.25,
        -bounds.halfHeight,
        -bounds.halfLength * (0.7 + visual.taper * 0.2),
        -bounds.halfHeight * 0.72,
        -bounds.halfLength,
        0
      );
      ctx.bezierCurveTo(
        -bounds.halfLength * (0.7 + visual.taper * 0.2),
        bounds.halfHeight * 0.72,
        bounds.halfLength * 0.25,
        bounds.halfHeight,
        bounds.halfLength,
        0
      );
      ctx.closePath();
      break;
    case 'segmented':
      traceSegmentedBody(ctx, visual, size, bounds);
      break;
    case 'radial':
      traceRadialBody(ctx, visual, size);
      break;
    case 'amoeboid':
      traceAmoeboidBody(ctx, visual, size, bounds);
      break;
    case 'colonial':
      traceColonialBody(ctx, visual, size);
      break;
    case 'coccoid':
    default:
      ctx.ellipse(0, 0, bounds.halfLength, bounds.halfHeight, 0, 0, Math.PI * 2);
      break;
  }

  return bounds;
}

function drawLocomotion(ctx, visual, size, palette, bounds) {
  ctx.save();
  ctx.strokeStyle = color(palette, -16, -12, 0.76, true);
  ctx.fillStyle = color(palette, 10, -16, 0.56, true);
  ctx.lineCap = 'round';

  if (visual.locomotion.type === 'flagella') {
    for (let index = 0; index < visual.locomotion.count; index++) {
      const offset = (index - (visual.locomotion.count - 1) / 2) * size * 0.2;
      const length = size * visual.locomotion.length;
      const bend = (seededFraction(visual.seed, index + 111) - 0.5) * size;
      ctx.beginPath();
      ctx.moveTo(-bounds.halfLength * 0.9, offset);
      ctx.bezierCurveTo(
        -bounds.halfLength - length * 0.25,
        offset + bend * 0.2,
        -bounds.halfLength - length * 0.62,
        offset - bend * 0.35,
        -bounds.halfLength - length,
        offset + bend * 0.45
      );
      ctx.lineWidth = Math.max(0.7, size * 0.055);
      ctx.stroke();
    }
  } else if (visual.locomotion.type === 'cilia') {
    const count = visual.locomotion.count;
    for (let index = 0; index < count; index++) {
      const angle = (index / count) * Math.PI * 2;
      const startX = Math.cos(angle) * bounds.halfLength * 0.92;
      const startY = Math.sin(angle) * bounds.halfHeight * 0.92;
      const length = size * (0.16 + visual.locomotion.length * 0.12);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(
        startX + Math.cos(angle) * length,
        startY + Math.sin(angle) * length
      );
      ctx.lineWidth = Math.max(0.55, size * 0.035);
      ctx.stroke();
    }
  } else if (visual.locomotion.type === 'fins') {
    const finLength = size * visual.locomotion.length * 0.68;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-size * 0.22, side * bounds.halfHeight * 0.82);
      ctx.quadraticCurveTo(
        size * 0.08,
        side * (bounds.halfHeight + finLength),
        size * 0.42,
        side * bounds.halfHeight * 0.72
      );
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = Math.max(0.7, size * 0.045);
      ctx.stroke();
    }
  } else if (visual.locomotion.type === 'pseudopods') {
    const limbCount = visual.bodyPlan === 'amoeboid' ? 5 : 3;
    for (let index = 0; index < limbCount; index++) {
      const angle = Math.PI * (0.7 + index * (1.6 / Math.max(1, limbCount - 1)));
      const startX = Math.cos(angle) * bounds.halfLength * 0.72;
      const startY = Math.sin(angle) * bounds.halfHeight * 0.72;
      const endX = Math.cos(angle) * bounds.halfLength * 1.26;
      const endY = Math.sin(angle) * bounds.halfHeight * 1.26;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(
        (startX + endX) * 0.55,
        (startY + endY) * 0.62,
        endX,
        endY
      );
      ctx.lineWidth = Math.max(1.2, size * 0.16);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawBody(ctx, visual, size, palette) {
  const bounds = traceBody(ctx, visual, size);
  const gradient = ctx.createLinearGradient(
    -bounds.halfLength,
    -bounds.halfHeight,
    bounds.halfLength,
    bounds.halfHeight
  );
  gradient.addColorStop(0, color(palette, 18, -8, 0.92));
  gradient.addColorStop(0.55, color(palette, 3, 0, 0.96));
  gradient.addColorStop(1, color(palette, -11, -4, 0.96));
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = color(palette, -26, -18, 0.88);
  ctx.lineWidth = Math.max(1, size * (0.07 + visual.membrane.thickness * 0.08));
  ctx.stroke();

  traceBody(ctx, visual, size);
  ctx.strokeStyle = color(palette, 26, -20, 0.38);
  ctx.lineWidth = Math.max(0.55, size * 0.035);
  ctx.stroke();

  return bounds;
}

function drawPattern(ctx, visual, size, palette, bounds) {
  ctx.save();
  traceBody(ctx, visual, size);
  ctx.clip();
  ctx.strokeStyle = color(palette, -12, 3, visual.pattern.contrast, true);
  ctx.fillStyle = color(palette, -8, 3, visual.pattern.contrast, true);
  ctx.lineWidth = Math.max(0.7, size * 0.08);

  if (visual.pattern.type === 'bands') {
    const bandCount = 2 + Math.floor(visual.pattern.density * 5);
    for (let index = 0; index < bandCount; index++) {
      const x = -bounds.halfLength + ((index + 1) / (bandCount + 1)) * bounds.halfLength * 2;
      ctx.beginPath();
      ctx.moveTo(x, -bounds.halfHeight * 1.2);
      ctx.lineTo(x, bounds.halfHeight * 1.2);
      ctx.stroke();
    }
  } else if (visual.pattern.type === 'spots' || visual.pattern.type === 'mottled') {
    const spotCount = 3 + Math.floor(visual.pattern.density * 9);
    for (let index = 0; index < spotCount; index++) {
      const x = (seededFraction(visual.seed, index + 151) - 0.5) * bounds.halfLength * 1.55;
      const y = (seededFraction(visual.seed, index + 171) - 0.5) * bounds.halfHeight * 1.55;
      const radius = size * (
        visual.pattern.type === 'mottled'
          ? 0.08 + seededFraction(visual.seed, index + 191) * 0.17
          : 0.07
      );
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (visual.pattern.type === 'axial') {
    ctx.beginPath();
    ctx.moveTo(-bounds.halfLength, 0);
    ctx.bezierCurveTo(
      -bounds.halfLength * 0.35,
      visual.curvature * size,
      bounds.halfLength * 0.35,
      -visual.curvature * size,
      bounds.halfLength,
      0
    );
    ctx.stroke();
  } else if (visual.pattern.type === 'rings') {
    const ringCount = 2 + Math.floor(visual.pattern.density * 3);
    for (let index = 0; index < ringCount; index++) {
      const radius = size * (0.18 + index * 0.18);
      ctx.beginPath();
      ctx.ellipse(0, 0, radius, radius * 0.82, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawInternals(ctx, visual, size, palette, bounds) {
  ctx.save();
  traceBody(ctx, visual, size);
  ctx.clip();

  for (let index = 0; index < visual.internal.vacuoleCount; index++) {
    const x = (seededFraction(visual.seed, index + 211) - 0.5) * bounds.halfLength * 1.25;
    const y = (seededFraction(visual.seed, index + 231) - 0.5) * bounds.halfHeight * 1.25;
    const radius = size * (0.05 + seededFraction(visual.seed, index + 251) * 0.08);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color(palette, 24, -24, 0.34, true);
    ctx.fill();
    ctx.strokeStyle = color(palette, -14, -18, 0.34, true);
    ctx.lineWidth = Math.max(0.4, size * 0.025);
    ctx.stroke();
  }

  for (let index = 0; index < visual.internal.nucleusCount; index++) {
    const angle = visual.internal.nucleusCount === 1
      ? 0
      : (index / visual.internal.nucleusCount) * Math.PI * 2;
    const distance = visual.internal.nucleusCount === 1 ? 0 : size * 0.3;
    const nucleusRadius = size * (visual.bodyPlan === 'colonial' ? 0.12 : 0.18);
    ctx.beginPath();
    ctx.ellipse(
      Math.cos(angle) * distance,
      Math.sin(angle) * distance,
      nucleusRadius,
      nucleusRadius * 0.78,
      angle,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = color(palette, -20, 4, 0.68, true);
    ctx.fill();
    ctx.strokeStyle = color(palette, -34, -10, 0.62, true);
    ctx.lineWidth = Math.max(0.5, size * 0.04);
    ctx.stroke();
  }

  for (let index = 0; index < visual.internal.toxinSacCount; index++) {
    const angle = ((index + 0.5) / visual.internal.toxinSacCount) * Math.PI * 2;
    const distance = size * 0.42;
    ctx.beginPath();
    ctx.arc(
      Math.cos(angle) * distance,
      Math.sin(angle) * distance,
      size * 0.11,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = 'rgba(151, 104, 64, 0.66)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(94, 65, 43, 0.58)';
    ctx.lineWidth = Math.max(0.5, size * 0.03);
    ctx.stroke();
  }

  ctx.restore();
}

function drawDefense(ctx, visual, size, palette, bounds) {
  const defense = visual.defense;
  ctx.save();

  if (defense.type === 'shell') {
    traceBody(ctx, visual, size);
    ctx.strokeStyle = color(palette, -31, -30, 0.76);
    ctx.lineWidth = Math.max(1.4, size * 0.18);
    ctx.stroke();
    traceBody(ctx, visual, size);
    ctx.strokeStyle = color(palette, 18, -24, 0.5);
    ctx.lineWidth = Math.max(0.6, size * 0.045);
    ctx.stroke();
  } else if (defense.type === 'plates') {
    const plateCount = 3 + Math.floor(defense.coverage * 5);
    ctx.strokeStyle = color(palette, -24, -26, 0.68);
    ctx.fillStyle = color(palette, -10, -20, 0.2);
    ctx.lineWidth = Math.max(0.7, size * 0.05);

    for (let index = 0; index < plateCount; index++) {
      const progress = (index + 1) / (plateCount + 1);
      const x = -bounds.halfLength + progress * bounds.halfLength * 2;
      ctx.beginPath();
      ctx.ellipse(x, 0, size * 0.17, bounds.halfHeight * 0.78, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  if (defense.spineCount > 0) {
    ctx.fillStyle = color(palette, -30, -18, 0.9);
    ctx.strokeStyle = color(palette, -42, -24, 0.86);
    ctx.lineWidth = Math.max(0.5, size * 0.025);

    for (let index = 0; index < defense.spineCount; index++) {
      const angle = (index / defense.spineCount) * Math.PI * 2;
      const baseX = Math.cos(angle) * bounds.halfLength * 0.86;
      const baseY = Math.sin(angle) * bounds.halfHeight * 0.86;
      const tangentX = -Math.sin(angle) * size * 0.08;
      const tangentY = Math.cos(angle) * size * 0.08;
      const tipDistance = size * defense.spineLength;
      ctx.beginPath();
      ctx.moveTo(baseX + tangentX, baseY + tangentY);
      ctx.lineTo(
        baseX + Math.cos(angle) * tipDistance,
        baseY + Math.sin(angle) * tipDistance
      );
      ctx.lineTo(baseX - tangentX, baseY - tangentY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawSensors(ctx, visual, size, palette, bounds) {
  if (visual.sensory.count === 0) return;

  ctx.save();
  const sensorRadius = size * visual.sensory.size;

  for (let index = 0; index < visual.sensory.count; index++) {
    let x;
    let y;
    if (visual.sensory.placement === 'radial') {
      const angle = (index / visual.sensory.count) * Math.PI * 2;
      x = Math.cos(angle) * size * 0.56;
      y = Math.sin(angle) * size * 0.56;
    } else {
      const spread = visual.sensory.count === 1
        ? 0
        : (index / (visual.sensory.count - 1) - 0.5) * bounds.halfHeight * 1.12;
      x = bounds.halfLength * 0.72;
      y = spread;
    }

    ctx.beginPath();
    ctx.arc(x, y, sensorRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(235, 238, 226, 0.9)';
    ctx.fill();
    ctx.strokeStyle = color(palette, -34, -28, 0.82, true);
    ctx.lineWidth = Math.max(0.5, size * 0.04);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x + sensorRadius * 0.18, y, sensorRadius * 0.48, 0, Math.PI * 2);
    ctx.fillStyle = visual.sensory.type === 'lens'
      ? 'rgba(46, 62, 68, 0.88)'
      : color(palette, -40, -12, 0.86, true);
    ctx.fill();
  }

  ctx.restore();
}

function drawFeedingStructure(ctx, visual, size, palette, bounds) {
  const x = bounds.halfLength * 0.9;
  const aperture = size * visual.feeding.aperture;
  ctx.save();
  ctx.strokeStyle = color(palette, -38, -18, 0.86);
  ctx.fillStyle = color(palette, -34, -22, 0.7, true);
  ctx.lineWidth = Math.max(0.7, size * 0.05);

  if (visual.feeding.type === 'mandible') {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x - aperture * 0.25, side * aperture * 0.56);
      ctx.quadraticCurveTo(
        x + aperture * 0.7,
        side * aperture * 0.8,
        x + aperture,
        side * aperture * 0.16
      );
      ctx.stroke();
    }
  } else if (visual.feeding.type === 'filter') {
    for (let index = -2; index <= 2; index++) {
      ctx.beginPath();
      ctx.moveTo(x, index * aperture * 0.2);
      ctx.lineTo(x + aperture * 0.8, index * aperture * 0.32);
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.ellipse(x, 0, aperture * 0.48, aperture, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

export class VisualPhenotypeRenderer {
  static renderSilhouette(ctx, organism) {
    const visual = organism.phenotype.visual;
    const palette = visual.palette;
    const size = organism.phenotype.size;
    traceBody(ctx, visual, size);
    ctx.fillStyle = color(palette, 0, -6, 1);
    ctx.fill();
    ctx.strokeStyle = color(palette, -30, -20, 0.9);
    ctx.lineWidth = Math.max(0.8, size * 0.07);
    ctx.stroke();
  }

  static render(ctx, organism) {
    const visual = organism.phenotype.visual;
    const size = organism.phenotype.size;
    const palette = visual.palette;
    const bounds = getBounds(visual, size);

    drawLocomotion(ctx, visual, size, palette, bounds);
    const bodyBounds = drawBody(ctx, visual, size, palette);
    drawInternals(ctx, visual, size, palette, bodyBounds);
    drawPattern(ctx, visual, size, palette, bodyBounds);
    drawDefense(ctx, visual, size, palette, bodyBounds);
    drawSensors(ctx, visual, size, palette, bodyBounds);
    drawFeedingStructure(ctx, visual, size, palette, bodyBounds);
  }
}
