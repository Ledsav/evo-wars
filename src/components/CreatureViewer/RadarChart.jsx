import { useEffect, useState } from 'react';
import { OrganismRenderer } from '../../rendering/OrganismRenderer';

/**
 * RadarChart - Spider/radar chart visualization of organism traits
 */
export function RadarChart({ organism }) {
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const [hoveredTrait, setHoveredTrait] = useState(null);

  // Generate creature thumbnail for center
  useEffect(() => {
    if (!organism) return;

    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 80;

    try {
      OrganismRenderer.renderThumbnail(canvas, organism);
      const dataUrl = canvas.toDataURL('image/png');
      setThumbnailUrl(dataUrl);
    } catch (error) {
      console.error('Failed to render organism thumbnail:', error);
    }
  }, [organism]);

  if (!organism || !organism.phenotype) {
    return null;
  }

  // Define traits to display with normalization functions
  const traits = [
    {
      name: 'Size',
      key: 'size',
      normalize: (val) => Math.min(100, Math.max(0, ((val - 8) / 12) * 100)),
      color: '#4ade80'
    },
    {
      name: 'Speed',
      key: 'maxSpeed',
      normalize: (val) => Math.min(100, Math.max(0, ((val - 1) / 2) * 100)),
      color: '#60a5fa'
    },
    {
      name: 'Defense',
      key: 'armor',
      normalize: (val) => Math.min(100, Math.max(0, (val / 10) * 100)),
      color: '#a78bfa'
    },
    {
      name: 'Metabolism',
      key: 'metabolicRate',
      normalize: (val) => Math.min(100, Math.max(0, ((val - 0.5) / 1.5) * 100)),
      color: '#f472b6'
    },
    {
      name: 'Efficiency',
      key: 'energyEfficiency',
      normalize: (val) => Math.min(100, Math.max(0, ((val - 1) / 2) * 100)),
      color: '#fb923c'
    },
    {
      name: 'Vision',
      key: 'visionRange',
      normalize: (val) => Math.min(100, Math.max(0, ((val - 80) / 120) * 100)),
      color: '#34d399'
    },
    {
      name: 'Aggression',
      key: 'aggression',
      normalize: (val) => (val || 0.5) * 100,
      color: '#ef4444'
    },
    {
      name: 'Reproduction',
      key: 'reproductionThreshold',
      normalize: (val) => Math.min(100, Math.max(0, ((val - 70) / 30) * 100)),
      color: '#fbbf24'
    }
  ];

  // Calculate trait values
  const traitData = traits.map(trait => ({
    ...trait,
    rawValue: organism.phenotype[trait.key] || 0,
    value: trait.normalize(organism.phenotype[trait.key] || 0)
  }));

  // SVG dimensions and settings
  const width = 600;
  const height = 500;
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = 180;
  const levels = 5; // Number of concentric circles
  const angleStep = (Math.PI * 2) / traits.length;

  // Calculate point positions on the radar
  const getPoint = (index, value) => {
    const angle = angleStep * index - Math.PI / 2; // Start from top
    const radius = (value / 100) * maxRadius;
    return {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius
    };
  };

  // Calculate label positions (further outside the max radius)
  const getLabelPoint = (index) => {
    const angle = angleStep * index - Math.PI / 2;
    const radius = maxRadius + 50;
    return {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      angle: angle
    };
  };

  // Generate polygon path
  const polygonPoints = traitData.map((trait, i) => {
    const point = getPoint(i, trait.value);
    return `${point.x},${point.y}`;
  }).join(' ');

  return (
    <div className="radar-chart-container">
      <div className="radar-header">
        {thumbnailUrl && (
          <div className="radar-thumbnail">
            <img src={thumbnailUrl} alt="Creature" />
          </div>
        )}
        <h3 className="radar-chart-title">Trait Profile</h3>
      </div>
      <svg className="radar-chart-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Background grid circles */}
        <g className="radar-grid">
          {Array.from({ length: levels }).map((_, i) => {
            const radius = maxRadius * ((i + 1) / levels);
            return (
              <circle
                key={i}
                className="radar-grid-circle"
                cx={centerX}
                cy={centerY}
                r={radius}
                fill="none"
                stroke="rgba(71, 85, 105, 0.2)"
                strokeWidth="1"
              />
            );
          })}
        </g>

        {/* Axis lines */}
        <g className="radar-axes">
          {traitData.map((trait, i) => {
            const endPoint = getPoint(i, 100);
            return (
              <line
                key={i}
                className="radar-axis-line"
                x1={centerX}
                y1={centerY}
                x2={endPoint.x}
                y2={endPoint.y}
                stroke="rgba(71, 85, 105, 0.3)"
                strokeWidth="1"
              />
            );
          })}
        </g>

        {/* Data polygon */}
        <g className="radar-data">
          <polygon
            className="radar-polygon"
            points={polygonPoints}
            fill="rgba(139, 92, 246, 0.2)"
            stroke="rgba(139, 92, 246, 0.8)"
            strokeWidth="2"
          />
        </g>

        {/* Data points */}
        <g className="radar-points">
          {traitData.map((trait, i) => {
            const point = getPoint(i, trait.value);
            const isHovered = hoveredTrait === i;
            return (
              <circle
                key={i}
                className="radar-point"
                cx={point.x}
                cy={point.y}
                r={isHovered ? 7 : 5}
                fill={trait.color}
                stroke="rgba(255, 255, 255, 0.8)"
                strokeWidth="2"
                style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                onMouseEnter={() => setHoveredTrait(i)}
                onMouseLeave={() => setHoveredTrait(null)}
              />
            );
          })}
        </g>

        {/* Axis labels */}
        <g className="radar-labels">
          {traitData.map((trait, i) => {
            const labelPos = getLabelPoint(i);
            const isHovered = hoveredTrait === i;

            // Calculate text anchor and positioning based on angle
            let textAnchor = 'middle';
            let dx = 0;
            let dy = 0;

            const normalizedAngle = ((labelPos.angle + Math.PI * 2) % (Math.PI * 2));

            if (normalizedAngle < Math.PI / 4 || normalizedAngle > 7 * Math.PI / 4) {
              // Right side
              textAnchor = 'start';
              dx = 5;
            } else if (normalizedAngle > 3 * Math.PI / 4 && normalizedAngle < 5 * Math.PI / 4) {
              // Left side
              textAnchor = 'end';
              dx = -5;
            } else if (normalizedAngle >= Math.PI / 4 && normalizedAngle <= 3 * Math.PI / 4) {
              // Bottom
              textAnchor = 'middle';
              dy = 15;
            } else {
              // Top
              textAnchor = 'middle';
              dy = -8;
            }

            const textWidth = trait.name.length * 7 + 10;
            let rectX = labelPos.x + dx - (textAnchor === 'middle' ? textWidth/2 : textAnchor === 'start' ? 0 : textWidth);
            let rectY = labelPos.y + dy - 10;

            return (
              <g key={i}>
                <rect
                  x={rectX}
                  y={rectY}
                  width={textWidth}
                  height="20"
                  fill={isHovered ? 'rgba(139, 92, 246, 0.3)' : 'rgba(15, 23, 42, 0.9)'}
                  stroke={isHovered ? 'rgba(139, 92, 246, 0.6)' : 'rgba(71, 85, 105, 0.4)'}
                  strokeWidth="1.5"
                  rx="5"
                  style={{ transition: 'all 0.2s ease' }}
                />
                <text
                  className="radar-label"
                  x={labelPos.x + dx}
                  y={labelPos.y + dy + 4}
                  textAnchor={textAnchor}
                  fill={isHovered ? '#a78bfa' : '#e2e8f0'}
                  fontSize="13"
                  fontWeight="600"
                  style={{ pointerEvents: 'none', transition: 'all 0.2s ease' }}
                >
                  {trait.name}
                </text>
              </g>
            );
          })}
        </g>

      </svg>

      {/* Trait values display on hover */}
      {hoveredTrait !== null && (
        <div className="radar-tooltip">
          <div className="radar-tooltip-name">{traitData[hoveredTrait].name}</div>
          <div className="radar-tooltip-value">
            Value: {traitData[hoveredTrait].rawValue.toFixed(2)}
          </div>
          <div className="radar-tooltip-percent">
            {traitData[hoveredTrait].value.toFixed(0)}%
          </div>
        </div>
      )}
    </div>
  );
}
