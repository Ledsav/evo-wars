import { useState } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon, CompareIcon } from '../shared/Icons/Icons';
import { OverlayRadarChart } from './OverlayRadarChart';
import { RadarChart } from './RadarChart';

/**
 * ComparisonPopup - Side-by-side comparison of organism radar charts
 */
export function ComparisonPopup({ organisms, onClose }) {
  const [viewMode, setViewMode] = useState('multiple'); 

  
  if (!organisms || organisms.length === 0) return null;

  return createPortal(
    <div className="comparison-popup-overlay" onClick={onClose}>
      <div className="comparison-popup" onClick={(e) => e.stopPropagation()}>
        <div className="comparison-popup-header">
          <div className="comparison-popup-title">
            <CompareIcon size={24} />
            <h2>Species Comparison ({organisms.length})</h2>
          </div>

          <div className="view-mode-toggle">
            <button
              className={`view-mode-btn ${viewMode === 'single' ? 'active' : ''}`}
              onClick={() => setViewMode('single')}
              title="Overlay view - all species on one chart"
            >
              Overlay
            </button>
            <button
              className={`view-mode-btn ${viewMode === 'multiple' ? 'active' : ''}`}
              onClick={() => setViewMode('multiple')}
              title="Side-by-side view - separate charts"
            >
              Side-by-Side
            </button>
          </div>

          <button className="comparison-popup-close" onClick={onClose}>
            <CloseIcon size={24} />
          </button>
        </div>

        <div className="comparison-popup-content">
          {viewMode === 'single' ? (
            <div className="comparison-overlay-view">
              <OverlayRadarChart organisms={organisms} />
              <div className="comparison-legend">
                {organisms.map((organism, index) => {
                  const info = typeof organism.getSpeciesInfo === 'function' ? organism.getSpeciesInfo() : null;
                  const label = info ? `${info.emoji} ${info.name}` : `Species ${organism.id ?? index}`;
                  const code = info?.code ? ` (${info.code})` : '';
                  return (
                    <div key={organism.id || index} className="legend-item">
                      <div
                        className="legend-color"
                        style={{ backgroundColor: getOrganismColor(index) }}
                      />
                      <span className="legend-label">
                        {label}{code}
                      </span>
                      <span className="legend-stats">
                        Age: {((organism.age || 0) / 1000).toFixed(1)}s |
                        Energy: {(organism.energy || 0).toFixed(0)}/{organism.maxEnergy || 100}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="comparison-grid">
              {organisms.map((organism, index) => {
                const info = typeof organism.getSpeciesInfo === 'function' ? organism.getSpeciesInfo() : null;
                const title = info ? `${info.emoji} ${info.name}${info.code ? ` (${info.code})` : ''}` : `Species ${organism.id ?? index}`;
                return (
                  <div key={organism.id || index} className="comparison-item">
                    <div className="comparison-item-header">
                      <h3>{title}</h3>
                      <div className="comparison-stats">
                        <span className="comparison-stat">
                          Age: {((organism.age || 0) / 1000).toFixed(1)}s
                        </span>
                        <span className="comparison-stat">
                          Energy: {(organism.energy || 0).toFixed(0)}/{organism.maxEnergy || 100}
                        </span>
                      </div>
                    </div>
                    <RadarChart organism={organism} />
                  </div>
                );
              })}
            </div>
          )}

          {organisms.length < 2 && (
            <div className="comparison-notice">
              <p>Select at least 2 species to compare their traits effectively.</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}


function getOrganismColor(index) {
  const colors = [
    '#4ade80', 
    '#60a5fa', 
    '#a78bfa', 
    '#f472b6', 
    '#fb923c', 
    '#34d399', 
    '#ef4444', 
    '#fbbf24', 
  ];
  return colors[index % colors.length];
}
