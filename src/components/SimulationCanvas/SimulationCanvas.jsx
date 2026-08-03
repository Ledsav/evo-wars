import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ColonyRenderer } from '../../rendering/ColonyRenderer';
import { OrganismRenderer } from '../../rendering/OrganismRenderer';

const MIN_VIEW_SCALE = 1;
const MAX_VIEW_SCALE = 5;
const VIEW_SCALE_STEP = 0.25;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function getCanvasPoint(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height)
  };
}

function constrainTransform(transform, width, height) {
  const scale = clamp(transform.scale, MIN_VIEW_SCALE, MAX_VIEW_SCALE);
  const centerX = width / 2;
  const centerY = height / 2;
  const dishRadius = Math.max(0, Math.min(width, height) / 2 - 8);
  const maxDisplacement = dishRadius * (scale - 1);

  let displacedCenterX = transform.offsetX + centerX * scale - centerX;
  let displacedCenterY = transform.offsetY + centerY * scale - centerY;
  const displacement = Math.hypot(displacedCenterX, displacedCenterY);

  if (displacement > maxDisplacement && displacement > 0) {
    const correction = maxDisplacement / displacement;
    displacedCenterX *= correction;
    displacedCenterY *= correction;
  }

  return {
    scale,
    offsetX: centerX + displacedCenterX - centerX * scale,
    offsetY: centerY + displacedCenterY - centerY * scale
  };
}

function zoomAroundPoint(transform, targetScale, anchor, width, height) {
  const scale = clamp(targetScale, MIN_VIEW_SCALE, MAX_VIEW_SCALE);
  const worldX = (anchor.x - transform.offsetX) / transform.scale;
  const worldY = (anchor.y - transform.offsetY) / transform.scale;

  return constrainTransform({
    scale,
    offsetX: anchor.x - worldX * scale,
    offsetY: anchor.y - worldY * scale
  }, width, height);
}

/**
 * SimulationCanvas - Renders and navigates the circular culture.
 */
export const SimulationCanvas = forwardRef(({
  world,
  width = 800,
  height = 600,
  highlightedSpeciesId = null,
  overlays = {},
  onViewScaleChange
}, ref) => {
  const canvasRef = useRef(null);
  const [viewTransform, setViewTransform] = useState({
    scale: MIN_VIEW_SCALE,
    offsetX: 0,
    offsetY: 0
  });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState(0);

  const resetView = useCallback(() => {
    setViewTransform({
      scale: MIN_VIEW_SCALE,
      offsetX: 0,
      offsetY: 0
    });
  }, []);

  const zoomBy = useCallback((amount) => {
    setViewTransform(current => zoomAroundPoint(
      current,
      current.scale + amount,
      { x: width / 2, y: height / 2 },
      width,
      height
    ));
  }, [height, width]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    OrganismRenderer.renderBackground(ctx, width, height);

    ctx.save();
    OrganismRenderer.clipToDish(ctx, width, height);
    ctx.translate(viewTransform.offsetX, viewTransform.offsetY);
    ctx.scale(viewTransform.scale, viewTransform.scale);

    OrganismRenderer.renderSectionWalls(ctx, world);

    const visibleLeft = -viewTransform.offsetX / viewTransform.scale;
    const visibleTop = -viewTransform.offsetY / viewTransform.scale;
    const visibleWidth = width / viewTransform.scale;
    const visibleHeight = height / viewTransform.scale;
    const visibleRight = visibleLeft + visibleWidth;
    const visibleBottom = visibleTop + visibleHeight;
    const useSpatialRenderQuery = viewTransform.scale > 1.15;
    const queryPadding = 80 / viewTransform.scale;
    const foodToRender = useSpatialRenderQuery && world.getFoodInArea
      ? world.getFoodInArea(
          visibleLeft - queryPadding,
          visibleTop - queryPadding,
          visibleRight + queryPadding,
          visibleBottom + queryPadding
        )
      : world.foodParticles;
    const organismsToRender = useSpatialRenderQuery && world.getOrganismsInArea
      ? world.getOrganismsInArea(
          visibleLeft - queryPadding,
          visibleTop - queryPadding,
          visibleRight + queryPadding,
          visibleBottom + queryPadding
        )
      : world.organisms;
    const population = world.organisms.length;
    const showOrganismUI = population < 140 || viewTransform.scale >= 1.75;
    const lodBias = population >= 1000 ? 2 : population >= 500 ? 1.5 : 1;
    const colonyRenderOptions = {
      scale: viewTransform.scale,
      lodBias,
      population,
      showUI: showOrganismUI,
      worldTime: world.time
    };
    const aggregateColonyIds = new Set();
    const aggregatedMemberIds = new Set();
    const colonies = world.colonyManager?.getColonies?.() || [];

    for (const colony of colonies) {
      if (ColonyRenderer.shouldRenderAsAggregate(colony, colonyRenderOptions)) {
        aggregateColonyIds.add(colony.id);
        for (const member of colony.members) {
          aggregatedMemberIds.add(member.id);
        }
      }
    }

    for (const food of foodToRender) {
      if (
        food.x + food.radius < visibleLeft ||
        food.x - food.radius > visibleRight ||
        food.y + food.radius < visibleTop ||
        food.y - food.radius > visibleBottom
      ) {
        continue;
      }
      OrganismRenderer.renderFood(ctx, food);
    }

    for (const bond of world.colonyManager?.getBonds?.() || []) {
      const colony = world.colonyManager.getColonyForOrganism(bond.first);
      if (!colony || aggregateColonyIds.has(colony.id)) continue;
      ColonyRenderer.renderBond(ctx, bond, colonyRenderOptions);
    }

    for (const colony of colonies) {
      if (!aggregateColonyIds.has(colony.id)) continue;
      const isHighlighted = highlightedSpeciesId !== null &&
        colony.speciesId === highlightedSpeciesId;
      ColonyRenderer.renderAggregate(
        ctx,
        colony,
        isHighlighted,
        colonyRenderOptions
      );
    }

    for (const organism of organismsToRender) {
      if (aggregatedMemberIds.has(organism.id)) continue;

      const size = organism.phenotype?.size || 10;
      const margin = size + 30;

      if (
        organism.x + margin < visibleLeft ||
        organism.x - margin > visibleLeft + visibleWidth ||
        organism.y + margin < visibleTop ||
        organism.y - margin > visibleTop + visibleHeight
      ) {
        continue;
      }

      const isHighlighted = highlightedSpeciesId !== null &&
        organism.getSpeciesId() === highlightedSpeciesId;

      OrganismRenderer.render(
        ctx,
        organism,
        isHighlighted,
        overlays,
        {
          scale: viewTransform.scale,
          showUI: showOrganismUI,
          lodBias
        }
      );
    }

    ctx.restore();
    OrganismRenderer.renderDishFrame(ctx, width, height);
  }, [height, highlightedSpeciesId, overlays, viewTransform, width, world]);

  useImperativeHandle(ref, () => ({
    render,
    resetView,
    zoomIn: () => zoomBy(VIEW_SCALE_STEP),
    zoomOut: () => zoomBy(-VIEW_SCALE_STEP),
    getCanvasElement: () => canvasRef.current
  }), [render, resetView, zoomBy]);

  useEffect(() => {
    onViewScaleChange?.(viewTransform.scale);
  }, [onViewScaleChange, viewTransform.scale]);

  const handleWheel = useCallback((event) => {
    event.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    let delta = -event.deltaY;
    if (event.deltaMode === 1) {
      delta *= 33;
    } else if (event.deltaMode === 2) {
      delta *= 100;
    }

    const anchor = getCanvasPoint(canvas, event.clientX, event.clientY);
    setViewTransform(current => zoomAroundPoint(
      current,
      current.scale * (1 + delta * 0.001),
      anchor,
      width,
      height
    ));
  }, [height, width]);

  const handleMouseDown = (event) => {
    if (event.button !== 0 || !canvasRef.current) return;

    setIsPanning(true);
    setPanStart(getCanvasPoint(canvasRef.current, event.clientX, event.clientY));
  };

  const handleMouseMove = useCallback((event) => {
    const canvas = canvasRef.current;
    if (!isPanning || !canvas) return;

    const point = getCanvasPoint(canvas, event.clientX, event.clientY);
    const deltaX = point.x - panStart.x;
    const deltaY = point.y - panStart.y;

    setViewTransform(current => constrainTransform({
      ...current,
      offsetX: current.offsetX + deltaX,
      offsetY: current.offsetY + deltaY
    }, width, height));
    setPanStart(point);
  }, [height, isPanning, panStart.x, panStart.y, width]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const getTouchDistance = (firstTouch, secondTouch) => {
    const deltaX = secondTouch.clientX - firstTouch.clientX;
    const deltaY = secondTouch.clientY - firstTouch.clientY;
    return Math.hypot(deltaX, deltaY);
  };

  const handleTouchStart = useCallback((event) => {
    event.preventDefault();
    const touches = Array.from(event.touches);
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (touches.length === 1) {
      setIsPanning(true);
      setPanStart(getCanvasPoint(canvas, touches[0].clientX, touches[0].clientY));
    } else if (touches.length === 2) {
      setIsPanning(false);
      setLastTouchDistance(getTouchDistance(touches[0], touches[1]));
    }
  }, []);

  const handleTouchMove = useCallback((event) => {
    event.preventDefault();
    const touches = Array.from(event.touches);
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (touches.length === 1 && isPanning) {
      const point = getCanvasPoint(canvas, touches[0].clientX, touches[0].clientY);
      const deltaX = point.x - panStart.x;
      const deltaY = point.y - panStart.y;

      setViewTransform(current => constrainTransform({
        ...current,
        offsetX: current.offsetX + deltaX,
        offsetY: current.offsetY + deltaY
      }, width, height));
      setPanStart(point);
    } else if (touches.length === 2 && lastTouchDistance > 0) {
      const distance = getTouchDistance(touches[0], touches[1]);
      const centerClientX = (touches[0].clientX + touches[1].clientX) / 2;
      const centerClientY = (touches[0].clientY + touches[1].clientY) / 2;
      const anchor = getCanvasPoint(canvas, centerClientX, centerClientY);
      const zoomFactor = distance / lastTouchDistance;

      setViewTransform(current => zoomAroundPoint(
        current,
        current.scale * zoomFactor,
        anchor,
        width,
        height
      ));
      setLastTouchDistance(distance);
    }
  }, [height, isPanning, lastTouchDistance, panStart.x, panStart.y, width]);

  const handleTouchEnd = useCallback((event) => {
    event.preventDefault();
    const touches = Array.from(event.touches);
    const canvas = canvasRef.current;

    if (touches.length === 0) {
      setIsPanning(false);
      setLastTouchDistance(0);
    } else if (touches.length === 1 && canvas) {
      setIsPanning(true);
      setPanStart(getCanvasPoint(canvas, touches[0].clientX, touches[0].clientY));
      setLastTouchDistance(0);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  useEffect(() => {
    if (!isPanning) return;

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp, isPanning]);

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
  }, [handleTouchEnd, handleTouchMove, handleTouchStart]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onMouseDown={handleMouseDown}
      onDoubleClick={resetView}
      className={`simulation-canvas ${isPanning ? 'is-panning' : ''}`}
      style={{
        display: 'block',
        maxWidth: '100%',
        maxHeight: '100%',
        objectFit: 'contain',
        touchAction: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none'
      }}
    />
  );
});
