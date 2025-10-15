/**
 * OrganismRenderer - Renders organisms to canvas
 * Creates cell-like visual representation based on phenotype
 */
export class OrganismRenderer {
  /**
   * Render a single organism
   */
  static render(ctx, organism, isHighlighted = false, overlays = {}, options = {}) {
    if (!organism.isAlive) {
      return;
    }

    ctx.save();
    ctx.translate(organism.x, organism.y);
    ctx.rotate(organism.rotation);

  const { size, color, segments, toxicity, armor, colorPattern, metabolicRate, maxSpeed } = organism.phenotype;

    // Create color string
    const fillColor = `hsl(${color.h}, ${color.s}%, ${color.l}%)`;
    const strokeColor = `hsl(${color.h}, ${color.s}%, ${color.l - 20}%)`;

    // Secondary color for patterns
    const secondaryColor = colorPattern ?
      `hsl(${(color.h + colorPattern.secondaryHueShift) % 360}, ${color.s}%, ${color.l + 10}%)` :
      fillColor;

    // Highlight glow effect
    if (isHighlighted) {
      ctx.save();
      ctx.shadowColor = `hsl(${color.h}, 100%, 70%)`;
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // Pulsing highlight ring
      const time = Date.now() / 500;
      const pulseSize = size + 8 + Math.sin(time) * 3;
      ctx.beginPath();
      ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
      ctx.strokeStyle = `hsl(${color.h}, 100%, 70%)`;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    // Optional: metabolism glow behind body
    if (overlays.showMetabolism) {
      const t = Date.now() / 600;
      const pulse = 0.85 + Math.sin(t) * 0.15;
      const glowIntensity = Math.min(1, (metabolicRate || 1) / 2);
      const glowRadius = size * (1.4 + glowIntensity * 1.2) * pulse;
      const grad = ctx.createRadialGradient(0, 0, size * 0.5, 0, 0, glowRadius);
      grad.addColorStop(0, `rgba(255, 200, 120, ${0.18 + glowIntensity * 0.15})`);
      grad.addColorStop(1, 'rgba(255, 140, 0, 0)');
      ctx.beginPath();
      ctx.fillStyle = grad;
      ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw segments (cell-like body)
    const segmentCount = segments || 1;
    const segmentSize = size / segmentCount;

    for (let i = 0; i < segmentCount; i++) {
      const x = -size / 2 + segmentSize / 2 + i * segmentSize;
      const radius = segmentSize * 0.8;

      // Main cell body
      ctx.beginPath();
      ctx.arc(x, 0, radius, 0, Math.PI * 2);

      // Gradient for 3D effect
      const gradient = ctx.createRadialGradient(
        x - radius * 0.3, -radius * 0.3, 0,
        x, 0, radius
      );
      gradient.addColorStop(0, `hsl(${color.h}, ${color.s}%, ${Math.min(color.l + 20, 90)}%)`);
      gradient.addColorStop(1, fillColor);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Cell membrane
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = armor > 0 ? 3 : 1.5;
      ctx.stroke();

      // Nucleus
      ctx.beginPath();
      ctx.arc(x, 0, radius * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${color.h}, ${color.s + 10}%, ${color.l - 15}%)`;
      ctx.fill();

      // Apply color patterns based on mutation
      if (colorPattern && colorPattern.intensity > 0.1) {
        this.applyColorPattern(ctx, x, 0, radius, colorPattern, secondaryColor);
      }

      // Armor plating
      if (armor > 0) {
        ctx.beginPath();
        ctx.arc(x, 0, radius * 1.1, 0, Math.PI * 2);
        const armorAlpha = Math.min(1, Math.max(0.1, armor * 0.05));
        ctx.strokeStyle = `rgba(100, 100, 100, ${armorAlpha})`;
        ctx.lineWidth = 1.5 + Math.min(3, armor * 0.2);
        ctx.stroke();
      }
    }

    // Toxicity indicator (dot + glow scaled by toxicity)
    if (toxicity > 0) {
      const tox = Math.max(0, toxicity);
      const dotRadius = 2 + Math.min(6, tox * 1.5);
      // Glow ring
      ctx.save();
      ctx.globalAlpha = Math.min(0.7, 0.2 + tox * 0.15);
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth = 2 + tox * 0.8;
      ctx.beginPath();
      ctx.arc(0, 0, size + 4 + tox * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Magenta core dot at front
      ctx.beginPath();
      ctx.arc(size / 2, 0, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#ff00ff';
      ctx.fill();
    }

    // Speed trail overlay
    if (overlays.showSpeed) {
      const speed = Math.hypot(organism.vx, organism.vy);
      const speedRatio = maxSpeed ? Math.min(1, speed / maxSpeed) : Math.min(1, speed / 1.0);
      if (speedRatio > 0.05) {
        const trailLen = size * (0.8 + speedRatio * 2.2);
        const tailAlpha = 0.15 + speedRatio * 0.25;
        ctx.save();
        ctx.globalAlpha = tailAlpha;
        ctx.strokeStyle = `hsl(${color.h}, ${color.s}%, ${Math.max(10, color.l - 20)}%)`;
        ctx.lineWidth = 3;
        // Draw tail opposite to facing (rotation)
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-trailLen, 0);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Selection indicator for player
    if (organism.isPlayer) {
      ctx.beginPath();
      ctx.arc(0, 0, size + 5, 0, Math.PI * 2);
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();

    // Species label for highlighted organisms
    if (isHighlighted) {
      this.renderSpeciesLabel(ctx, organism);
    }

    // Energy bar
    if (options.showUI !== false) {
      this.renderEnergyBar(ctx, organism);
    }

    // Non-tangible overlays (drawn in world space, not rotated)
    this.renderOverlays(ctx, organism, overlays);
  }

  /**
   * Render species label above highlighted organism
   */
  static renderSpeciesLabel(ctx, organism) {
    const speciesId = organism.getSpeciesId().toString().slice(0, 6);
    const label = `Species ${speciesId}`;

    ctx.save();
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    const x = organism.x;
    const y = organism.y - organism.phenotype.size - 20;

    // Background
    const metrics = ctx.measureText(label);
    const padding = 4;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(
      x - metrics.width / 2 - padding,
      y - 12 - padding,
      metrics.width + padding * 2,
      16 + padding * 2
    );

    // Text
    ctx.fillStyle = `hsl(${organism.phenotype.color.h}, 100%, 70%)`;
    ctx.fillText(label, x, y);

    ctx.restore();
  }

  /**
   * Apply color patterns to organism segment
   */
  static applyColorPattern(ctx, x, y, radius, pattern, secondaryColor) {
    ctx.save();

    const alpha = pattern.intensity * 0.7; // Limit opacity for subtlety

    switch (pattern.type) {
      case 'spots':
        // Draw spots
        { ctx.globalAlpha = alpha;
        ctx.fillStyle = secondaryColor;
        const spotCount = Math.floor(3 + pattern.intensity * 5);
        for (let i = 0; i < spotCount; i++) {
          const angle = (i / spotCount) * Math.PI * 2;
          const spotDist = radius * 0.5;
          const spotX = x + Math.cos(angle) * spotDist;
          const spotY = y + Math.sin(angle) * spotDist;
          const spotRadius = radius * 0.15 * pattern.intensity;
          ctx.beginPath();
          ctx.arc(spotX, spotY, spotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
        break; }

      case 'stripes':
        // Draw radial stripes
        { ctx.globalAlpha = alpha;
        ctx.strokeStyle = secondaryColor;
        ctx.lineWidth = radius * 0.1;
        const stripeCount = Math.floor(2 + pattern.intensity * 4);
        for (let i = 0; i < stripeCount; i++) {
          const angle = (i / stripeCount) * Math.PI;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(
            x + Math.cos(angle) * radius * 0.8,
            y + Math.sin(angle) * radius * 0.8
          );
          ctx.stroke();
        }
        break; }

      case 'gradient':
        // Create asymmetric gradient
        { ctx.globalAlpha = alpha;
        const gradX = x + radius * 0.3 * pattern.intensity;
        const gradY = y;
        const gradient = ctx.createRadialGradient(gradX, gradY, 0, x, y, radius);
        gradient.addColorStop(0, secondaryColor);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        break; }

      case 'mottled':
        // Draw random mottled pattern
        { ctx.globalAlpha = alpha;
        ctx.fillStyle = secondaryColor;
        const mottleCount = Math.floor(5 + pattern.intensity * 10);
        for (let i = 0; i < mottleCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * radius * 0.7;
          const mottleX = x + Math.cos(angle) * dist;
          const mottleY = y + Math.sin(angle) * dist;
          const mottleRadius = radius * 0.08;
          ctx.beginPath();
          ctx.arc(mottleX, mottleY, mottleRadius, 0, Math.PI * 2);
          ctx.fill();
        }
        break; }
    }

    ctx.restore();
  }

  /**
   * Render energy bar above organism
   */
  static renderEnergyBar(ctx, organism) {
    const barWidth = organism.phenotype.size * 2;
    const barHeight = 4;
    const x = organism.x - barWidth / 2;
    const y = organism.y - organism.phenotype.size - 10;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(x, y, barWidth, barHeight);

    // Energy level
    const energyRatio = organism.energy / organism.maxEnergy;
    const energyColor = energyRatio > 0.5 ? '#4ade80' : energyRatio > 0.25 ? '#fbbf24' : '#ef4444';

    ctx.fillStyle = energyColor;
    ctx.fillRect(x, y, barWidth * energyRatio, barHeight);

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, barWidth, barHeight);
  }

  /**
   * Render a small thumbnail of an organism into a canvas (centered, scaled)
   */
  static renderThumbnail(canvas, organism) {
    const ctx = canvas.getContext('2d');
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
    const cssW = canvas.clientWidth || canvas.width;
    const cssH = canvas.clientHeight || canvas.height;
    const targetW = Math.max(1, Math.round(cssW * dpr));
    const targetH = Math.max(1, Math.round(cssH * dpr));

    // Build a stable cache key for this thumbnail frame
    const repId = organism && typeof organism.id !== 'undefined'
      ? organism.id
      : (organism && organism.getSpeciesId ? organism.getSpeciesId() : 'unknown');
    const cacheKey = `${repId}|${dpr}|${cssW}x${cssH}`;

    // If nothing relevant changed, skip re-rendering
    if (canvas.__thumbKey === cacheKey && canvas.width === targetW && canvas.height === targetH) {
      return;
    }

    // Only resize backing store if changed to avoid flicker
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    // Reset transform and clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Work in CSS pixels, scale by DPR once
    ctx.save();
    ctx.scale(dpr, dpr);
    const W = cssW;
    const H = cssH;

    // Compute scale so organism fits nicely
    const targetRadius = Math.min(W, H) * 0.35;
    const size = organism.phenotype?.size || 10;
    const scale = Math.max(0.1, targetRadius / Math.max(1, size));

    // Create a masked organism object at center with zero rotation
    const mock = Object.create(organism);
    mock.x = W / 2;
    mock.y = H / 2;
    mock.rotation = 0;
    mock.isPlayer = false;

    // Apply scale around center
    ctx.translate(W / 2, H / 2);
    ctx.scale(scale, scale);
    // Render relative to (0,0) after translate; adjust mock coords
    mock.x = 0;
    mock.y = 0;
    // Draw without UI overlays/energy bars
    this.render(ctx, mock, false, {}, { showUI: false });
    ctx.restore();

    // Update cache key
    canvas.__thumbKey = cacheKey;
  }

  /**
   * Render optional overlays for non-tangible traits
   */
  static renderOverlays(ctx, organism, overlays = {}) {
    if (!overlays || (!overlays.showSensory && !overlays.showRepro)) return;

  const { visionRange, detectionRadius } = organism.phenotype;

    // Sensory rings
    if (overlays.showSensory) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(organism.x, organism.y, detectionRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(135, 206, 250, 0.25)'; // light blue
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(organism.x, organism.y, visionRange, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(30, 144, 255, 0.2)'; // dodger blue
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Reproduction readiness ring
    if (overlays.showRepro && organism.energy >= (organism.phenotype.reproductionThreshold || Infinity)) {
      ctx.save();
      const t = Date.now() / 500;
      const pulse = 1 + Math.sin(t) * 0.1;
      const ringRadius = organism.phenotype.size + 10 * pulse;
      ctx.beginPath();
      ctx.arc(organism.x, organism.y, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(72, 187, 120, 0.9)'; // brighter green
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  /**
   * Render food particle
   */
  static renderFood(ctx, food) {
    ctx.save();

    // Glow effect
    const gradient = ctx.createRadialGradient(
      food.x, food.y, 0,
      food.x, food.y, food.radius * 2
    );
    gradient.addColorStop(0, 'rgba(144, 238, 144, 0.8)');
    gradient.addColorStop(0.5, 'rgba(144, 238, 144, 0.4)');
    gradient.addColorStop(1, 'rgba(144, 238, 144, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(food.x, food.y, food.radius * 2, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.fillStyle = '#90EE90';
    ctx.beginPath();
    ctx.arc(food.x, food.y, food.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#32CD32';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Render world background
   */
  static renderBackground(ctx, width, height) {
    // Gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#204f81ff');
    gradient.addColorStop(1, '#061629ff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Grid pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;

    const gridSize = 40;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }
}
