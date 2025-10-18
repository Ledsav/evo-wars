import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useCallback } from 'react';
import { OrganismRenderer } from '../../rendering/OrganismRenderer';

/**
 * SimulationCanvas - Renders the game world
 */
export const SimulationCanvas = forwardRef(({ world, width = 800, height = 600, highlightedSpeciesId = null, overlays = {} }, ref) => {
  const canvasRef = useRef(null);

  // Zoom and pan state
  const [viewTransform, setViewTransform] = useState({
    scale: 1,
    offsetX: 0,
    offsetY: 0
  });

  // Pan state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Expose render and resetView functions to parent component
  useImperativeHandle(ref, () => ({
    render: () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Save context state
      ctx.save();

      // Apply zoom and pan transformation
      ctx.translate(viewTransform.offsetX, viewTransform.offsetY);
      ctx.scale(viewTransform.scale, viewTransform.scale);

      // Clear and render background
      OrganismRenderer.renderBackground(ctx, width, height);

      // Render section walls (if enabled)
      OrganismRenderer.renderSectionWalls(ctx, world);

      // Calculate visible area for frustum culling (accounting for zoom)
      const visibleLeft = -viewTransform.offsetX / viewTransform.scale;
      const visibleTop = -viewTransform.offsetY / viewTransform.scale;
      const visibleWidth = width / viewTransform.scale;
      const visibleHeight = height / viewTransform.scale;

      // Render food (with frustum culling)
      for (const food of world.foodParticles) {
        // Skip rendering if off-screen (accounting for zoom)
        if (food.x + food.radius < visibleLeft || food.x - food.radius > visibleLeft + visibleWidth ||
            food.y + food.radius < visibleTop || food.y - food.radius > visibleTop + visibleHeight) {
          continue;
        }
        OrganismRenderer.renderFood(ctx, food);
      }

      // Render organisms (with frustum culling)
      for (const organism of world.organisms) {
        const size = organism.phenotype?.size || 10;
        const margin = size + 30; // Extra margin for energy bars and effects

        // Skip rendering if off-screen (accounting for zoom)
        if (organism.x + margin < visibleLeft || organism.x - margin > visibleLeft + visibleWidth ||
            organism.y + margin < visibleTop || organism.y - margin > visibleTop + visibleHeight) {
          continue;
        }

        const isHighlighted = highlightedSpeciesId !== null &&
                            organism.getSpeciesId() === highlightedSpeciesId;
        OrganismRenderer.render(ctx, organism, isHighlighted, overlays || {});
      }

      // Restore context state
      ctx.restore();
    },
    resetView: () => {
      setViewTransform({
        scale: 1,
        offsetX: 0,
        offsetY: 0
      });
    }
  }), [world, width, height, highlightedSpeciesId, overlays, viewTransform]);

  // Handle zoom with mouse wheel or trackpad pinch
  const handleWheel = useCallback((e) => {
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Determine zoom delta
    let delta = -e.deltaY;

    // Normalize wheel delta (different browsers/devices have different scales)
    if (e.deltaMode === 1) { // DOM_DELTA_LINE
      delta *= 33;
    } else if (e.deltaMode === 2) { // DOM_DELTA_PAGE
      delta *= 100;
    }

    // Calculate zoom factor (0.1% per pixel of wheel movement)
    const zoomFactor = 1 + (delta * 0.001);
    const newScale = Math.max(1, Math.min(5, viewTransform.scale * zoomFactor)); // Min 1x (no zoom out), max 5x

    // Calculate world position of mouse before zoom
    const worldX = (mouseX - viewTransform.offsetX) / viewTransform.scale;
    const worldY = (mouseY - viewTransform.offsetY) / viewTransform.scale;

    // Calculate new offset to keep mouse position fixed
    let newOffsetX = mouseX - worldX * newScale;
    let newOffsetY = mouseY - worldY * newScale;

    // Apply pan limits to prevent panning beyond world bounds
    const minOffsetX = width - (width * newScale);
    const maxOffsetX = 0;
    const minOffsetY = height - (height * newScale);
    const maxOffsetY = 0;

    newOffsetX = Math.max(minOffsetX, Math.min(maxOffsetX, newOffsetX));
    newOffsetY = Math.max(minOffsetY, Math.min(maxOffsetY, newOffsetY));

    setViewTransform({
      scale: newScale,
      offsetX: newOffsetX,
      offsetY: newOffsetY
    });
  }, [width, height, viewTransform]);

  // Handle panning with mouse drag
  const handleMouseDown = (e) => {
    if (e.button === 0) { // Left mouse button
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e) => {
    if (!isPanning) return;

    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;

    setViewTransform(prev => {
      const newOffsetX = prev.offsetX + dx;
      const newOffsetY = prev.offsetY + dy;

      // Calculate pan limits to keep world visible
      const minOffsetX = width - (width * prev.scale);
      const maxOffsetX = 0;
      const minOffsetY = height - (height * prev.scale);
      const maxOffsetY = 0;

      return {
        ...prev,
        offsetX: Math.max(minOffsetX, Math.min(maxOffsetX, newOffsetX)),
        offsetY: Math.max(minOffsetY, Math.min(maxOffsetY, newOffsetY))
      };
    });

    setPanStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Reset zoom
  const handleDoubleClick = () => {
    setViewTransform({
      scale: 1,
      offsetX: 0,
      offsetY: 0
    });
  };

  // Initial render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ref) return;

    // Trigger initial render
    if (ref.current && ref.current.render) {
      ref.current.render();
    }
  }, [world, ref]);

  // Add wheel event listener with passive: false to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  // Add/remove event listeners for panning
  useEffect(() => {
    if (isPanning) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isPanning, panStart, viewTransform]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      style={{
        border: '2px solid #4a5568',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
        backgroundColor: '#0a1929',
        display: 'block',
        maxWidth: '100%',
        maxHeight: '100%',
        objectFit: 'contain',
        cursor: isPanning ? 'grabbing' : 'grab'
      }}
    />
  );
});
