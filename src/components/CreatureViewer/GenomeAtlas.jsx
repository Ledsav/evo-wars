import { useState } from 'react';
import { GeneticCode } from '../../core/genetics/GeneticCode.js';
import { TraitCalculator } from '../../core/organisms/TraitCalculator.js';
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
  adhesion: { label: 'Cell adhesion', color: '#4f8177' },
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

const BASE_COLORS = {
  A: '#557f79',
  T: '#a54a3f',
  C: '#687f91',
  G: '#b77a2b'
};

const TRAIT_UNITS = {
  size: 'units',
  mass: 'mass',
  maxSpeed: 'u/tick',
  acceleration: 'u/tick²',
  armor: 'damage',
  toxicity: 'ratio',
  metabolicRate: 'energy/s',
  energyEfficiency: '×',
  reproductionCost: 'energy',
  reproductionThreshold: 'energy',
  visionRange: 'px',
  detectionRadius: 'px',
  aggression: 'ratio',
  cooperativeness: 'ratio',
  cooperationAmount: 'energy',
  adhesion: 'ratio',
  bondStrength: 'ratio',
  energyConductivity: 'ratio',
  bondCapacity: 'links',
  bondMaintenance: 'energy/s'
};

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

function getBaseComposition(sequence) {
  const counts = { A: 0, T: 0, C: 0, G: 0 };
  for (const base of sequence) {
    if (counts[base] !== undefined) counts[base]++;
  }

  return Object.entries(counts).map(([base, count]) => ({
    base,
    count,
    percentage: sequence.length > 0 ? (count / sequence.length) * 100 : 0
  }));
}

function getOpenReadingFrame(codons, sequenceLength) {
  const startIndex = codons.findIndex(codon => codon.isStart);
  if (startIndex < 0) {
    return {
      status: 'No ORF',
      start: null,
      end: null,
      codingBasePairs: 0
    };
  }

  const relativeStopIndex = codons
    .slice(startIndex + 1)
    .findIndex(codon => codon.isStop);
  const stopIndex = relativeStopIndex >= 0
    ? startIndex + relativeStopIndex + 1
    : null;
  const endCodonIndex = stopIndex ?? codons.length - 1;

  return {
    status: stopIndex === null ? 'Open ORF' : 'Complete ORF',
    start: startIndex * 3 + 1,
    end: Math.min((endCodonIndex + 1) * 3, sequenceLength),
    codingBasePairs: stopIndex === null
      ? Math.floor((sequenceLength - startIndex * 3) / 3) * 3
      : Math.max(0, (stopIndex - startIndex) * 3)
  };
}

function getReadingFrames(sequence) {
  return [0, 1, 2].map(offset => {
    const codons = [];

    for (let index = offset; index <= sequence.length - 3; index += 3) {
      const dnaCodon = sequence.slice(index, index + 3);
      const rnaCodon = dnaCodon.replaceAll('T', 'U');
      codons.push({
        dnaCodon,
        aminoAcid: GeneticCode.translateCodon(rnaCodon),
        isStart: GeneticCode.isStartCodon(rnaCodon),
        isStop: GeneticCode.isStopCodon(rnaCodon)
      });
    }

    return { offset, codons };
  });
}

function formatTraitName(name) {
  return name.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function formatTraitValue(value) {
  if (!Number.isFinite(value)) return 'n/a';
  if (Number.isInteger(value)) return String(value);
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function getSpecialPhenotypeOutputs(geneName, phenotype) {
  if (geneName === 'pigmentation') {
    return [
      {
        name: 'Primary hue',
        value: phenotype.color?.h || 0,
        range: '0–360°',
        unit: '°',
        normalized: (phenotype.color?.h || 0) / 360,
        description: 'Charged and aromatic residues determine pigment hue.'
      },
      {
        name: 'Saturation',
        value: phenotype.color?.s || 0,
        range: '0–100%',
        unit: '%',
        normalized: (phenotype.color?.s || 0) / 100,
        description: 'Aromatic and charged residue abundance controls saturation.'
      },
      {
        name: 'Lightness',
        value: phenotype.color?.l || 0,
        range: '0–100%',
        unit: '%',
        normalized: (phenotype.color?.l || 0) / 100,
        description: 'Hydrophilic and hydrophobic balance controls lightness.'
      }
    ];
  }

  if (geneName === 'structure') {
    return [
      {
        name: 'Segments',
        value: phenotype.segments || 1,
        range: '1–4',
        unit: '',
        normalized: ((phenotype.segments || 1) - 1) / 3,
        description: 'Structural protein length determines repeated body segments.'
      },
      {
        name: 'Body plan',
        value: phenotype.visual?.bodyPlan || 'unresolved',
        range: 'categorical',
        unit: '',
        normalized: null,
        description: 'Structural protein sequence selects the expressed body architecture.'
      },
      {
        name: 'Aspect ratio',
        value: phenotype.visual?.aspectRatio || 1,
        range: '1.0–2.3',
        unit: '',
        normalized: ((phenotype.visual?.aspectRatio || 1) - 1) / 1.3,
        description: 'Body plan and locomotion jointly determine elongation.'
      }
    ];
  }

  return [];
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
  const mutationProfile = new Map(
    organism.genome.getMutationProfile().map(gene => [gene.name, gene])
  );
  let locusPosition = 1;
  const loci = geneNames.map((name, index) => {
    const gene = organism.genome.getGene(name);
    const sequence = gene?.dna?.toString() || '';
    const metadata = getLocusMetadata(name, index);
    const start = locusPosition;
    const end = start + Math.max(0, sequence.length - 1);
    locusPosition = end + 1;

    return {
      name,
      gene,
      sequence,
      protein: organism.genome.expressedProteins?.[name],
      length: sequence.length,
      start,
      end,
      ...mutationProfile.get(name),
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
  const baseComposition = getBaseComposition(selectedLocus.sequence);
  const readingFrames = getReadingFrames(selectedLocus.sequence);
  const openReadingFrame = getOpenReadingFrame(codons, selectedLocus.sequence.length);
  const protein = selectedLocus.protein;
  const hasExpressedProtein = (protein?.properties.length || 0) > 0;
  const traitDocumentation = TraitCalculator.getTraitDocumentation();
  const quantitativeOutputs = TraitCalculator
    .getProteinTraitNames(selectedLocus.name)
    .map(traitName => {
      const documentation = traitDocumentation[traitName];
      const value = organism.basePhenotype?.[traitName] ??
        organism.phenotype[traitName];
      if (!documentation || !Number.isFinite(value)) return null;
      const [minimum, maximum] = documentation.expectedRange;

      return {
        name: formatTraitName(traitName),
        value,
        unit: TRAIT_UNITS[traitName] || '',
        range: `${formatTraitValue(minimum)}–${formatTraitValue(maximum)}`,
        normalized: maximum === minimum
          ? 0
          : Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum))),
        description: documentation.description,
        weights: documentation.weights
      };
    })
    .filter(Boolean);
  const phenotypeOutputs = quantitativeOutputs.length > 0
    ? quantitativeOutputs
    : getSpecialPhenotypeOutputs(selectedLocus.name, organism.phenotype);

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
        <div>
          <span>Repair fidelity</span>
          <strong>
            {(organism.genome.getAverageStability() * 100).toFixed(1)}%
          </strong>
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
                title={`${locus.name}: ${locus.length} bp · ${(locus.stability * 100).toFixed(0)}% stable`}
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
                <span className="locus-length">
                  {locus.start}–{locus.end}
                  <small>
                    {locus.length} bp · {(locus.stability * 100).toFixed(0)}% stable
                  </small>
                </span>
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
            <span className="neutral">
              {(selectedLocus.probability * 100).toFixed(1)}% mutation share
            </span>
          </div>
        </div>

        <div className="locus-measurements">
          <div>
            <span>Coordinates</span>
            <strong>{selectedLocus.start}–{selectedLocus.end}</strong>
          </div>
          <div><span>Length</span><strong>{selectedLocus.length} bp</strong></div>
          <div><span>GC content</span><strong>{getGcContent(selectedLocus.sequence).toFixed(1)}%</strong></div>
          <div>
            <span>Repair fidelity</span>
            <strong>{(selectedLocus.stability * 100).toFixed(1)}%</strong>
          </div>
          <div><span>Reading frame</span><strong>{openReadingFrame.status}</strong></div>
          <div><span>Expression</span><strong>{protein?.properties.length || 0} aa</strong></div>
        </div>

        <div className="sequence-qc-grid">
          <section className="base-composition-panel">
            <div className="genome-section-label">Nucleotide composition</div>
            <div className="base-composition-list">
              {baseComposition.map(item => (
                <div className="base-composition-row" key={item.base}>
                  <strong style={{ color: BASE_COLORS[item.base] }}>{item.base}</strong>
                  <div>
                    <i
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: BASE_COLORS[item.base]
                      }}
                    />
                  </div>
                  <span>{item.count} · {item.percentage.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </section>

          <section className="reading-frame-panel">
            <div className="reading-frame-heading">
              <div className="genome-section-label">Forward reading frames</div>
              <span>start / stop assay</span>
            </div>
            <div className="reading-frame-list">
              {readingFrames.map(frame => (
                <div className="reading-frame-row" key={frame.offset}>
                  <strong>+{frame.offset + 1}</strong>
                  <div>
                    {frame.codons.map((codon, index) => (
                      <span
                        key={`${frame.offset}-${index}`}
                        className={[
                          'frame-codon',
                          codon.isStart ? 'start' : '',
                          codon.isStop ? 'stop' : ''
                        ].filter(Boolean).join(' ')}
                        title={`${codon.dnaCodon} → ${codon.aminoAcid}`}
                      >
                        {codon.aminoAcid}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="genetic-sequence-panel">
          <div className="sequence-coordinate-bar">
            <div>
              <div className="genome-section-label">Double-stranded DNA</div>
              <span>
                Chr 1 · {selectedLocus.start}–{selectedLocus.end} bp
              </span>
            </div>
            <strong>
              {openReadingFrame.start
                ? `ORF ${openReadingFrame.start}–${openReadingFrame.end}`
                : 'ORF not detected'}
            </strong>
          </div>
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

        <section className="expression-pathway-panel">
          <div className="expression-pathway-heading">
            <div>
              <div className="genome-section-label">Genotype → phenotype model</div>
              <h5>Expression pathway</h5>
            </div>
            <span>{phenotypeOutputs.length} measured outputs</span>
          </div>

          <div className="expression-flow">
            <div className="expression-node">
              <span>DNA locus</span>
              <strong>{selectedLocus.name}</strong>
              <small>{selectedLocus.start}–{selectedLocus.end} bp</small>
            </div>
            <span className="expression-arrow" aria-hidden="true">→</span>
            <div className="expression-node">
              <span>mRNA / ORF</span>
              <strong>{openReadingFrame.status}</strong>
              <small>{openReadingFrame.codingBasePairs} coding bp</small>
            </div>
            <span className="expression-arrow" aria-hidden="true">→</span>
            <div className="expression-node">
              <span>Polypeptide</span>
              <strong>{protein?.properties.length || 0} aa</strong>
              <small>
                {hasExpressedProtein
                  ? `${protein.getMolecularWeight().toLocaleString()} Da`
                  : 'No product'}
              </small>
            </div>
            <span className="expression-arrow" aria-hidden="true">→</span>
            <div className="expression-node phenotype">
              <span>Phenotype</span>
              <strong>{phenotypeOutputs.length} outputs</strong>
              <small>{selectedLocus.label}</small>
            </div>
          </div>

          {phenotypeOutputs.length > 0 ? (
            <div className="phenotype-output-grid">
              {phenotypeOutputs.map(output => (
                <article className="phenotype-output-card" key={output.name}>
                  <div className="phenotype-output-heading">
                    <span>{output.name}</span>
                    <strong>
                      {typeof output.value === 'number'
                        ? formatTraitValue(output.value)
                        : output.value}
                      {output.unit ? ` ${output.unit}` : ''}
                    </strong>
                  </div>
                  <div className="phenotype-output-range">
                    <span>Expected range</span>
                    <strong>{output.range}</strong>
                  </div>
                  {output.normalized !== null && (
                    <div
                      className="output-meter"
                      role="meter"
                      aria-label={`${output.name} position in expected range`}
                      aria-valuemin="0"
                      aria-valuemax="100"
                      aria-valuenow={Math.round(output.normalized * 100)}
                    >
                      <i style={{ width: `${output.normalized * 100}%` }} />
                    </div>
                  )}
                  {output.weights && (
                    <div className="output-weights">
                      {Object.entries(output.weights).map(([property, weight]) => (
                        <span key={property}>
                          {formatTraitName(property)} × {weight}
                        </span>
                      ))}
                    </div>
                  )}
                  <p>{output.description}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="no-expression">
              No direct quantitative phenotype rule is registered for this locus.
            </p>
          )}
        </section>
      </article>
    </section>
  );
}
