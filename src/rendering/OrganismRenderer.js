/**
 * OrganismRenderer - Renders organisms to canvas
 * Creates cell-like visual representation based on phenotype
 */
export class OrganismRenderer {
  /**
   * Render a single organism
   */
  static render(ctx, organism) {
    if (!organism.isAlive) {
      return;
    }

    ctx.save();
    ctx.translate(organism.x, organism.y);
    ctx.rotate(organism.rotation);

    const { size, color, segments, toxicity, armor } = organism.phenotype;

    // Create color string
    const fillColor = `hsl(${color.h}, ${color.s}%, ${color.l}%)`;
    const strokeColor = `hsl(${color.h}, ${color.s}%, ${color.l - 20}%)`;

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

      // Armor plating
      if (armor > 0) {
        ctx.beginPath();
        ctx.arc(x, 0, radius * 1.1, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(100, 100, 100, ${armor * 0.3})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Toxicity indicator
    if (toxicity > 0) {
      ctx.beginPath();
      ctx.arc(size / 2, 0, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ff00ff';
      ctx.fill();
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

    // Energy bar
    this.renderEnergyBar(ctx, organism);
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
    gradient.addColorStop(0, '#0a1929');
    gradient.addColorStop(1, '#1e3a5f');
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
