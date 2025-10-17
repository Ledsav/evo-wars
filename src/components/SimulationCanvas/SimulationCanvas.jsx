import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { OrganismRenderer } from '../../rendering/OrganismRenderer';

/**
 * SimulationCanvas - Renders the game world
 */
export const SimulationCanvas = forwardRef(({ world, width = 800, height = 600, highlightedSpeciesId = null, overlays = {} }, ref) => {
  const canvasRef = useRef(null);

  // Expose render function to parent component
  useImperativeHandle(ref, () => ({
    render: () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Clear and render background
      OrganismRenderer.renderBackground(ctx, width, height);

      // Render section walls (if enabled)
      OrganismRenderer.renderSectionWalls(ctx, world);

      // Render food (with frustum culling)
      for (const food of world.foodParticles) {
        // Skip rendering if off-screen
        if (food.x + food.radius < 0 || food.x - food.radius > width ||
            food.y + food.radius < 0 || food.y - food.radius > height) {
          continue;
        }
        OrganismRenderer.renderFood(ctx, food);
      }

      // Render organisms (with frustum culling)
      for (const organism of world.organisms) {
        const size = organism.phenotype?.size || 10;
        const margin = size + 30; // Extra margin for energy bars and effects

        // Skip rendering if off-screen
        if (organism.x + margin < 0 || organism.x - margin > width ||
            organism.y + margin < 0 || organism.y - margin > height) {
          continue;
        }

        const isHighlighted = highlightedSpeciesId !== null &&
                            organism.getSpeciesId() === highlightedSpeciesId;
        OrganismRenderer.render(ctx, organism, isHighlighted, overlays || {});
      }
    }
  }), [world, width, height, highlightedSpeciesId, overlays]);

  // Initial render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ref) return;

    // Trigger initial render
    if (ref.current && ref.current.render) {
      ref.current.render();
    }
  }, [world, ref]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        border: '2px solid #4a5568',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
        backgroundColor: '#0a1929',
        display: 'block',
        maxWidth: '100%',
        maxHeight: '100%',
        objectFit: 'contain'
      }}
    />
  );
});
