import { useState } from 'react';
import { MutationFactory } from '../core/genetics/mutations/Mutation';

/**
 * DNAEditor - Component for editing organism DNA
 */
export function DNAEditor({ organism, onMutate }) {
  const [selectedGene, setSelectedGene] = useState(null);
  const [mutationType, setMutationType] = useState('point');
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);

  if (!organism || !organism.isAlive) {
    return (
      <div className="dna-editor">
        <div className="alert">No organism selected or organism is dead</div>
      </div>
    );
  }

  const genome = organism.genome;
  const geneNames = genome.getGeneNames();
  const mutationTypes = MutationFactory.getAllTypes();

  const handleBaseClick = (geneName, position) => {
    const mutation = MutationFactory.createMutation(mutationType);

    // Check DNA points
    if (organism.dnaPoints < mutation.cost) {
      alert(`Not enough DNA points! Need ${mutation.cost}, have ${organism.dnaPoints.toFixed(1)}`);
      return;
    }

    if (mutationType === 'inversion') {
      if (selectionStart === null) {
        setSelectionStart(position);
        setSelectedGene(geneName);
      } else if (selectedGene === geneName) {
        // Apply inversion
        const result = genome.mutateGene(
          geneName,
          mutationType,
          Math.min(selectionStart, position),
          { endPosition: Math.max(selectionStart, position) }
        );

        if (result.success) {
          organism.dnaPoints -= result.cost;
          organism.expressGenome();
          if (onMutate) onMutate(result);
        }

        setSelectionStart(null);
        setSelectionEnd(null);
        setSelectedGene(null);
      }
    } else {
      // Apply mutation immediately
      const result = genome.mutateGene(geneName, mutationType, position);

      if (result.success) {
        organism.dnaPoints -= result.cost;
        organism.expressGenome();
        if (onMutate) onMutate(result);
      } else {
        alert(`Mutation failed: ${result.error}`);
      }

      setSelectionStart(null);
      setSelectedGene(null);
    }
  };

  return (
    <div className="dna-editor">
      <div className="dna-header">
        <h2>DNA Editor</h2>
        <div className="dna-points">
          DNA Points: <span className="value">{organism.dnaPoints.toFixed(1)}</span>
        </div>
      </div>

      <div className="mutation-selector">
        {mutationTypes.map(type => {
          const mutation = MutationFactory.createMutation(type);
          return (
            <button
              key={type}
              className={`mutation-btn ${mutationType === type ? 'active' : ''}`}
              onClick={() => {
                setMutationType(type);
                setSelectionStart(null);
                setSelectionEnd(null);
                setSelectedGene(null);
              }}
            >
              <span className="mutation-name">{type}</span>
              <span className="mutation-cost">{mutation.cost}</span>
            </button>
          );
        })}
      </div>

      <div className="genes-container">
        {geneNames.map(geneName => {
          const gene = genome.getGene(geneName);
          const protein = genome.expressedProteins[geneName];
          const dnaSequence = gene.toString();

          return (
            <div key={geneName} className="gene-panel">
              <div className="gene-header">
                <h3>{geneName}</h3>
                {protein && (
                  <span className="protein-info">
                    Protein: {protein.sequence.substring(0, 20)}
                    {protein.sequence.length > 20 ? '...' : ''}
                  </span>
                )}
              </div>

              <div className="dna-sequence">
                {dnaSequence.split('').map((base, index) => {
                  const isSelected =
                    selectedGene === geneName &&
                    selectionStart !== null &&
                    index === selectionStart;

                  return (
                    <button
                      key={index}
                      className={`base base-${base} ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleBaseClick(geneName, index)}
                      title={`Position ${index}: ${base}`}
                    >
                      {base}
                    </button>
                  );
                })}
              </div>

              {protein && (
                <div className="protein-stats">
                  <span>Length: {protein.properties.length}</span>
                  <span>Hydrophobic: {protein.properties.hydrophobic}</span>
                  <span>Charged: {protein.properties.positive + protein.properties.negative}</span>
                  <span>Aromatic: {protein.properties.aromatic}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
