import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { OrganismRenderer } from '../rendering/OrganismRenderer';

/**
 * SimulationCanvas - Renders the game world
 */
export const SimulationCanvas = forwardRef(({ world, width = 800, height = 600 }, ref) => {
  const canvasRef = useRef(null);

  // Expose render function to parent component
  useImperativeHandle(ref, () => ({
    render: () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');

      // Clear and render background
      OrganismRenderer.renderBackground(ctx, width, height);

      // Render food
      for (const food of world.foodParticles) {
        OrganismRenderer.renderFood(ctx, food);
      }

      // Render organisms
      for (const organism of world.organisms) {
        OrganismRenderer.render(ctx, organism);
      }
    }
  }), [world, width, height]);

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
        backgroundColor: '#0a1929'
      }}
    />
  );
});
