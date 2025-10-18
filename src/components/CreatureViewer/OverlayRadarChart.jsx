import { useRef, useState } from 'react';
import { useNotifications } from '../../context/useNotifications';
import { downloadSvgAsPng, timestampFilename } from '../../utils/screenshot';
import { ScreenShotIcon } from '../shared/Icons/Icons';

/**
 * OverlayRadarChart - Overlaid radar chart showing multiple organisms on one chart
 */
export function OverlayRadarChart({ organisms }) {
  const [hoveredTrait, setHoveredTrait] = useState(null);
  const [hoveredOrganism, setHoveredOrganism] = useState(null);
  const svgRef = useRef(null);
  const { notify } = useNotifications();

  if (!organisms || organisms.length === 0) return null;

  // Define traits to display with normalization functions
  const traits = [
    {
      name: 'Size',
      key: 'size',
      normalize: (val) => Math.min(100, Math.max(0, ((val - 8) / 12) * 100)),
    },
    {
      name: 'Speed',
      key: 'maxSpeed',
      normalize: (val) => Math.min(100, Math.max(0, ((val - 1) / 2) * 100)),
    },
    {
      name: 'Defense',
      key: 'armor',
      normalize: (val) => Math.min(100, Math.max(0, (val / 10) * 100)),
    },
    {
      name: 'Metabolism',
      key: 'metabolicRate',
      normalize: (val) => Math.min(100, Math.max(0, ((val - 0.5) / 1.5) * 100)),
    },
    {
      name: 'Efficiency',
      key: 'energyEfficiency',
      normalize: (val) => Math.min(100, Math.max(0, ((val - 1) / 2) * 100)),
    },
    {
      name: 'Vision',
      key: 'visionRange',
      normalize: (val) => Math.min(100, Math.max(0, ((val - 80) / 120) * 100)),
    },
    {
      name: 'Aggression',
      key: 'aggression',
      normalize: (val) => (val || 0.5) * 100,
    },
    {
      name: 'Reproduction',
      key: 'reproductionThreshold',
      normalize: (val) => Math.min(100, Math.max(0, ((val - 70) / 30) * 100)),
    }
  ];

  // Colors for each organism
  const colors = [
    '#4ade80', '#60a5fa', '#a78bfa', '#f472b6',
    '#fb923c', '#34d399', '#ef4444', '#fbbf24'
  ];

  // Calculate trait values for all organisms
  const organismsData = organisms.map((organism, index) => ({
    organism,
    color: colors[index % colors.length],
    traitData: traits.map(trait => ({
      ...trait,
      rawValue: organism.phenotype[trait.key] || 0,
      value: trait.normalize(organism.phenotype[trait.key] || 0)
    }))
  }));

  // SVG dimensions and settings
  const width = 600;
  const height = 600;
  const viewBoxFactor = 1.2;
  const centerX = (width) / 2;
  const centerY = (height * viewBoxFactor) / 2;
  const maxRadius = 220;
  const levels = 5;
  const angleStep = (Math.PI * 2) / traits.length;

  // Calculate point positions on the radar
  const getPoint = (index, value) => {
    const angle = angleStep * index - Math.PI / 2;
    const radius = (value / 100) * maxRadius;
    return {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius
    };
  };

  // Calculate label positions
  const getLabelPoint = (index) => {
    const angle = angleStep * index - Math.PI / 2;
    const radius = maxRadius + 60;
    return {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      angle: angle
    };
  };

  return (
    <div className="overlay-radar-chart-container">
      <button
        className="floating-action camera"
        title="Save comparison radar screenshot"
        onClick={() => {
          if (svgRef.current) {
            const fname = timestampFilename('radar-overlay');
            downloadSvgAsPng(svgRef.current, fname, '#0a1929', (filename) => {
              notify('screenshot', `📸 Comparison chart saved: ${filename}`, { timeout: 3000 });
            });
          }
        }}
      >
        <ScreenShotIcon size={18} />
      </button>
      <svg ref={svgRef} className="overlay-radar-chart-svg" width={width} height={height} viewBox={`0 0 ${width} ${height * viewBoxFactor}`}>
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
                strokeWidth="1.5"
              />
            );
          })}
        </g>

        {/* Axis lines */}
        <g className="radar-axes">
          {traits.map((trait, i) => {
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
                strokeWidth="1.5"
              />
            );
          })}
        </g>

        {/* Data polygons for each organism */}
        <g className="radar-data-overlays">
          {organismsData.map((orgData, orgIndex) => {
            const polygonPoints = orgData.traitData.map((trait, i) => {
              const point = getPoint(i, trait.value);
              return `${point.x},${point.y}`;
            }).join(' ');

            const isHovered = hoveredOrganism === orgIndex;
            const opacity = hoveredOrganism === null || isHovered ? 1 : 0.3;

            return (
              <g key={orgIndex}>
                <polygon
                  className="overlay-radar-polygon"
                  points={polygonPoints}
                  fill={orgData.color}
                  fillOpacity={isHovered ? 0.3 : 0.15}
                  stroke={orgData.color}
                  strokeWidth={isHovered ? 3 : 2}
                  style={{
                    opacity,
                    transition: 'all 0.3s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={() => setHoveredOrganism(orgIndex)}
                  onMouseLeave={() => setHoveredOrganism(null)}
                />
              </g>
            );
          })}
        </g>

        {/* Data points for each organism */}
        <g className="radar-points-overlays">
          {organismsData.map((orgData, orgIndex) => {
            const isOrgHovered = hoveredOrganism === orgIndex;
            const opacity = hoveredOrganism === null || isOrgHovered ? 1 : 0.4;

            return orgData.traitData.map((trait, traitIndex) => {
              const point = getPoint(traitIndex, trait.value);
              return (
                <circle
                  key={`${orgIndex}-${traitIndex}`}
                  className="overlay-radar-point"
                  cx={point.x}
                  cy={point.y}
                  r={isOrgHovered ? 6 : 4}
                  fill={orgData.color}
                  stroke="rgba(255, 255, 255, 0.9)"
                  strokeWidth="2"
                  style={{
                    opacity,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={() => {
                    setHoveredOrganism(orgIndex);
                    setHoveredTrait(traitIndex);
                  }}
                  onMouseLeave={() => {
                    setHoveredOrganism(null);
                    setHoveredTrait(null);
                  }}
                />
              );
            });
          })}
        </g>

        {/* Axis labels */}
        <g className="radar-labels">
          {traits.map((trait, i) => {
            const labelPos = getLabelPoint(i);
            const isHovered = hoveredTrait === i;

            let textAnchor = 'middle';
            let dx = 0;
            let dy = 0;

            const normalizedAngle = ((labelPos.angle + Math.PI * 2) % (Math.PI * 2));

            if (normalizedAngle < Math.PI / 4 || normalizedAngle > 7 * Math.PI / 4) {
              textAnchor = 'start';
              dx = 5;
            } else if (normalizedAngle > 3 * Math.PI / 4 && normalizedAngle < 5 * Math.PI / 4) {
              textAnchor = 'end';
              dx = -5;
            } else if (normalizedAngle >= Math.PI / 4 && normalizedAngle <= 3 * Math.PI / 4) {
              textAnchor = 'middle';
              dy = 15;
            } else {
              textAnchor = 'middle';
              dy = -8;
            }

            const textWidth = trait.name.length * 8 + 12;
            let rectX = labelPos.x + dx - (textAnchor === 'middle' ? textWidth/2 : textAnchor === 'start' ? 0 : textWidth);
            let rectY = labelPos.y + dy - 12;

            return (
              <g key={i}>
                <rect
                  x={rectX}
                  y={rectY}
                  width={textWidth}
                  height="24"
                  fill={isHovered ? 'rgba(34, 197, 94, 0.3)' : 'rgba(15, 23, 42, 0.9)'}
                  stroke={isHovered ? 'rgba(34, 197, 94, 0.6)' : 'rgba(71, 85, 105, 0.4)'}
                  strokeWidth="1.5"
                  rx="6"
                  style={{ transition: 'all 0.2s ease' }}
                />
                <text
                  className="radar-label"
                  x={labelPos.x + dx}
                  y={labelPos.y + dy + 5}
                  textAnchor={textAnchor}
                  fill={isHovered ? '#4ade80' : '#e2e8f0'}
                  fontSize="14"
                  fontWeight="700"
                  style={{ pointerEvents: 'none', transition: 'all 0.2s ease' }}
                >
                  {trait.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Tooltip on hover */}
      {hoveredOrganism !== null && hoveredTrait !== null && (
        <div className="overlay-radar-tooltip">
          <div className="tooltip-organism" style={{ color: organismsData[hoveredOrganism].color }}>
            Species {organismsData[hoveredOrganism].organism.getSpeciesId().toString().slice(0, 8)}
          </div>
          <div className="tooltip-trait">{traits[hoveredTrait].name}</div>
          <div className="tooltip-value">
            {organismsData[hoveredOrganism].traitData[hoveredTrait].rawValue.toFixed(2)}
          </div>
          <div className="tooltip-percent">
            {organismsData[hoveredOrganism].traitData[hoveredTrait].value.toFixed(0)}%
          </div>
        </div>
      )}
    </div>
  );
}
