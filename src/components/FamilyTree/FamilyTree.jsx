import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNotifications } from '../../context/useNotifications';
import { OrganismRenderer } from '../../rendering/OrganismRenderer';
import { ScreenShotIcon } from '../shared/Icons/Icons';
import './FamilyTree.css';

/**
 * FamilyTreeCanvas - Reusable canvas component for rendering the tree
 */
function FamilyTreeCanvas({ genealogyTracker, width, height, onHoverChange, isMaximized = false, innerRef }) {
  const canvasRef = useRef(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const nodePositions = useRef(new Map()); 

  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
    const scaleFactor = Math.max(2, dpr); 
    canvas.width = width * scaleFactor;
    canvas.height = height * scaleFactor;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    
    ctx.scale(scaleFactor, scaleFactor);

    
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    
    const layout = genealogyTracker.getTreeLayout();
    if (layout.length === 0) {
      
      ctx.fillStyle = '#888888';
      ctx.font = '14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('No species data yet. The tree will appear as organisms evolve.', width / 2, height / 2);
      return;
    }

    
    const nodeRadius = isMaximized ? 30 : 20;
    const verticalSpacing = isMaximized ? 120 : 80;
    const extinctNodeRadius = nodeRadius * 0.6; 
    const levelHeight = verticalSpacing;
    const topPadding = isMaximized ? 60 : 40;

    nodePositions.current.clear();

    
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

    
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 2;

    for (let depth = 0; depth < levelPositions.length - 1; depth++) {
      const currentLevel = levelPositions[depth];
      const nextLevel = levelPositions[depth + 1];

      for (const parent of currentLevel) {
        for (const child of nextLevel) {
          if (child.node.parentId === parent.node.id) {
            
            ctx.beginPath();
            ctx.moveTo(parent.x, parent.y + nodeRadius);
            ctx.lineTo(child.x, child.y - nodeRadius);
            ctx.stroke();
          }
        }
      }
    }

    
    let hoveredNodeData = null; 

    const truncate = (text, max) => (text && text.length > max ? text.slice(0, max - 1) + '…' : text);

    for (const level of levelPositions) {
      for (const { node, x, y } of level) {
        
        const currentNodeRadius = node.extinct ? extinctNodeRadius : nodeRadius;

        
        nodePositions.current.set(node.id, { x, y, radius: currentNodeRadius });

        
        const isHovered = hoveredNode === node.id;

        
        if (isHovered) {
          hoveredNodeData = { node, x, y };
        }

        
        ctx.beginPath();
        ctx.arc(x, y, currentNodeRadius, 0, Math.PI * 2);

        
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

        
        if (node.representative && !node.extinct) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(x, y, currentNodeRadius - 4, 0, Math.PI * 2);
          ctx.clip();

          
          const cached = OrganismRenderer.getHighResCachedRender(node.representative);
          const cacheScale = cached.scale || 1;

          
          const scale = (currentNodeRadius - 8) / ((node.representative.phenotype?.size || 10) * cacheScale);
          ctx.translate(x, y);
          ctx.scale(scale, scale);

          
          const halfSize = cached.size / 2;
          ctx.drawImage(cached.canvas, -halfSize, -halfSize);

          ctx.restore();
        } else if (node.extinct && !node.isExtinctGroup) {
          
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
          
          ctx.save();
          ctx.fillStyle = '#666666';
          ctx.font = `${currentNodeRadius * 1.2}px system-ui`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('💀', x, y);
          ctx.restore();
        }

        
        if (!node.extinct) {
          const badgeText = node.currentPopulation.toString();
          const badgeFontSize = isMaximized ? 11 : 9;
          ctx.font = `bold ${badgeFontSize}px system-ui`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          
          const badgeRadius = isMaximized ? 12 : 10;
          const badgeX = x + currentNodeRadius - (isMaximized ? 8 : 6);
          const badgeY = y - currentNodeRadius + (isMaximized ? 8 : 6);

          ctx.beginPath();
          ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
          ctx.fillStyle = '#4CAF50';
          ctx.fill();

          
          ctx.fillStyle = '#ffffff';
          ctx.fillText(badgeText, badgeX, badgeY);
        }

        
        let labelText;
        if (node.isExtinctGroup) {
          labelText = `${node.extinctCount} extinct`;
        } else {
          const info = node.representative && typeof node.representative.getSpeciesInfo === 'function'
            ? node.representative.getSpeciesInfo()
            : null;
          const base = info ? `${info.emoji} ${info.name}` : `Species ${node.id.toString().slice(0, node.extinct ? 4 : 6)}`;
          
          labelText = truncate(base, isMaximized ? 22 : 16);
        }

        const labelFontSize = node.extinct ? (isMaximized ? 9 : 7) : (isMaximized ? 11 : 9);
        ctx.font = `${labelFontSize}px system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = node.extinct ? '#555555' : '#cccccc';
        ctx.fillText(labelText, x, y + currentNodeRadius + 3);

        
        if (node.extinct && !node.isExtinctGroup) {
          const extinctFontSize = isMaximized ? 9 : 7;
          ctx.font = `${extinctFontSize}px system-ui`;
          ctx.fillStyle = '#777777';
          ctx.fillText('✝', x, y + currentNodeRadius + (isMaximized ? 14 : 11));
        }
      }
    }

    
    if (hoveredNodeData) {
      drawHoverInfo(ctx, hoveredNodeData.node, hoveredNodeData.x, hoveredNodeData.y, nodeRadius, width, height);
    }
  }, [genealogyTracker, width, height, hoveredNode, isMaximized]);

  
  useEffect(() => {
    if (onHoverChange) {
      onHoverChange(hoveredNode);
    }
  }, [hoveredNode, onHoverChange]);

  
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    
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
      ref={(el) => {
        canvasRef.current = el;
        if (typeof innerRef === 'function') innerRef(el);
        else if (innerRef && typeof innerRef === 'object') innerRef.current = el;
      }}
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
  const canvasElRef = useRef(null);
  const { notify } = useNotifications();

  useEffect(() => {
    const handleResize = () => {
      
      const layout = genealogyTracker.getTreeLayout();
      const verticalSpacing = 120; 
      const topPadding = 60;
      const bottomPadding = 60;
      const minHeight = 500;

      
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

    
    const interval = setInterval(handleResize, 1000);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(interval);
    };
  }, [genealogyTracker]);

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
          <button
            className="floating-action camera"
            title="Save genealogy screenshot"
            onClick={() => {
              const el = canvasElRef.current;
              if (el) {
                
                import('../../utils/screenshot').then(({ downloadCanvas, timestampFilename }) => {
                  const fname = timestampFilename('genealogy');
                  downloadCanvas(el, fname, (filename) => {
                    notify('screenshot', `📸 Genealogy tree saved: ${filename}`, { timeout: 3000 });
                  });
                });
              }
            }}
          >
            <ScreenShotIcon size={18} />
          </button>
          <FamilyTreeCanvas
            genealogyTracker={genealogyTracker}
            width={canvasSize.width}
            height={canvasSize.height}
            isMaximized={true}
            innerRef={canvasElRef}
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
  const canvasElRef = useRef(null);
  const { notify } = useNotifications();

  
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth } = containerRef.current;

        
        const layout = genealogyTracker.getTreeLayout();
        const verticalSpacing = 80; 
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

    
    const interval = setInterval(updateSize, 1000); 

    return () => {
      window.removeEventListener('resize', updateSize);
      clearInterval(interval);
    };
  }, [genealogyTracker]);

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
          <button
            className="floating-action camera"
            title="Save genealogy screenshot"
            onClick={() => {
              if (canvasElRef.current) {
                import('../../utils/screenshot').then(({ downloadCanvas, timestampFilename }) => {
                  const fname = timestampFilename('genealogy');
                  downloadCanvas(canvasElRef.current, fname, (filename) => {
                    notify('screenshot', `📸 Genealogy tree saved: ${filename}`, { timeout: 3000 });
                  });
                });
              }
            }}
          >
            <ScreenShotIcon size={18} />
          </button>
          <FamilyTreeCanvas
            genealogyTracker={genealogyTracker}
            width={canvasSize.width}
            height={canvasSize.height}
            isMaximized={false}
            innerRef={canvasElRef}
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

  
  let info;

  if (node.isExtinctGroup) {
    
    info = [
      `Extinct Species Group`,
      `Count: ${node.extinctCount} species`,
      `Total Max Pop: ${node.maxPopulation}`,
      `Generation: ${node.id.split('-')[2]}`,
    ];
    const timeAlive = ((node.extinctTime - node.firstSeen) / 1000).toFixed(0);
    info.push(`Lasted: ${timeAlive}s`);
  } else {
    
    const infoObj = node.representative && typeof node.representative.getSpeciesInfo === 'function'
      ? node.representative.getSpeciesInfo()
      : null;
    const speciesLine = infoObj
      ? `Species: ${infoObj.emoji} ${infoObj.name}${infoObj.code ? ` (${infoObj.code})` : ''}`
      : `Species: ${node.id.toString().slice(0, 8)}`;

    info = [
      speciesLine,
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

  
  let tooltipX = x + nodeRadius + 15;
  let tooltipY = y - tooltipHeight / 2;

  if (tooltipX + tooltipWidth > canvasWidth - 10) {
    tooltipX = x - nodeRadius - tooltipWidth - 15;
  }

  tooltipY = Math.max(10, Math.min(tooltipY, canvasHeight - tooltipHeight - 10));

  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
  ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);

  
  ctx.strokeStyle = node.extinct ? '#666666' : `hsl(${node.color.h}, ${node.color.s}%, ${node.color.l}%)`;
  ctx.lineWidth = 2;
  ctx.strokeRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);

  
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px system-ui';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  info.forEach((line, i) => {
    ctx.fillText(line, tooltipX + padding, tooltipY + padding + i * lineHeight);
    
  });
}
