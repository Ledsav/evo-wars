import { useState } from 'react';
import { InfoIcon } from './Icons';
import { GenomePopup } from './GenomePopup';

/**
 * CreatureViewer - Display species and their genomes
 */
export function CreatureViewer({ world, onSpeciesHighlight }) {
  const [selectedSpecies, setSelectedSpecies] = useState(null);
  const [genomePopupOrganism, setGenomePopupOrganism] = useState(null);

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
          organisms: [],
          representative: organism
        };
      }
      groups[speciesId].organisms.push(organism);
    }

    return Object.values(groups);
  };

  const species = getSpeciesGroups();

  const getSpeciesColor = (speciesId) => {
    // Generate consistent color from species ID
    const hue = (speciesId * 137.5) % 360;
    return `hsl(${hue}, 60%, 50%)`;
  };

  return (
    <div className="creature-viewer">
      <h2>Species ({species.length})</h2>

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
              <div
                className="species-color"
                style={{ backgroundColor: getSpeciesColor(sp.id) }}
              />
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

      {selectedSpecies && (() => {
        const sp = species.find(s => s.id === selectedSpecies);
        if (!sp) return null;

        const rep = sp.representative;
        const avgEnergy = sp.organisms.reduce((sum, o) => sum + o.energy, 0) / sp.organisms.length;
        const avgAge = sp.organisms.reduce((sum, o) => sum + o.age, 0) / sp.organisms.length;

        return (
          <div className="species-details">
            <h3>Species {sp.id.toString().slice(0, 8)}</h3>

            <div className="species-stats">
              <div className="stat-row">
                <span>Population:</span>
                <span>{sp.organisms.length}</span>
              </div>
              <div className="stat-row">
                <span>Avg Energy:</span>
                <span>{avgEnergy.toFixed(1)}</span>
              </div>
              <div className="stat-row">
                <span>Avg Age:</span>
                <span>{(avgAge / 1000).toFixed(1)}s</span>
              </div>
            </div>

            <h4>Traits (Representative)</h4>
            <div className="trait-grid">
              <div className="trait-item">
                <span>Size:</span>
                <span>{rep.phenotype.size.toFixed(1)}</span>
              </div>
              <div className="trait-item">
                <span>Speed:</span>
                <span>{rep.phenotype.maxSpeed.toFixed(2)}</span>
              </div>
              <div className="trait-item">
                <span>Aggression:</span>
                <span>{(rep.phenotype.aggression * 100).toFixed(0)}%</span>
              </div>
              <div className="trait-item">
                <span>Cooperation:</span>
                <span>{(rep.phenotype.cooperativeness * 100).toFixed(0)}%</span>
              </div>
              <div className="trait-item">
                <span>Metabolism:</span>
                <span>{rep.phenotype.metabolicRate.toFixed(2)}</span>
              </div>
              <div className="trait-item">
                <span>Armor:</span>
                <span>{rep.phenotype.armor.toFixed(1)}</span>
              </div>
              {rep.phenotype.toxicity > 0 && (
                <div className="trait-item highlight">
                  <span>Toxicity:</span>
                  <span>Yes</span>
                </div>
              )}
            </div>

            <h4>Genome</h4>
            <div className="genome-display">
              {rep.genome.getGeneNames().map(geneName => {
                const gene = rep.genome.getGene(geneName);
                const protein = rep.genome.expressedProteins[geneName];
                return (
                  <div key={geneName} className="gene-summary">
                    <div className="gene-name">{geneName}</div>
                    <div className="gene-seq">
                      {gene.dna.toString().substring(0, 30)}
                      {gene.dna.toString().length > 30 ? '...' : ''}
                    </div>
                    {protein && (
                      <div className="protein-summary">
                        Length: {protein.properties.length} |
                        Hydro: {protein.properties.hydrophobic} |
                        Arom: {protein.properties.aromatic}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      <GenomePopup
        organism={genomePopupOrganism}
        onClose={() => setGenomePopupOrganism(null)}
      />
    </div>
  );
}
