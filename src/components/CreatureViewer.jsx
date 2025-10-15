import { useEffect, useRef, useState } from 'react';
import { OrganismRenderer } from '../rendering/OrganismRenderer';
import { GenomePopup } from './GenomePopup';
import { InfoIcon } from './Icons';

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
  // Persist a stable representative per species across renders
  const repMapRef = useRef({});
  // Cache generated thumbnails per species representative to avoid re-rendering
  const thumbCacheRef = useRef(new Map());

  // Handle species selection for highlighting
  const handleSpeciesClick = (speciesId) => {
    const newSelection = selectedSpecies === speciesId ? null : speciesId;
    setSelectedSpecies(newSelection);
    if (onSpeciesHighlight) {
      onSpeciesHighlight(newSelection);
    }
  };

  // Group organisms by species
  const getSpeciesGroups = () => {
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
  };

  const species = getSpeciesGroups();

  return (
    <div className="creature-viewer">
      <h2>Controls</h2>

      <div className="overlay-toggles" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={!!(overlays && overlays.showSensory)}
            onChange={e => onUpdateOverlays && onUpdateOverlays({ showSensory: e.target.checked })}
          />
          Show sensory ranges
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={!!(overlays && overlays.showRepro)}
            onChange={e => onUpdateOverlays && onUpdateOverlays({ showRepro: e.target.checked })}
          />
          Show reproduction readiness
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={!!(overlays && overlays.showSpeed)}
            onChange={e => onUpdateOverlays && onUpdateOverlays({ showSpeed: e.target.checked })}
          />
          Show speed trails
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={!!(overlays && overlays.showMetabolism)}
            onChange={e => onUpdateOverlays && onUpdateOverlays({ showMetabolism: e.target.checked })}
          />
          Show metabolism glow
        </label>
      </div>

      <h3>Species ({species.length})</h3>

      <div className="species-list">
        {species.map((sp) => (
          <div
            key={sp.id}
            className={`species-item ${selectedSpecies === sp.id ? 'selected' : ''}`}
          >
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

      <GenomePopup
        organism={genomePopupOrganism}
        onClose={() => setGenomePopupOrganism(null)}
      />
    </div>
  );
}
