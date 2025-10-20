# Evo Wars Analysis

Python-based analysis toolkit for Evo Wars simulation statistics.

## Overview

This subfolder contains tools and notebooks for analyzing data exported from the Evo Wars evolutionary simulation. The analysis focuses on:

- **Population Dynamics**: Track organism counts, birth/death rates, and growth patterns
- **Trait Evolution**: Analyze how speed, size, and sensing range evolve over time
- **Species Analysis**: Study speciation events and biodiversity metrics
- **Environmental Impact**: Correlate environment settings with simulation outcomes

## Setup

### 1. Create a Virtual Environment

```bash
# Navigate to the analysis directory
cd analysis

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Launch Jupyter

```bash
jupyter notebook
```

This will open Jupyter in your browser. Navigate to `notebooks/starter_analysis.ipynb` to get started.

## Exporting Data from the Simulation

To analyze your simulation data, you need to export it from the web application:

### Method 1: Manual Export (Current)

1. Run your Evo Wars simulation in the browser
2. Open browser developer console (F12)
3. Run this command to export statistics:

```javascript
// Get statistics from localStorage
const stats = JSON.parse(localStorage.getItem('evoWarsStatistics'));

// Convert to JSON and download
const dataStr = JSON.stringify(stats, null, 2);
const dataBlob = new Blob([dataStr], {type: 'application/json'});
const url = URL.createObjectURL(dataBlob);
const link = document.createElement('a');
link.href = url;
link.download = 'simulation_data.json';
link.click();
```

4. Save the downloaded file to `analysis/data/simulation_data.json`

### Method 2: Future Enhancement

Consider adding an "Export Statistics" button in the UI that downloads the data automatically.

## Project Structure

```
analysis/
├── README.md                    # This file
├── requirements.txt             # Python dependencies
├── notebooks/                   # Jupyter notebooks
│   └── starter_analysis.ipynb  # Comprehensive analysis notebook
├── scripts/                     # Reusable Python utilities
│   └── data_loader.py          # Data loading helper functions
└── data/                        # Exported simulation data
    └── .gitkeep
```

## Using the Data Loader

The `data_loader.py` utility provides convenient functions for loading and processing simulation data:

```python
from scripts.data_loader import load_simulation

# Load all data from a file
data = load_simulation('simulation_data.json')

# Access DataFrames
df_population = data['population']
df_traits = data['traits']
df_species = data['species']
environment = data['environment']

# Quick exploration
print(df_population.head())
print(df_traits.describe())
```

## Example Analysis Workflow

1. Run a simulation in the browser with specific environment settings
2. Export the statistics data to `data/my_experiment.json`
3. Open `notebooks/starter_analysis.ipynb`
4. Update the filename in the notebook: `FILENAME = 'my_experiment.json'`
5. Run the notebook cells to generate visualizations and insights
6. Experiment with custom analysis in the "Custom Analysis" section

## Notebook Features

The starter notebook includes:

- **Data Loading**: Automatic parsing of exported JSON statistics
- **Population Analysis**:
  - Time series plots of population size
  - Birth and death rate tracking
  - Growth rate calculations
- **Trait Evolution**:
  - Mean trait values over time with standard deviation bands
  - Trait correlation analysis
  - Interactive visualizations
- **Species Diversity**:
  - Species count tracking
  - Diversity index calculations
  - Detection of major speciation/extinction events
- **Interactive Dashboards**:
  - Plotly-based interactive charts
  - Multi-panel overview dashboard
  - Exportable figures

## Tips for Analysis

### Comparing Multiple Simulations

To compare different environment settings or runs:

```python
# Load multiple simulations
sim1 = load_simulation('high_mutation.json')
sim2 = load_simulation('low_mutation.json')

# Compare population trends
plt.plot(sim1['population']['step'], sim1['population']['total_population'], label='High Mutation')
plt.plot(sim2['population']['step'], sim2['population']['total_population'], label='Low Mutation')
plt.legend()
plt.show()
```

### Long-running Simulations

For very long simulations, consider downsampling the data:

```python
# Sample every 10th step
df_sampled = df_population[::10]
```

### Saving Results

Export processed data or figures for reports:

```python
# Save processed DataFrame
df_population.to_csv('processed_population.csv', index=False)

# Save matplotlib figure
plt.savefig('population_trend.png', dpi=300, bbox_inches='tight')

# Save Plotly figure as HTML
fig.write_html('interactive_dashboard.html')
```

## Troubleshooting

### ModuleNotFoundError

Make sure you've activated the virtual environment and installed dependencies:

```bash
venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### File Not Found

Check that your data file is in the `data/` directory and the filename matches what's in the notebook.

### Kernel Issues

If Jupyter can't find the kernel:

```bash
python -m ipykernel install --user --name=evo-wars-analysis
```

## Next Steps

- Add more analysis notebooks for specific research questions
- Create reusable plotting functions in `scripts/`
- Implement statistical tests for comparing simulations
- Build a report generator that summarizes multiple runs
- Add phylogenetic tree visualization for species evolution

## Dependencies

Main libraries used:

- **pandas**: Data manipulation and analysis
- **numpy**: Numerical computing
- **matplotlib**: Static visualizations
- **seaborn**: Statistical data visualization
- **plotly**: Interactive plots and dashboards
- **bokeh**: Interactive web-based visualizations
- **jupyter**: Interactive notebooks
- **scipy**: Scientific computing and statistics

## Contributing

When adding new analysis:

1. Create a new notebook in `notebooks/` with a descriptive name
2. Document your analysis approach in markdown cells
3. Add any new utility functions to `scripts/`
4. Update this README with new features
5. Update `requirements.txt` if you add new dependencies

## License

Same as the parent Evo Wars project.
