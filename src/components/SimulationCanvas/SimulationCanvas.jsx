import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
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

  // Touch state for gestures
  const [_touches, setTouches] = useState([]);
  const [lastTouchDistance, setLastTouchDistance] = useState(0);

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
    },
    getCanvasElement: () => canvasRef.current
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

  const handleMouseMove = useCallback((e) => {
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
  }, [height, isPanning, panStart.x, panStart.y, width]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Reset zoom
  const handleDoubleClick = () => {
    setViewTransform({
      scale: 1,
      offsetX: 0,
      offsetY: 0
    });
  };

  // Touch event handlers for mobile gestures
  const getTouchDistance = (touch1, touch2) => {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (touch1, touch2) => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    };
  };

  const handleTouchStart = useCallback((e) => {
    e.preventDefault(); // Prevent default touch behavior

    const touchList = Array.from(e.touches);
    setTouches(touchList);

    if (touchList.length === 1) {
      // Single touch - start panning
      setIsPanning(true);
      setPanStart({ x: touchList[0].clientX, y: touchList[0].clientY });
    } else if (touchList.length === 2) {
      // Two touches - start pinch zoom
      setIsPanning(false);
      const distance = getTouchDistance(touchList[0], touchList[1]);
      setLastTouchDistance(distance);
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault(); // Prevent default touch behavior

    const touchList = Array.from(e.touches);

    if (touchList.length === 1 && isPanning) {
      // Single touch panning
      const dx = touchList[0].clientX - panStart.x;
      const dy = touchList[0].clientY - panStart.y;

      setViewTransform(prev => {
        const newOffsetX = prev.offsetX + dx;
        const newOffsetY = prev.offsetY + dy;

        // Calculate pan limits
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

      setPanStart({ x: touchList[0].clientX, y: touchList[0].clientY });
    } else if (touchList.length === 2) {
      // Pinch zoom
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const distance = getTouchDistance(touchList[0], touchList[1]);
      const center = getTouchCenter(touchList[0], touchList[1]);

      const centerX = center.x - rect.left;
      const centerY = center.y - rect.top;

      // Calculate zoom factor from distance change
      const zoomFactor = distance / lastTouchDistance;
      const newScale = Math.max(1, Math.min(5, viewTransform.scale * zoomFactor));

      // Calculate world position of touch center before zoom
      const worldX = (centerX - viewTransform.offsetX) / viewTransform.scale;
      const worldY = (centerY - viewTransform.offsetY) / viewTransform.scale;

      // Calculate new offset to keep touch center fixed
      let newOffsetX = centerX - worldX * newScale;
      let newOffsetY = centerY - worldY * newScale;

      // Apply pan limits
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

      setLastTouchDistance(distance);
    }

    setTouches(touchList);
  }, [isPanning, panStart, lastTouchDistance, viewTransform, width, height]);

  const handleTouchEnd = useCallback((e) => {
    e.preventDefault();

    const touchList = Array.from(e.touches);
    setTouches(touchList);

    if (touchList.length === 0) {
      // All touches released
      setIsPanning(false);
      setLastTouchDistance(0);
    } else if (touchList.length === 1) {
      // One touch remaining - restart panning
      setIsPanning(true);
      setPanStart({ x: touchList[0].clientX, y: touchList[0].clientY });
      setLastTouchDistance(0);
    }
  }, []);

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
  }, [handleMouseMove, handleMouseUp, isPanning]);

  // Add touch event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

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
        cursor: isPanning ? 'grabbing' : 'grab',
        touchAction: 'none', // Disable browser touch handling for custom gestures
        WebkitUserSelect: 'none', // Prevent text selection on mobile
        userSelect: 'none'
      }}
    />
  );
});
