import { useEffect, useRef, useState, useMemo } from 'react';
import { OrganismRenderer } from '../../rendering/OrganismRenderer';
import { InfoIcon, CompareIcon } from '../shared/Icons/Icons';
import { GenomePopup } from './GenomePopup';
import { ComparisonPopup } from './ComparisonPopup';

// Exact renderer thumbnail -> data URL, cached per species representative and DPR
function SpeciesThumbnailExact({ speciesId, organism, size = 40, thumbCacheRef }) {
  // Derive stable keys to avoid effect loops
  const repId = organism && typeof organism.id !== 'undefined'
    ? organism.id
    : (organism && typeof organism.getSpeciesId === 'function' ? organism.getSpeciesId() : 'unknown');
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;

  // Seed initial URL from cache synchronously to avoid a blink
  const initialUrl = (() => {
    if (!speciesId || !repId || !thumbCacheRef?.current) return '';
    const cached = thumbCacheRef.current.get(speciesId);
    if (cached && cached.repId === repId && cached.dpr === dpr && cached.url) {
      return cached.url;
    }
    return '';
  })();

  const [url, setUrl] = useState(initialUrl);

  // Keep the organism object in a ref so the effect doesn't depend on its identity
  const repRef = useRef(null);
  useEffect(() => {
    repRef.current = organism;
  }, [organism]);

  useEffect(() => {
    if (!speciesId || !repId) return;

    const cache = thumbCacheRef.current;
    const cached = cache.get(speciesId);
    if (cached && cached.repId === repId && cached.dpr === dpr && cached.url) {
      // Setting the same value is a no-op; avoids dependency on `url`
      setUrl(cached.url);
      return;
    }

    // Generate once offscreen using the real renderer for exact appearance
    const off = document.createElement('canvas');
    off.width = size;
    off.height = size;
    try {
      if (!repRef.current) return;
      OrganismRenderer.renderThumbnail(off, repRef.current);
      const dataUrl = off.toDataURL('image/png');
      cache.set(speciesId, { repId, dpr, url: dataUrl });
      setUrl(dataUrl);
    } catch {
      // If rendering fails, store a sentinel to avoid loops
      cache.set(speciesId, { repId, dpr, url: null });
    }
    // Only rerun when species id, representative id, size, or DPR changes
  }, [speciesId, repId, size, dpr, thumbCacheRef]);

  if (!url) return null;
  return <img className="species-thumb" src={url} alt="species thumbnail" />;
}

/**
 * CreatureViewer - Display species and their genomes
 */
export function CreatureViewer({ world, onSpeciesHighlight, overlays, onUpdateOverlays }) {
  const [selectedSpecies, setSelectedSpecies] = useState(null);
  const [genomePopupOrganism, setGenomePopupOrganism] = useState(null);
  const [selectedForComparison, setSelectedForComparison] = useState(new Set());
  const [comparisonOrganisms, setComparisonOrganisms] = useState(null);
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const [visibleCount, setVisibleCount] = useState(3); // Show top 3 by default

  // Persist a stable representative per species across renders
  const repMapRef = useRef({});
  // Cache generated thumbnails per species representative to avoid re-rendering
  const thumbCacheRef = useRef(new Map());

  // Throttle updates - only update every 500ms instead of every frame
  useEffect(() => {
    const interval = setInterval(() => {
      setUpdateTrigger(prev => prev + 1);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Handle species selection for highlighting
  const handleSpeciesClick = (speciesId) => {
    const newSelection = selectedSpecies === speciesId ? null : speciesId;
    setSelectedSpecies(newSelection);
    if (onSpeciesHighlight) {
      onSpeciesHighlight(newSelection);
    }
  };

  // Handle checkbox selection for comparison
  const handleComparisonToggle = (speciesId) => {
    const newSelection = new Set(selectedForComparison);
    if (newSelection.has(speciesId)) {
      newSelection.delete(speciesId);
    } else {
      newSelection.add(speciesId);
    }
    setSelectedForComparison(newSelection);
  };

  // Open comparison popup
  const handleOpenComparison = () => {
    const organisms = species
      .filter(sp => selectedForComparison.has(sp.id))
      .map(sp => sp.representative);
    setComparisonOrganisms(organisms);
  };

  // Close comparison popup
  const handleCloseComparison = () => {
    setComparisonOrganisms(null);
  };

  // Select all species for comparison
  const handleSelectAll = () => {
    const allSpeciesIds = new Set(species.map(sp => sp.id));
    setSelectedForComparison(allSpeciesIds);
  };

  // Deselect all species
  const handleDeselectAll = () => {
    setSelectedForComparison(new Set());
  };

  // Group organisms by species - memoized and throttled to avoid constant re-calculation
  const species = useMemo(() => {
    const groups = {};
    const alive = world.getAliveOrganisms();

    for (const organism of alive) {
      const speciesId = organism.getSpeciesId();
      if (!groups[speciesId]) {
        groups[speciesId] = {
          id: speciesId,
          organisms: []
        };
      }
      groups[speciesId].organisms.push(organism);
    }

    const result = Object.values(groups);

    // Assign stable representatives per species
    for (const sp of result) {
      const storedId = repMapRef.current[sp.id];
      let rep = null;
      if (storedId != null) {
        rep = sp.organisms.find(o => o.id === storedId) || null;
      }
      if (!rep) {
        // Pick deterministic representative: lowest id in the species
        rep = sp.organisms.reduce((min, o) => (min == null || o.id < min.id ? o : min), null);
        if (rep) {
          repMapRef.current[sp.id] = rep.id;
        }
      }
      sp.representative = rep || sp.organisms[0];
    }

    // Sort by population (descending - largest first)
    result.sort((a, b) => b.organisms.length - a.organisms.length);

    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateTrigger]); // Only recalculate when updateTrigger changes (every 500ms)

  // Get visible species based on current count
  const visibleSpecies = useMemo(() => {
    return species.slice(0, visibleCount);
  }, [species, visibleCount]);

  const hasMore = visibleCount < species.length;

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + 5);
  };

  const handleShowAll = () => {
    setVisibleCount(species.length);
  };

  const handleShowLess = () => {
    setVisibleCount(3);
  };

  return (
    <div className="creature-viewer">
      <h2>Controls</h2>

      <div className="overlay-toggles">
        <label className="overlay-toggle-item">
          <input
            type="checkbox"
            className="overlay-checkbox"
            checked={!!(overlays && overlays.showSensory)}
            onChange={e => onUpdateOverlays && onUpdateOverlays({ showSensory: e.target.checked })}
          />
          <span className="overlay-label">Show sensory ranges</span>
        </label>
        <label className="overlay-toggle-item">
          <input
            type="checkbox"
            className="overlay-checkbox"
            checked={!!(overlays && overlays.showRepro)}
            onChange={e => onUpdateOverlays && onUpdateOverlays({ showRepro: e.target.checked })}
          />
          <span className="overlay-label">Show reproduction readiness</span>
        </label>
        <label className="overlay-toggle-item">
          <input
            type="checkbox"
            className="overlay-checkbox"
            checked={!!(overlays && overlays.showSpeed)}
            onChange={e => onUpdateOverlays && onUpdateOverlays({ showSpeed: e.target.checked })}
          />
          <span className="overlay-label">Show speed trails</span>
        </label>
        <label className="overlay-toggle-item">
          <input
            type="checkbox"
            className="overlay-checkbox"
            checked={!!(overlays && overlays.showMetabolism)}
            onChange={e => onUpdateOverlays && onUpdateOverlays({ showMetabolism: e.target.checked })}
          />
          <span className="overlay-label">Show metabolism glow</span>
        </label>
      </div>

      <div className="species-header">
        <h3>Species ({species.length}) - Showing {visibleSpecies.length}</h3>
        <div className="species-header-actions">
          <div className="select-all-controls">
            <button
              className="select-all-btn"
              onClick={handleSelectAll}
              title="Select all species"
            >
              Select All
            </button>
            <button
              className="select-all-btn"
              onClick={handleDeselectAll}
              title="Deselect all species"
            >
              Clear
            </button>
          </div>
          {selectedForComparison.size > 0 && (
            <button
              className="compare-button"
              onClick={handleOpenComparison}
              title={`Compare ${selectedForComparison.size} species`}
            >
              <CompareIcon size={18} />
              Compare ({selectedForComparison.size})
            </button>
          )}
        </div>
      </div>

      <div className="species-list">
        {visibleSpecies.map((sp) => (
          <div
            key={sp.id}
            className={`species-item ${selectedSpecies === sp.id ? 'selected' : ''} ${selectedForComparison.has(sp.id) ? 'selected-for-comparison' : ''}`}
          >
            <input
              type="checkbox"
              className="species-checkbox"
              checked={selectedForComparison.has(sp.id)}
              onChange={() => handleComparisonToggle(sp.id)}
              onClick={(e) => e.stopPropagation()}
              title="Select for comparison"
            />
            <div
              className="species-item-main"
              onClick={() => handleSpeciesClick(sp.id)}
            >
              <SpeciesThumbnailExact speciesId={sp.id} organism={sp.representative} size={40} thumbCacheRef={thumbCacheRef} />
              <div className="species-info">
                <div className="species-name">Species {sp.id.toString().slice(0, 6)}</div>
                <div className="species-count">Pop: {sp.organisms.length}</div>
              </div>
            </div>
            <button
              className="species-info-btn"
              onClick={(e) => {
                e.stopPropagation();
                setGenomePopupOrganism(sp.representative);
              }}
              title="View Genome Details"
            >
              <InfoIcon size={18} />
            </button>
          </div>
        ))}
      </div>

      {/* Load More Controls */}
      {species.length > 3 && (
        <div className="load-more-controls">
          {hasMore && (
            <>
              <button
                className="load-more-btn"
                onClick={handleLoadMore}
                title="Load 5 more species"
              >
                Load More (+5)
              </button>
              <button
                className="load-more-btn"
                onClick={handleShowAll}
                title="Show all species"
              >
                Show All ({species.length})
              </button>
            </>
          )}
          {visibleCount > 3 && (
            <button
              className="load-more-btn"
              onClick={handleShowLess}
              title="Show only top 3 species"
            >
              Show Less
            </button>
          )}
        </div>
      )}

      <GenomePopup
        organism={genomePopupOrganism}
        onClose={() => setGenomePopupOrganism(null)}
      />

      <ComparisonPopup
        organisms={comparisonOrganisms}
        onClose={handleCloseComparison}
      />
    </div>
  );
}
