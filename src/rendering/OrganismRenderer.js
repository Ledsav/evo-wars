/**
 * OrganismRenderer - Renders organisms to canvas
 * Creates cell-like visual representation based on phenotype
 *
 * Structure:
 * - Main render method orchestrates all rendering
 * - Trait rendering methods handle visual representation of genetic traits
 * - Overlay/utility methods handle non-genetic visual elements (UI, highlights, etc.)
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

  const { size, color, segments, toxicity, armor, colorPattern, metabolicRate, maxSpeed, aggression, visionRange } = organism.phenotype;

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

    // ===========================
    // TRAIT-BASED RENDERING
    // ===========================

    // Metabolism glow (behind body)
    if (overlays.showMetabolism) {
      this.renderMetabolismGlow(ctx, size, metabolicRate);
    }

    // Main body segments
    this.renderBodySegments(ctx, organism, fillColor, strokeColor, secondaryColor);

    // Trait-based visual features (order matters for layering)
    this.renderArmorPlating(ctx, size, segments, armor, color);
    this.renderAggressionSpikes(ctx, size, segments, aggression, color);
    this.renderVisionSensors(ctx, size, segments, visionRange, color);
    this.renderSpeedFins(ctx, size, maxSpeed, color);
    this.renderToxicityIndicator(ctx, size, toxicity);

    // ===========================
    // OVERLAY/UTILITY RENDERING
    // ===========================

    // Speed trail overlay (optional visualization)
    if (overlays.showSpeed) {
      this.renderSpeedTrail(ctx, organism, size, maxSpeed, color);
    }

    // Player selection indicator
    if (organism.isPlayer) {
      this.renderPlayerIndicator(ctx, size);
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

  // ===========================
  // TRAIT RENDERING METHODS
  // Visual representation of genetic traits
  // ===========================

  /**
   * Render main body segments with cell-like appearance
   */
  static renderBodySegments(ctx, organism, fillColor, strokeColor, secondaryColor) {
    const { size, color, segments, armor, colorPattern } = organism.phenotype;
    const segmentCount = segments || 1;
    const segmentSize = size / segmentCount;

    for (let i = 0; i < segmentCount; i++) {
      const x = -size / 2 + segmentSize / 2 + i * segmentSize;
      const radius = segmentSize * 0.8;

      // Main cell body with 3D gradient
      ctx.beginPath();
      ctx.arc(x, 0, radius, 0, Math.PI * 2);

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
    }
  }

  /**
   * Render armor plating - heavy scales/plates for high armor
   */
  static renderArmorPlating(ctx, size, segments, armor) {
    if (armor <= 0) return;

    const segmentCount = segments || 1;
    const segmentSize = size / segmentCount;
    const armorAlpha = Math.min(0.8, Math.max(0.1, armor * 0.1));

    for (let i = 0; i < segmentCount; i++) {
      const x = -size / 2 + segmentSize / 2 + i * segmentSize;
      const radius = segmentSize * 0.8;

      // Outer armor ring
      ctx.beginPath();
      ctx.arc(x, 0, radius * 1.1, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(100, 100, 100, ${armorAlpha})`;
      ctx.lineWidth = 1.5 + Math.min(3, armor * 0.2);
      ctx.stroke();

      // Armor plates (hexagonal scales) for high armor
      if (armor > 3) {
        const plateCount = Math.min(6, Math.floor(armor / 2));
        ctx.save();
        ctx.globalAlpha = armorAlpha * 0.6;

        for (let p = 0; p < plateCount; p++) {
          const angle = (p / plateCount) * Math.PI * 2;
          const plateX = x + Math.cos(angle) * radius * 0.7;
          const plateY = Math.sin(angle) * radius * 0.7;
          const plateSize = radius * 0.25;

          // Draw hexagonal plate
          ctx.beginPath();
          for (let h = 0; h < 6; h++) {
            const hAngle = (h / 6) * Math.PI * 2;
            const hx = plateX + Math.cos(hAngle) * plateSize;
            const hy = plateY + Math.sin(hAngle) * plateSize;
            if (h === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
          }
          ctx.closePath();
          ctx.strokeStyle = `rgba(120, 120, 140, ${armorAlpha})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.fillStyle = `rgba(80, 80, 100, ${armorAlpha * 0.3})`;
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }

  /**
   * Render aggression spikes - sharp protrusions for aggressive organisms
   */
  static renderAggressionSpikes(ctx, size, segments, aggression, color) {
    if (aggression <= 0.2) return; // Only show for moderately aggressive organisms

    const segmentCount = segments || 1;
    const segmentSize = size / segmentCount;
    const spikeIntensity = (aggression - 0.2) / 0.8; // Scale from 0.2-1.0 to 0-1

    for (let i = 0; i < segmentCount; i++) {
      const x = -size / 2 + segmentSize / 2 + i * segmentSize;
      const radius = segmentSize * 0.8;

      // Number of spikes based on aggression
      const spikeCount = Math.floor(3 + spikeIntensity * 5);
      const spikeLength = radius * (0.3 + spikeIntensity * 0.5);
      const spikeWidth = radius * 0.15;

      ctx.save();
      ctx.globalAlpha = 0.7 + spikeIntensity * 0.3;

      for (let s = 0; s < spikeCount; s++) {
        const angle = (s / spikeCount) * Math.PI * 2;
        const baseX = x + Math.cos(angle) * radius;
        const baseY = Math.sin(angle) * radius;
        const tipX = x + Math.cos(angle) * (radius + spikeLength);
        const tipY = Math.sin(angle) * (radius + spikeLength);

        // Draw spike as triangle
        ctx.beginPath();
        const perpAngle = angle + Math.PI / 2;
        ctx.moveTo(
          baseX + Math.cos(perpAngle) * spikeWidth / 2,
          baseY + Math.sin(perpAngle) * spikeWidth / 2
        );
        ctx.lineTo(tipX, tipY);
        ctx.lineTo(
          baseX + Math.cos(perpAngle + Math.PI) * spikeWidth / 2,
          baseY + Math.sin(perpAngle + Math.PI) * spikeWidth / 2
        );
        ctx.closePath();

        // Color: darker shade with red tint for aggression
        const spikeColor = `hsl(${Math.max(0, color.h - 20)}, ${Math.min(100, color.s + 20)}%, ${Math.max(20, color.l - 30)}%)`;
        ctx.fillStyle = spikeColor;
        ctx.fill();
        ctx.strokeStyle = `hsl(${Math.max(0, color.h - 20)}, ${color.s}%, ${Math.max(10, color.l - 40)}%)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  /**
   * Render vision sensors - eye-like structures for high vision range
   */
  static renderVisionSensors(ctx, size, segments, visionRange) {
    // Map vision range (80-200) to sensor intensity (0-1)
    const sensorIntensity = Math.max(0, Math.min(1, (visionRange - 80) / 120));

    if (sensorIntensity < 0.2) return; // Only show for organisms with decent vision

    const segmentCount = segments || 1;

    // Render eye spots on front segment
    const frontX = size / 2 - (size / segmentCount) * 0.5;
    const eyeRadius = size * (0.15 + sensorIntensity * 0.15);
    const eyeSpacing = size * 0.3;

    ctx.save();

    // Draw two eye-like sensors
    for (let side of [-1, 1]) {
      const eyeY = side * eyeSpacing;

      // Outer sensor ring (detection field)
      ctx.beginPath();
      ctx.arc(frontX, eyeY, eyeRadius * 1.3, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(100, 200, 255, ${0.3 + sensorIntensity * 0.4})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Main eye body
      ctx.beginPath();
      ctx.arc(frontX, eyeY, eyeRadius, 0, Math.PI * 2);
      const eyeGradient = ctx.createRadialGradient(
        frontX + eyeRadius * 0.2, eyeY - eyeRadius * 0.2, 0,
        frontX, eyeY, eyeRadius
      );
      eyeGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      eyeGradient.addColorStop(0.6, `rgba(180, 220, 255, 0.8)`);
      eyeGradient.addColorStop(1, `rgba(100, 150, 200, 0.7)`);
      ctx.fillStyle = eyeGradient;
      ctx.fill();

      // Pupil/sensor core
      const pupilRadius = eyeRadius * (0.4 + sensorIntensity * 0.2);
      ctx.beginPath();
      ctx.arc(frontX + eyeRadius * 0.1, eyeY, pupilRadius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(20, 40, 80, 0.9)`;
      ctx.fill();

      // Highlight (reflection)
      ctx.beginPath();
      ctx.arc(frontX + eyeRadius * 0.3, eyeY - eyeRadius * 0.3, eyeRadius * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Render speed fins - streamlined fins for fast organisms
   */
  static renderSpeedFins(ctx, size, maxSpeed, color) {
    // Map speed (1-3) to fin size (0-1)
    const speedIntensity = Math.max(0, Math.min(1, (maxSpeed - 1) / 2));

    if (speedIntensity < 0.3) return; // Only show for reasonably fast organisms

    const finLength = size * (0.4 + speedIntensity * 0.6);
    const finWidth = size * (0.25 + speedIntensity * 0.25);

    ctx.save();
    ctx.globalAlpha = 0.6 + speedIntensity * 0.3;

    // Dorsal fin (top)
    ctx.beginPath();
    ctx.moveTo(-size * 0.3, -size * 0.5);
    ctx.lineTo(0, -size * 0.5 - finLength);
    ctx.lineTo(size * 0.3, -size * 0.5);
    ctx.closePath();
    ctx.fillStyle = `hsl(${color.h}, ${Math.max(30, color.s - 20)}%, ${Math.min(70, color.l + 10)}%)`;
    ctx.fill();
    ctx.strokeStyle = `hsl(${color.h}, ${color.s}%, ${color.l - 20}%)`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Ventral fin (bottom)
    ctx.beginPath();
    ctx.moveTo(-size * 0.3, size * 0.5);
    ctx.lineTo(0, size * 0.5 + finLength);
    ctx.lineTo(size * 0.3, size * 0.5);
    ctx.closePath();
    ctx.fillStyle = `hsl(${color.h}, ${Math.max(30, color.s - 20)}%, ${Math.min(70, color.l + 10)}%)`;
    ctx.fill();
    ctx.strokeStyle = `hsl(${color.h}, ${color.s}%, ${color.l - 20}%)`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Tail fin (rear)
    ctx.beginPath();
    ctx.moveTo(-size * 0.5, -finWidth);
    ctx.lineTo(-size * 0.5 - finLength * 0.8, 0);
    ctx.lineTo(-size * 0.5, finWidth);
    ctx.closePath();
    ctx.fillStyle = `hsl(${color.h}, ${Math.max(30, color.s - 20)}%, ${Math.min(70, color.l + 10)}%)`;
    ctx.fill();
    ctx.strokeStyle = `hsl(${color.h}, ${color.s}%, ${color.l - 20}%)`;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Render toxicity indicator - toxic glow and markings
   */
  static renderToxicityIndicator(ctx, size, toxicity) {
    if (toxicity <= 0) return;

    const tox = Math.max(0, toxicity);
    const dotRadius = 2 + Math.min(6, tox * 1.5);

    ctx.save();

    // Toxic glow ring
    ctx.globalAlpha = Math.min(0.7, 0.2 + tox * 0.15);
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 2 + tox * 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, size + 4 + tox * 3, 0, Math.PI * 2);
    ctx.stroke();

    // Magenta warning dot at front
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(size / 2, 0, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#ff00ff';
    ctx.fill();

    // Toxic pattern - small dots around body for high toxicity
    if (toxicity > 0.5) {
      const dotCount = Math.floor(4 + toxicity * 6);
      for (let i = 0; i < dotCount; i++) {
        const angle = (i / dotCount) * Math.PI * 2;
        const dotDist = size * 0.6;
        const dotX = Math.cos(angle) * dotDist;
        const dotY = Math.sin(angle) * dotDist;

        ctx.beginPath();
        ctx.arc(dotX, dotY, dotRadius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ff00ff';
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * Render metabolism glow behind body
   */
  static renderMetabolismGlow(ctx, size, metabolicRate) {
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

  // ===========================
  // OVERLAY/UTILITY METHODS
  // Non-genetic visual elements and UI
  // ===========================

  /**
   * Render speed trail overlay (optional visualization)
   * Creates a dynamic gradient trail with motion blur effect
   */
  static renderSpeedTrail(ctx, organism, size, maxSpeed, color) {
    const speed = Math.hypot(organism.vx, organism.vy);
    const speedRatio = maxSpeed ? Math.min(1, speed / maxSpeed) : Math.min(1, speed / 1.0);

    if (speedRatio < 0.05) return; // Only show when moving

    ctx.save();

    // Trail parameters based on speed
    const trailLength = size * (1.5 + speedRatio * 3);
    const trailWidth = size * (0.4 + speedRatio * 0.3);
    const baseAlpha = 0.2 + speedRatio * 0.3;

    // Create gradient trail from back to front
    const gradient = ctx.createLinearGradient(-trailLength, 0, 0, 0);
    gradient.addColorStop(0, `hsla(${color.h}, ${color.s}%, ${Math.max(10, color.l - 20)}%, 0)`);
    gradient.addColorStop(0.3, `hsla(${color.h}, ${color.s}%, ${Math.max(10, color.l - 10)}%, ${baseAlpha * 0.3})`);
    gradient.addColorStop(0.7, `hsla(${color.h}, ${color.s}%, ${color.l}%, ${baseAlpha * 0.6})`);
    gradient.addColorStop(1, `hsla(${color.h}, ${color.s}%, ${color.l + 10}%, ${baseAlpha})`);

    // Draw tapered trail shape
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-trailLength * 0.3, -trailWidth * 0.3);
    ctx.lineTo(-trailLength, -trailWidth * 0.15);
    ctx.lineTo(-trailLength, trailWidth * 0.15);
    ctx.lineTo(-trailLength * 0.3, trailWidth * 0.3);
    ctx.closePath();

    ctx.fillStyle = gradient;
    ctx.fill();

    // Add motion particles for extra speed effect
    if (speedRatio > 0.4) {
      const particleCount = Math.floor(3 + speedRatio * 4);
      const time = Date.now() / 100;

      for (let i = 0; i < particleCount; i++) {
        const particlePos = (i / particleCount) * trailLength;
        const particleOffset = ((time + i * 50) % 100) / 100;
        const x = -particlePos - particleOffset * (trailLength / particleCount);
        const y = (Math.sin(time * 0.5 + i) * trailWidth * 0.4);
        const particleSize = (1 - particlePos / trailLength) * size * 0.15;
        const particleAlpha = (1 - particlePos / trailLength) * baseAlpha * 1.5;

        ctx.globalAlpha = particleAlpha;
        ctx.beginPath();
        ctx.arc(x, y, particleSize, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${color.h}, ${Math.min(100, color.s + 20)}%, ${Math.min(90, color.l + 20)}%)`;
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * Render player selection indicator
   */
  static renderPlayerIndicator(ctx, size) {
    ctx.beginPath();
    ctx.arc(0, 0, size + 5, 0, Math.PI * 2);
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /**
   * Render species label above highlighted organism
   */
  static renderSpeciesLabel(ctx, organism) {
    const info = typeof organism.getSpeciesInfo === 'function' ? organism.getSpeciesInfo() : null;
    const label = info ? `${info.emoji} ${info.name}${info.code ? ` (${info.code})` : ''}` : `Species ${organism.getSpeciesId().toString().slice(0, 6)}`;

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

  /**
   * Render section walls/boundaries for species segregation
   */
  static renderSectionWalls(ctx, world) {
    if (!world || world.separationSections <= 1) return;

    const sections = world.separationSections;
    const cols = Math.ceil(Math.sqrt(sections));
    const rows = Math.ceil(sections / cols);

    const sectionWidth = world.width / cols;
    const sectionHeight = world.height / rows;

    ctx.save();

    // Draw vertical walls
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
    ctx.shadowBlur = 5;

    for (let i = 1; i < cols; i++) {
      const x = i * sectionWidth;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, world.height);
      ctx.stroke();

      // Draw wall segments for visual effect
      ctx.strokeStyle = 'rgba(200, 200, 255, 0.3)';
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 3;
    }

    // Draw horizontal walls
    for (let i = 1; i < rows; i++) {
      const y = i * sectionHeight;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(world.width, y);
      ctx.stroke();

      // Draw wall segments for visual effect
      ctx.strokeStyle = 'rgba(200, 200, 255, 0.3)';
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 3;
    }

    // Draw section numbers/labels
    ctx.shadowBlur = 0;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    for (let s = 0; s < sections; s++) {
      const col = s % cols;
      const row = Math.floor(s / cols);
      const x = col * sectionWidth + 10;
      const y = row * sectionHeight + 10;

      // Draw semi-transparent background for label
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(x - 2, y - 2, 80, 20);

      // Draw label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillText(`Section ${s + 1}`, x, y);
    }

    ctx.restore();
  }
}
