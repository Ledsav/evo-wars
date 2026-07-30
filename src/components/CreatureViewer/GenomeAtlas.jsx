import { useState } from 'react';
import { GeneticCode } from '../../core/genetics/GeneticCode.js';
import './GenomeAtlas.css';

const LOCUS_METADATA = {
  size: { label: 'Body scale', color: '#557f79' },
  speed: { label: 'Locomotion', color: '#687f91' },
  defense: { label: 'Defense', color: '#756c83' },
  metabolism: { label: 'Metabolism', color: '#a18448' },
  reproduction: { label: 'Replication', color: '#a66e48' },
  sensory: { label: 'Sensory array', color: '#5f7c7f' },
  aggression: { label: 'Aggression', color: '#a54a3f' },
  cooperation: { label: 'Cooperation', color: '#71845f' },
  pigmentation: { label: 'Pigmentation', color: '#8b6f83' },
  structure: { label: 'Morphology', color: '#7b7458' }
};

const COMPLEMENT = {
  A: 'T',
  T: 'A',
  C: 'G',
  G: 'C'
};

const PROTEIN_PROPERTIES = [
  ['Hydrophobic', 'hydrophobicRatio'],
  ['Hydrophilic', 'hydrophilicRatio'],
  ['Polar', 'polarRatio'],
  ['Aromatic', 'aromaticRatio']
];

function getLocusMetadata(name, index) {
  return LOCUS_METADATA[name] || {
    label: 'Unclassified locus',
    color: ['#557f79', '#687f91', '#756c83', '#a18448'][index % 4]
  };
}

function getGcContent(sequence) {
  if (!sequence.length) return 0;
  const gcBases = sequence.split('').filter(base => base === 'G' || base === 'C').length;
  return (gcBases / sequence.length) * 100;
}

function getComplement(sequence) {
  return sequence
    .split('')
    .map(base => COMPLEMENT[base] || 'N')
    .join('');
}

function getCodons(sequence) {
  return sequence.match(/.{1,3}/g)?.map((codon, index) => {
    const rnaCodon = codon.replaceAll('T', 'U');
    const aminoAcid = codon.length === 3
      ? GeneticCode.translateCodon(rnaCodon)
      : '?';

    return {
      index,
      codon,
      aminoAcid,
      isStart: rnaCodon === GeneticCode.START_CODON,
      isStop: GeneticCode.STOP_CODONS.includes(rnaCodon),
      isPartial: codon.length !== 3
    };
  }) || [];
}

function BaseSequence({ sequence }) {
  return sequence.split('').map((base, index) => (
    <span key={`${index}-${base}`} className={`genetic-base base-${base.toLowerCase()}`}>
      {base}
    </span>
  ));
}

function GenomeRing({ loci, totalBasePairs, selectedGene, onSelect }) {
  let offset = 0;

  return (
    <div className="genome-ring-wrap">
      <svg
        className="genome-ring"
        viewBox="0 0 240 240"
        role="img"
        aria-label={`Circular genome map containing ${loci.length} genes`}
      >
        <circle className="genome-ring-guide" cx="120" cy="120" r="86" />
        {loci.map((locus) => {
          const percentage = totalBasePairs > 0
            ? (locus.length / totalBasePairs) * 100
            : 0;
          const dashOffset = -offset;
          offset += percentage;

          return (
            <circle
              key={locus.name}
              className={`genome-ring-locus ${selectedGene === locus.name ? 'selected' : ''}`}
              cx="120"
              cy="120"
              r="86"
              pathLength="100"
              stroke={locus.color}
              strokeDasharray={`${Math.max(0, percentage - 0.7)} ${100 - Math.max(0, percentage - 0.7)}`}
              strokeDashoffset={dashOffset}
              onClick={() => onSelect(locus.name)}
            >
              <title>{`${locus.name}: ${locus.length} base pairs`}</title>
            </circle>
          );
        })}
        <circle className="genome-ring-core" cx="120" cy="120" r="58" />
        <text className="genome-ring-value" x="120" y="114" textAnchor="middle">
          {totalBasePairs}
        </text>
        <text className="genome-ring-unit" x="120" y="134" textAnchor="middle">
          base pairs
        </text>
      </svg>
      <span className="genome-ring-caption">Circular chromosome model</span>
    </div>
  );
}

export function GenomeAtlas({ organism }) {
  const geneNames = organism.genome.getGeneNames();
  const [selectedGeneName, setSelectedGeneName] = useState(geneNames[0]);
  const loci = geneNames.map((name, index) => {
    const gene = organism.genome.getGene(name);
    const sequence = gene?.dna?.toString() || '';
    const metadata = getLocusMetadata(name, index);

    return {
      name,
      gene,
      sequence,
      protein: organism.genome.expressedProteins?.[name],
      length: sequence.length,
      ...metadata
    };
  });
  const selectedLocus =
    loci.find(locus => locus.name === selectedGeneName) || loci[0];
  const totalBasePairs = loci.reduce((total, locus) => total + locus.length, 0);
  const totalAminoAcids = loci.reduce(
    (total, locus) => total + (locus.protein?.properties?.length || 0),
    0
  );
  const fullSequence = loci.map(locus => locus.sequence).join('');
  const validGenes = loci.filter(locus => locus.gene?.isValid()).length;
  const codons = getCodons(selectedLocus.sequence);
  const complement = getComplement(selectedLocus.sequence);
  const protein = selectedLocus.protein;
  const hasExpressedProtein = (protein?.properties.length || 0) > 0;

  return (
    <section className="genome-atlas">
      <div className="genome-atlas-heading">
        <div>
          <span className="eyebrow">Genomic architecture</span>
          <h3>Chromosome atlas</h3>
        </div>
        <span className="genome-accession">
          ORG-{String(organism.id).padStart(5, '0')}
        </span>
      </div>

      <div className="genome-summary-strip">
        <div>
          <span>Genome size</span>
          <strong>{totalBasePairs} bp</strong>
        </div>
        <div>
          <span>Annotated loci</span>
          <strong>{loci.length}</strong>
        </div>
        <div>
          <span>GC content</span>
          <strong>{getGcContent(fullSequence).toFixed(1)}%</strong>
        </div>
        <div>
          <span>Coding yield</span>
          <strong>{totalAminoAcids} aa</strong>
        </div>
        <div>
          <span>Valid genes</span>
          <strong>{validGenes}/{loci.length}</strong>
        </div>
      </div>

      <div className="genome-map-panel">
        <GenomeRing
          loci={loci}
          totalBasePairs={totalBasePairs}
          selectedGene={selectedLocus.name}
          onSelect={setSelectedGeneName}
        />

        <div className="genome-loci-panel">
          <div className="genome-section-label">Locus map</div>
          <div className="genome-linear-map" aria-label="Linear genome map">
            {loci.map(locus => (
              <button
                key={locus.name}
                className={`genome-linear-locus ${selectedLocus.name === locus.name ? 'selected' : ''}`}
                style={{
                  '--locus-color': locus.color,
                  flexGrow: Math.max(1, locus.length)
                }}
                onClick={() => setSelectedGeneName(locus.name)}
                title={`${locus.name}: ${locus.length} bp`}
              >
                <span>{locus.name.slice(0, 3).toUpperCase()}</span>
              </button>
            ))}
          </div>

          <div className="locus-index">
            {loci.map((locus, index) => (
              <button
                key={locus.name}
                className={`locus-index-item ${selectedLocus.name === locus.name ? 'selected' : ''}`}
                onClick={() => setSelectedGeneName(locus.name)}
              >
                <span
                  className="locus-color"
                  style={{ backgroundColor: locus.color }}
                />
                <span className="locus-number">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span>
                  <strong>{locus.name}</strong>
                  <small>{locus.label}</small>
                </span>
                <span className="locus-length">{locus.length} bp</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <article className="gene-workbench">
        <div className="gene-workbench-header">
          <div>
            <span className="eyebrow">Selected locus</span>
            <h4>{selectedLocus.name}</h4>
            <p>{selectedLocus.label}</p>
          </div>
          <div className="gene-statuses">
            <span className={selectedLocus.gene.hasStartCodon() ? 'valid' : 'invalid'}>
              {selectedLocus.gene.hasStartCodon() ? 'Start detected' : 'Start missing'}
            </span>
            <span className={selectedLocus.gene.hasStopCodon() ? 'valid' : 'invalid'}>
              {selectedLocus.gene.hasStopCodon() ? 'Stop detected' : 'Stop missing'}
            </span>
          </div>
        </div>

        <div className="locus-measurements">
          <div><span>Length</span><strong>{selectedLocus.length} bp</strong></div>
          <div><span>GC content</span><strong>{getGcContent(selectedLocus.sequence).toFixed(1)}%</strong></div>
          <div><span>Codons</span><strong>{Math.ceil(selectedLocus.length / 3)}</strong></div>
          <div><span>Expression</span><strong>{protein?.properties.length || 0} aa</strong></div>
        </div>

        <div className="genetic-sequence-panel">
          <div className="genome-section-label">Double-stranded DNA</div>
          <div className="strand-row">
            <span className="strand-direction">5′</span>
            <div className="base-sequence"><BaseSequence sequence={selectedLocus.sequence} /></div>
            <span className="strand-direction">3′</span>
          </div>
          <div className="base-pair-guides" aria-hidden="true">
            {selectedLocus.sequence.split('').map((_, index) => <i key={index} />)}
          </div>
          <div className="strand-row complement">
            <span className="strand-direction">3′</span>
            <div className="base-sequence"><BaseSequence sequence={complement} /></div>
            <span className="strand-direction">5′</span>
          </div>
        </div>

        <div className="translation-panel">
          <div className="translation-heading">
            <div>
              <div className="genome-section-label">Codon translation</div>
              <span>DNA → mRNA → amino acid</span>
            </div>
            <div className="translation-legend">
              <span className="start">Start</span>
              <span className="stop">Stop</span>
            </div>
          </div>
          <div className="codon-ribbon">
            {codons.map(codon => (
              <div
                key={`${codon.index}-${codon.codon}`}
                className={[
                  'codon-token',
                  codon.isStart ? 'start' : '',
                  codon.isStop ? 'stop' : '',
                  codon.isPartial ? 'partial' : ''
                ].filter(Boolean).join(' ')}
                title={`Codon ${codon.index + 1}`}
              >
                <span>{codon.codon}</span>
                <i>{codon.codon.replaceAll('T', 'U')}</i>
                <strong>{codon.aminoAcid}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="protein-analysis">
          <div className="protein-analysis-header">
            <div>
              <div className="genome-section-label">Expressed protein</div>
              <strong>{protein?.sequence || 'No translated product'}</strong>
            </div>
            {hasExpressedProtein && (
              <span>
                {protein.getMolecularWeight().toLocaleString()} Da · charge {protein.getCharge()}
              </span>
            )}
          </div>

          {hasExpressedProtein ? (
            <div className="protein-chemistry">
              {PROTEIN_PROPERTIES.map(([label, property]) => {
                const value = Math.max(0, Math.min(1, protein.properties[property] || 0));
                return (
                  <div key={property} className="chemistry-row">
                    <span>{label}</span>
                    <div><i style={{ width: `${value * 100}%` }} /></div>
                    <strong>{Math.round(value * 100)}%</strong>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="no-expression">No viable protein was expressed from this locus.</p>
          )}
        </div>
      </article>
    </section>
  );
}
