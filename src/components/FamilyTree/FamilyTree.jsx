import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { OrganismRenderer } from '../../rendering/OrganismRenderer';
import './FamilyTree.css';

/**
 * FamilyTreeCanvas - Reusable canvas component for rendering the tree
 */
function FamilyTreeCanvas({ genealogyTracker, width, height, onHoverChange, isMaximized = false }) {
  const canvasRef = useRef(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const nodePositions = useRef(new Map()); // Cache node positions for hover detection

  // Render the tree
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Get tree layout
    const layout = genealogyTracker.getTreeLayout();
    if (layout.length === 0) {
      // Show message if no species yet
      ctx.fillStyle = '#888888';
      ctx.font = '14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('No species data yet. The tree will appear as organisms evolve.', width / 2, height / 2);
      return;
    }

    // Calculate layout parameters - smaller in normal view, larger in maximized
    const nodeRadius = isMaximized ? 30 : 20;
    const verticalSpacing = isMaximized ? 120 : 80;
    const extinctNodeRadius = nodeRadius * 0.6; // Extinct nodes are 60% size
    const levelHeight = verticalSpacing;
    const topPadding = isMaximized ? 60 : 40;
    const bottomPadding = isMaximized ? 60 : 40;

    // Calculate required canvas height based on tree depth
    const requiredHeight = topPadding + (layout.length * levelHeight) + bottomPadding;

    // If canvas is too small, we need to expand it (this will trigger scrolling)
    if (height < requiredHeight) {
      // We'll handle this by making sure the canvas container allows scrolling
      // The canvas will be drawn at the provided height, but content may extend beyond
    }

    // Clear node positions for hover detection
    nodePositions.current.clear();

    // Calculate positions for each level
    const levelPositions = layout.map((level, depth) => {
      const y = topPadding + depth * levelHeight;
      const maxSpacing = isMaximized ? 150 : 100;
      const horizontalSpacing = Math.min(width / (level.length + 1), maxSpacing);
      const totalWidth = horizontalSpacing * (level.length + 1);
      const startX = (width - totalWidth) / 2 + horizontalSpacing;

      return level.map((node, index) => ({
        node,
        x: startX + index * horizontalSpacing,
        y,
      }));
    });

    // Draw connections first (behind nodes)
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 2;

    for (let depth = 0; depth < levelPositions.length - 1; depth++) {
      const currentLevel = levelPositions[depth];
      const nextLevel = levelPositions[depth + 1];

      for (const parent of currentLevel) {
        for (const child of nextLevel) {
          if (child.node.parentId === parent.node.id) {
            // Draw line from parent to child
            ctx.beginPath();
            ctx.moveTo(parent.x, parent.y + nodeRadius);
            ctx.lineTo(child.x, child.y - nodeRadius);
            ctx.stroke();
          }
        }
      }
    }

    // Draw nodes
    let hoveredNodeData = null; // Store hovered node data for later rendering

    for (const level of levelPositions) {
      for (const { node, x, y } of level) {
        // Use smaller radius for extinct nodes
        const currentNodeRadius = node.extinct ? extinctNodeRadius : nodeRadius;

        // Store position for hover detection
        nodePositions.current.set(node.id, { x, y, radius: currentNodeRadius });

        // Determine if this node is hovered
        const isHovered = hoveredNode === node.id;

        // Store hovered node for later rendering (after all nodes)
        if (isHovered) {
          hoveredNodeData = { node, x, y };
        }

        // Node background circle
        ctx.beginPath();
        ctx.arc(x, y, currentNodeRadius, 0, Math.PI * 2);

        // Color based on status - more faded for extinct
        if (node.extinct) {
          ctx.fillStyle = '#2a2a2a';
          ctx.strokeStyle = '#555555';
        } else {
          ctx.fillStyle = '#2a2a2a';
          ctx.strokeStyle = `hsl(${node.color.h}, ${node.color.s}%, ${node.color.l}%)`;
        }

        ctx.fill();
        ctx.lineWidth = isHovered ? (node.extinct ? 2 : 4) : (node.extinct ? 1 : 2);
        ctx.stroke();

        // Render organism thumbnail inside circle (skip for extinct to save space)
        if (node.representative && !node.extinct) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(x, y, currentNodeRadius - 4, 0, Math.PI * 2);
          ctx.clip();

          // Create a mock organism for rendering
          const mock = {
            ...node.representative,
            x,
            y,
            rotation: 0,
            isPlayer: false,
          };

          // Scale organism to fit in circle
          const scale = (currentNodeRadius - 8) / (node.phenotype?.size || 10);
          ctx.translate(x, y);
          ctx.scale(scale, scale);

          const mockScaled = {
            ...mock,
            x: 0,
            y: 0,
          };

          OrganismRenderer.render(ctx, mockScaled, false, {}, { showUI: false });
          ctx.restore();
        } else if (node.extinct && !node.isExtinctGroup) {
          // Draw simple X for single extinct species
          ctx.save();
          ctx.strokeStyle = '#666666';
          ctx.lineWidth = 2;
          const crossSize = currentNodeRadius * 0.5;
          ctx.beginPath();
          ctx.moveTo(x - crossSize, y - crossSize);
          ctx.lineTo(x + crossSize, y + crossSize);
          ctx.moveTo(x + crossSize, y - crossSize);
          ctx.lineTo(x - crossSize, y + crossSize);
          ctx.stroke();
          ctx.restore();
        } else if (node.isExtinctGroup) {
          // Draw skull icon for extinct group
          ctx.save();
          ctx.fillStyle = '#666666';
          ctx.font = `${currentNodeRadius * 1.2}px system-ui`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('💀', x, y);
          ctx.restore();
        }

        // Population badge (only for alive species)
        if (!node.extinct) {
          const badgeText = node.currentPopulation.toString();
          const badgeFontSize = isMaximized ? 11 : 9;
          ctx.font = `bold ${badgeFontSize}px system-ui`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // Badge background
          const badgeRadius = isMaximized ? 12 : 10;
          const badgeX = x + currentNodeRadius - (isMaximized ? 8 : 6);
          const badgeY = y - currentNodeRadius + (isMaximized ? 8 : 6);

          ctx.beginPath();
          ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
          ctx.fillStyle = '#4CAF50';
          ctx.fill();

          // Badge text
          ctx.fillStyle = '#ffffff';
          ctx.fillText(badgeText, badgeX, badgeY);
        }

        // Species label below node
        let labelText;
        if (node.isExtinctGroup) {
          labelText = `${node.extinctCount} extinct`;
        } else {
          labelText = `${node.id.toString().slice(0, node.extinct ? 4 : 6)}`;
        }

        const labelFontSize = node.extinct ? (isMaximized ? 9 : 7) : (isMaximized ? 11 : 9);
        ctx.font = `${labelFontSize}px system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = node.extinct ? '#555555' : '#cccccc';
        ctx.fillText(labelText, x, y + currentNodeRadius + 3);

        // Extinct indicator - only for single extinct species (not groups)
        if (node.extinct && !node.isExtinctGroup) {
          const extinctFontSize = isMaximized ? 9 : 7;
          ctx.font = `${extinctFontSize}px system-ui`;
          ctx.fillStyle = '#777777';
          ctx.fillText('✝', x, y + currentNodeRadius + (isMaximized ? 14 : 11));
        }
      }
    }

    // Draw tooltip last (above all nodes)
    if (hoveredNodeData) {
      drawHoverInfo(ctx, hoveredNodeData.node, hoveredNodeData.x, hoveredNodeData.y, nodeRadius, width, height);
    }
  }, [genealogyTracker, width, height, hoveredNode, isMaximized]);

  // Notify parent of hover changes
  useEffect(() => {
    if (onHoverChange) {
      onHoverChange(hoveredNode);
    }
  }, [hoveredNode, onHoverChange]);

  // Handle mouse move for hover detection
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Check if mouse is over any node
    let foundNode = null;
    for (const [nodeId, pos] of nodePositions.current) {
      const dx = mouseX - pos.x;
      const dy = mouseY - pos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= pos.radius) {
        foundNode = nodeId;
        break;
      }
    }

    setHoveredNode(foundNode);
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoveredNode(null)}
    />
  );
}

/**
 * FamilyTreePopup - Fullscreen maximized view (using portal)
 */
function FamilyTreePopup({ genealogyTracker, onClose }) {
  const [canvasSize, setCanvasSize] = useState({
    width: Math.max(800, window.innerWidth - 120),
    height: Math.max(500, window.innerHeight - 320)
  });

  useEffect(() => {
    const handleResize = () => {
      // Calculate required height based on tree depth for maximized view
      const layout = genealogyTracker.getTreeLayout();
      const verticalSpacing = 120; // Match maximized view spacing
      const topPadding = 60;
      const bottomPadding = 60;
      const minHeight = 500;

      // Allow canvas to grow taller than container to enable scrolling
      const requiredHeight = Math.max(
        minHeight,
        topPadding + (layout.length * verticalSpacing) + bottomPadding
      );

      setCanvasSize({
        width: Math.max(800, window.innerWidth - 120),
        height: requiredHeight,
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Update when tree changes
    const interval = setInterval(handleResize, 1000);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(interval);
    };
  }, []); // Empty dependency array - the effect captures genealogyTracker

  const stats = genealogyTracker.getStats();

  return createPortal(
    <div className="family-tree-popup-overlay" onClick={onClose}>
      <div className="family-tree-popup" onClick={(e) => e.stopPropagation()}>
        <div className="popup-header">
          <h2>Species Genealogy - Maximized View</h2>
          <button className="close-button" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        {/* Statistics */}
        <div className="genealogy-stats">
          <div className="stat-item">
            <span className="stat-label">Total Species:</span>
            <span className="stat-value">{stats.totalSpecies}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Alive:</span>
            <span className="stat-value alive">{stats.aliveSpecies}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Extinct:</span>
            <span className="stat-value extinct">{stats.extinctSpecies}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Tree Depth:</span>
            <span className="stat-value">{stats.maxDepth}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="tree-legend">
          <div className="legend-item">
            <div className="legend-icon alive-node"></div>
            <span>Alive Species</span>
          </div>
          <div className="legend-item">
            <div className="legend-icon extinct-node"></div>
            <span>Extinct Species ✝</span>
          </div>
          <div className="legend-item">
            <div className="legend-badge">42</div>
            <span>Current Population</span>
          </div>
        </div>

        {/* Tree Canvas */}
        <div className="tree-container-popup">
          <FamilyTreeCanvas
            genealogyTracker={genealogyTracker}
            width={canvasSize.width}
            height={canvasSize.height}
            isMaximized={true}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * FamilyTree - Main component with maximize button
 */
export function FamilyTree({ genealogyTracker }) {
  const containerRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 500, height: 600 });
  const [isMaximized, setIsMaximized] = useState(false);

  // Update canvas size when container resizes OR tree depth changes
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth } = containerRef.current;

        // Calculate required height based on tree depth
        const layout = genealogyTracker.getTreeLayout();
        const verticalSpacing = 80; // Match normal view spacing
        const topPadding = 40;
        const bottomPadding = 40;
        const minHeight = 600;
        const requiredHeight = Math.max(
          minHeight,
          topPadding + (layout.length * verticalSpacing) + bottomPadding
        );

        setCanvasSize({
          width: clientWidth || 500,
          height: requiredHeight,
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    // Also update when tree changes
    const interval = setInterval(updateSize, 1000); // Check every second

    return () => {
      window.removeEventListener('resize', updateSize);
      clearInterval(interval);
    };
  }, []); // Empty dependency array - the effect captures genealogyTracker

  const stats = genealogyTracker.getStats();

  return (
    <>
      <div className="family-tree">
        <div className="family-tree-header">
          <h2>Species Genealogy</h2>
          <button
            className="maximize-button"
            onClick={() => setIsMaximized(true)}
            title="Maximize view"
          >
            ⛶
          </button>
        </div>

        {/* Statistics */}
        <div className="genealogy-stats">
        <div className="stat-item">
          <span className="stat-label">Total Species:</span>
          <span className="stat-value">{stats.totalSpecies}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Alive:</span>
          <span className="stat-value alive">{stats.aliveSpecies}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Extinct:</span>
          <span className="stat-value extinct">{stats.extinctSpecies}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Tree Depth:</span>
          <span className="stat-value">{stats.maxDepth}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="tree-legend">
        <div className="legend-item">
          <div className="legend-icon alive-node"></div>
          <span>Alive Species</span>
        </div>
        <div className="legend-item">
          <div className="legend-icon extinct-node"></div>
          <span>Extinct Species ✝</span>
        </div>
        <div className="legend-item">
          <div className="legend-badge">42</div>
          <span>Current Population</span>
        </div>
      </div>

        {/* Tree Canvas */}
        <div className="tree-container" ref={containerRef}>
          <FamilyTreeCanvas
            genealogyTracker={genealogyTracker}
            width={canvasSize.width}
            height={canvasSize.height}
            isMaximized={false}
          />
        </div>
      </div>

      {/* Maximized popup */}
      {isMaximized && (
        <FamilyTreePopup
          genealogyTracker={genealogyTracker}
          onClose={() => setIsMaximized(false)}
        />
      )}
    </>
  );
}

/**
 * Draw hover information tooltip
 */
function drawHoverInfo(ctx, node, x, y, nodeRadius, canvasWidth, canvasHeight) {
  const padding = 10;
  const lineHeight = 16;
  const tooltipWidth = 200;

  // Build info text
  let info;

  if (node.isExtinctGroup) {
    // Tooltip for grouped extinct species
    info = [
      `Extinct Species Group`,
      `Count: ${node.extinctCount} species`,
      `Total Max Pop: ${node.maxPopulation}`,
      `Generation: ${node.id.split('-')[2]}`,
    ];
    const timeAlive = ((node.extinctTime - node.firstSeen) / 1000).toFixed(0);
    info.push(`Lasted: ${timeAlive}s`);
  } else {
    // Tooltip for single species
    info = [
      `Species: ${node.id.toString().slice(0, 8)}`,
      `Population: ${node.currentPopulation}`,
      `Max Pop: ${node.maxPopulation}`,
      `Status: ${node.extinct ? 'Extinct' : 'Alive'}`,
    ];

    if (node.extinct && node.extinctTime) {
      const timeAlive = ((node.extinctTime - node.firstSeen) / 1000).toFixed(0);
      info.push(`Survived: ${timeAlive}s`);
    }
  }

  const tooltipHeight = padding * 2 + info.length * lineHeight;

  // Position tooltip (avoid edges)
  let tooltipX = x + nodeRadius + 15;
  let tooltipY = y - tooltipHeight / 2;

  if (tooltipX + tooltipWidth > canvasWidth - 10) {
    tooltipX = x - nodeRadius - tooltipWidth - 15;
  }

  tooltipY = Math.max(10, Math.min(tooltipY, canvasHeight - tooltipHeight - 10));

  // Draw tooltip background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
  ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);

  // Draw tooltip border
  ctx.strokeStyle = node.extinct ? '#666666' : `hsl(${node.color.h}, ${node.color.s}%, ${node.color.l}%)`;
  ctx.lineWidth = 2;
  ctx.strokeRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);

  // Draw text
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px system-ui';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  info.forEach((line, i) => {
    ctx.fillText(line, tooltipX + padding, tooltipY + padding + i * lineHeight);
    
  });
}
