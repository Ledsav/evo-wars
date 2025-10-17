import { createPortal } from 'react-dom';
import { CloseIcon, DNAIcon } from '../shared/Icons/Icons';
import { RadarChart } from './RadarChart';

/**
 * GenomePopup - Detailed genome viewer modal
 */
export function GenomePopup({ organism, onClose }) {
  // Don't render if no organism selected
  if (!organism) return null;


  // Safely check for genome and genes
  if (!organism.genome || typeof organism.genome.getGeneNames !== 'function') {
    console.error('❌ Organism missing genome or getGeneNames method', organism);

    // Show error in popup instead of returning null
    return createPortal(
      <div className="genome-popup-overlay" onClick={onClose}>
        <div className="genome-popup" onClick={(e) => e.stopPropagation()}>
          <div className="genome-popup-header">
            <h2>Error: No Genome Data</h2>
            <button className="genome-popup-close" onClick={onClose}>
              <CloseIcon size={24} />
            </button>
          </div>
          <div className="genome-popup-content">
            <p style={{color: '#fca5a5'}}>This organism does not have genome data available.</p>
            <p style={{color: '#94a3b8', fontSize: '0.9rem', marginTop: '10px'}}>
              Check console for details.
            </p>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  const genes = organism.genome.getGeneNames();

  if (!genes || genes.length === 0) {
    console.error('❌ No genes found in genome');

    // Show error in popup instead of returning null
    return createPortal(
      <div className="genome-popup-overlay" onClick={onClose}>
        <div className="genome-popup" onClick={(e) => e.stopPropagation()}>
          <div className="genome-popup-header">
            <h2>Error: No Genes</h2>
            <button className="genome-popup-close" onClick={onClose}>
              <CloseIcon size={24} />
            </button>
          </div>
          <div className="genome-popup-content">
            <p style={{color: '#fca5a5'}}>This organism has no genes in its genome.</p>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="genome-popup-overlay" onClick={onClose}>
      <div className="genome-popup" onClick={(e) => e.stopPropagation()}>
        <div className="genome-popup-header">
          <div className="genome-popup-title">
            <DNAIcon size={24} />
            <h2>Genome Details - Organism #{organism.id}</h2>
          </div>
          <button className="genome-popup-close" onClick={onClose}>
            <CloseIcon size={24} />
          </button>
        </div>

        <div className="genome-popup-content">
          {/* Radar Chart Section */}
          <RadarChart organism={organism} />

          <div className="genome-overview">
            <div className="overview-stat">
              <span className="stat-label">Species ID:</span>
              <span className="stat-value">
                {organism.getSpeciesId ? organism.getSpeciesId().toString().slice(0, 8) : 'N/A'}
              </span>
            </div>
            <div className="overview-stat">
              <span className="stat-label">Age:</span>
              <span className="stat-value">{((organism.age || 0) / 1000).toFixed(1)}s</span>
            </div>
            <div className="overview-stat">
              <span className="stat-label">Energy:</span>
              <span className="stat-value">
                {(organism.energy || 0).toFixed(1)} / {organism.maxEnergy || 100}
              </span>
            </div>
          </div>

          <div className="genome-genes-section">
            <h3>Genes ({genes.length})</h3>
            {genes.map(geneName => {
              const gene = organism.genome.getGene(geneName);
              if (!gene) return null;

              const protein = organism.genome.expressedProteins?.[geneName];
              const sequence = gene.dna?.toString() || '';

              return (
                <div key={geneName} className="gene-detail-card">
                  <div className="gene-detail-header">
                    <h4>{geneName}</h4>
                    <span className="gene-length">{sequence.length} bp</span>
                  </div>

                  <div className="gene-sequence">
                    <div className="sequence-label">DNA Sequence:</div>
                    <div className="sequence-text">
                      {sequence.match(/.{1,60}/g)?.map((chunk, i) => (
                        <div key={i} className="sequence-line">
                          <span className="line-number">{i * 60 + 1}</span>
                          <span className="sequence-chunk">{chunk}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {protein && (
                    <div className="protein-section">
                      <div className="protein-header">
                        <strong>Expressed Protein:</strong>
                        <span className="protein-length">{protein.properties.length} amino acids</span>
                      </div>

                      <div className="amino-acid-sequence">
                        <div className="sequence-label">Amino Acid Sequence:</div>
                        <div className="amino-acids">
                          {protein.sequence && protein.sequence.split('').map((aa, idx) => (
                            <span
                              key={idx}
                              className={`amino-acid aa-${aa.toLowerCase()}`}
                              title={`${aa} (position ${idx + 1})`}
                            >
                              {aa}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="protein-properties">
                        <div className="property-grid">
                          <div className="property-item">
                            <span className="property-label">Total Length:</span>
                            <span className="property-value">{protein.properties.length}</span>
                          </div>
                          <div className="property-item">
                            <span className="property-label">Hydrophobic:</span>
                            <span className="property-value">{protein.properties.hydrophobic}</span>
                          </div>
                          <div className="property-item">
                            <span className="property-label">Hydrophilic:</span>
                            <span className="property-value">{protein.properties.hydrophilic}</span>
                          </div>
                          <div className="property-item">
                            <span className="property-label">Aromatic:</span>
                            <span className="property-value">{protein.properties.aromatic}</span>
                          </div>
                          <div className="property-item">
                            <span className="property-label">Positive Charge:</span>
                            <span className="property-value">{protein.properties.positive}</span>
                          </div>
                          <div className="property-item">
                            <span className="property-label">Negative Charge:</span>
                            <span className="property-value">{protein.properties.negative}</span>
                          </div>
                          <div className="property-item">
                            <span className="property-label">Tiny:</span>
                            <span className="property-value">{protein.properties.tiny}</span>
                          </div>
                          <div className="property-item">
                            <span className="property-label">Large:</span>
                            <span className="property-value">{protein.properties.large}</span>
                          </div>
                          <div className="property-item">
                            <span className="property-label">Hydrophobic Ratio:</span>
                            <span className="property-value">{protein.properties.hydrophobicRatio.toFixed(2)}</span>
                          </div>
                          <div className="property-item">
                            <span className="property-label">Net Charge:</span>
                            <span className="property-value">{protein.getCharge()}</span>
                          </div>
                          <div className="property-item">
                            <span className="property-label">Flexibility:</span>
                            <span className="property-value">{protein.getFlexibility().toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
