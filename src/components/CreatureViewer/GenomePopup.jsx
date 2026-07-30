import { createPortal } from 'react-dom';
import { CloseIcon, DNAIcon } from '../shared/Icons/Icons';
import { GenomeAtlas } from './GenomeAtlas';
import { RadarChart } from './RadarChart';

function GenomeError({ title, message, onClose }) {
  return createPortal(
    <div className="genome-popup-overlay" onClick={onClose}>
      <div className="genome-popup" onClick={(event) => event.stopPropagation()}>
        <div className="genome-popup-header">
          <div className="genome-popup-title">
            <DNAIcon size={24} />
            <div>
              <span className="eyebrow">Sequence error</span>
              <h2>{title}</h2>
            </div>
          </div>
          <button className="genome-popup-close" onClick={onClose} aria-label="Close">
            <CloseIcon size={24} />
          </button>
        </div>
        <div className="genome-popup-content">
          <div className="genome-error-record">{message}</div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * GenomePopup - Genetic architecture and expression viewer.
 */
export function GenomePopup({ organism, onClose }) {
  if (!organism) return null;

  if (!organism.genome || typeof organism.genome.getGeneNames !== 'function') {
    return (
      <GenomeError
        title="No genome data"
        message="This specimen has no readable genome attached to its record."
        onClose={onClose}
      />
    );
  }

  const genes = organism.genome.getGeneNames();
  if (genes.length === 0) {
    return (
      <GenomeError
        title="No annotated loci"
        message="This specimen's genome contains no annotated genes."
        onClose={onClose}
      />
    );
  }

  const speciesInfo = typeof organism.getSpeciesInfo === 'function'
    ? organism.getSpeciesInfo()
    : null;

  return createPortal(
    <div className="genome-popup-overlay" onClick={onClose}>
      <div className="genome-popup" onClick={(event) => event.stopPropagation()}>
        <div className="genome-popup-header">
          <div className="genome-popup-title">
            <DNAIcon size={24} />
            <div>
              <span className="eyebrow">Genetic assay</span>
              <h2>
                {speciesInfo
                  ? `${speciesInfo.code} · ${speciesInfo.name}`
                  : `Species ${organism.speciesFounderId ?? organism.id}`}
              </h2>
            </div>
          </div>
          <button className="genome-popup-close" onClick={onClose} aria-label="Close">
            <CloseIcon size={24} />
          </button>
        </div>

        <div className="genome-popup-content">
          <GenomeAtlas organism={organism} />

          <section className="phenotype-expression-section">
            <div className="phenotype-expression-heading">
              <div>
                <span className="eyebrow">Downstream expression</span>
                <h3>Phenotypic output</h3>
              </div>
              <div className="expression-specimen-data">
                <span>Age {((organism.age || 0) / 1000).toFixed(1)}s</span>
                <span>Energy {(organism.energy || 0).toFixed(1)}</span>
                <span>Lineage {organism.speciesFounderId}</span>
              </div>
            </div>
            <RadarChart organism={organism} />
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}
