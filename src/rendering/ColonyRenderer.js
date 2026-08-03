function getColonyColor(colony, alpha) {
  const color = colony.members[0]?.phenotype?.color || { h: 170, s: 45, l: 48 };
  return `hsla(${color.h}, ${Math.min(62, color.s)}%, ${color.l}%, ${alpha})`;
}

function traceHull(ctx, hull) {
  if (hull.length < 3) return false;

  ctx.beginPath();
  ctx.moveTo(hull[0].x, hull[0].y);
  for (let index = 1; index < hull.length; index++) {
    ctx.lineTo(hull[index].x, hull[index].y);
  }
  ctx.closePath();
  return true;
}

export class ColonyRenderer {
  static shouldRenderAsAggregate(colony, options = {}) {
    if (!colony || colony.members.length < 3 || colony.hull.length < 3) {
      return false;
    }

    const scale = options.scale || 1;
    const lodBias = options.lodBias || 1;
    const population = options.population || 0;
    const averageSize = colony.members.reduce(
      (total, member) => total + member.phenotype.size,
      0
    ) / colony.members.length;
    const apparentCellSize = averageSize * scale / lodBias;

    return (
      apparentCellSize < 13 ||
      (population >= 300 && scale < 1.35) ||
      (colony.members.length >= 8 && scale < 1.75)
    );
  }

  static renderBond(ctx, bond, options = {}) {
    const scale = options.scale || 1;
    const first = bond.first;
    const second = bond.second;
    const width = Math.max(0.8 / scale, (0.7 + bond.strength * 1.5) / scale);
    const maturity = bond.maturity ?? 1;
    const strainRatio = Math.min(
      1,
      bond.strain / Math.max(0.01, bond.ruptureTolerance)
    );

    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = strainRatio > 0.2
      ? `rgba(165, 74, 63, ${0.2 + strainRatio * 0.28})`
      : 'rgba(63, 104, 98, 0.24)';
    ctx.lineWidth = width * 3.2;
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    ctx.lineTo(second.x, second.y);
    ctx.stroke();

    ctx.strokeStyle = strainRatio > 0.2
      ? `rgba(165, 74, 63, ${0.7 + strainRatio * 0.25})`
      : `rgba(63, 104, 98, ${0.4 + maturity * 0.42})`;
    ctx.lineWidth = width;
    if (maturity < 0.9) {
      ctx.setLineDash([Math.max(1.5 / scale, 3 / scale), 2 / scale]);
    }
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    ctx.lineTo(second.x, second.y);
    ctx.stroke();
    ctx.setLineDash([]);

    if (
      bond.lastTransfer > 0 &&
      (options.worldTime || 0) - bond.lastTransfer < 700
    ) {
      const phase = (
        ((options.worldTime || 0) + bond.first.id * 83) % 700
      ) / 700;
      const progress = bond.lastDonorId === bond.second.id ? 1 - phase : phase;
      const x = first.x + (second.x - first.x) * progress;
      const y = first.y + (second.y - first.y) * progress;
      ctx.fillStyle = 'rgba(183, 122, 43, 0.92)';
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.2 / scale, width * 1.4), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  static renderAggregate(ctx, colony, isHighlighted = false, options = {}) {
    if (!traceHull(ctx, colony.hull)) return;

    const scale = options.scale || 1;
    ctx.save();
    ctx.fillStyle = getColonyColor(colony, 0.34);
    ctx.strokeStyle = getColonyColor(colony, 0.92);
    ctx.lineWidth = Math.max(1.2 / scale, 2 / scale);
    ctx.fill();
    ctx.stroke();

    if (traceHull(ctx, colony.hull)) {
      ctx.strokeStyle = 'rgba(255, 254, 250, 0.72)';
      ctx.lineWidth = Math.max(0.7 / scale, 1 / scale);
      ctx.setLineDash([4 / scale, 4 / scale]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = getColonyColor(colony, 0.22);
    for (const member of colony.members) {
      ctx.beginPath();
      ctx.arc(
        member.x,
        member.y,
        Math.max(1.8 / scale, member.phenotype.size * 0.2),
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    if (isHighlighted) {
      ctx.beginPath();
      ctx.arc(
        colony.centerX,
        colony.centerY,
        colony.radius + 7 / scale,
        0,
        Math.PI * 2
      );
      ctx.strokeStyle = 'rgba(63, 104, 98, 0.95)';
      ctx.lineWidth = 1.5 / scale;
      ctx.setLineDash([5 / scale, 4 / scale]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (
      options.showUI !== false &&
      colony.radius * scale >= 30
    ) {
      const label = `${colony.members.length} cells`;
      ctx.font = `${Math.max(9 / scale, 10 / scale)}px "IBM Plex Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(32, 38, 36, 0.82)';
      ctx.fillText(label, colony.centerX, colony.centerY);
    }

    ctx.restore();
  }
}
