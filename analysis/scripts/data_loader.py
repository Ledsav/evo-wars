"""
Data loader utilities for Evo Wars simulation statistics.

This module provides helper functions to load and process exported
statistics data from the Evo Wars simulation.
"""

import json
import pandas as pd
from pathlib import Path
from typing import Dict, List, Optional


class SimulationDataLoader:
    """Load and process Evo Wars simulation statistics."""

    def __init__(self, data_dir: str = "../data"):
        """
        Initialize the data loader.

        Args:
            data_dir: Path to the directory containing exported data files
        """
        self.data_dir = Path(data_dir)

    def load_statistics(self, filename: str) -> Dict:
        """
        Load statistics from a JSON file.

        Args:
            filename: Name of the JSON file to load

        Returns:
            Dictionary containing the statistics data
        """
        filepath = self.data_dir / filename
        with open(filepath, 'r') as f:
            return json.load(f)

    def to_population_dataframe(self, stats: Dict) -> pd.DataFrame:
        """
        Convert population statistics to a pandas DataFrame.

        Args:
            stats: Statistics dictionary from load_statistics()

        Returns:
            DataFrame with columns: time, alive_organisms, food_count, average_energy
        """
        if 'data' not in stats:
            raise ValueError("No data found in statistics")

        data = stats['data']

        records = []
        for i, time in enumerate(data.get('time', [])):
            record = {
                'time': time,
                'alive_organisms': data.get('aliveOrganisms', [])[i] if i < len(data.get('aliveOrganisms', [])) else None,
                'food_count': data.get('foodCount', [])[i] if i < len(data.get('foodCount', [])) else None,
                'average_energy': data.get('averageEnergy', [])[i] if i < len(data.get('averageEnergy', [])) else None,
            }
            records.append(record)

        df = pd.DataFrame(records)
        # Add step as index
        df['step'] = range(len(df))
        return df

    def to_species_dataframe(self, stats: Dict) -> pd.DataFrame:
        """
        Convert species diversity data to a pandas DataFrame.

        Args:
            stats: Statistics dictionary from load_statistics()

        Returns:
            DataFrame with columns: time, species_count, top_species_count
        """
        if 'data' not in stats:
            raise ValueError("No data found in statistics")

        data = stats['data']

        records = []
        for i, time in enumerate(data.get('time', [])):
            record = {
                'time': time,
                'species_count': data.get('speciesCount', [])[i] if i < len(data.get('speciesCount', [])) else None,
                'top_species_count': data.get('topSpeciesCount', [])[i] if i < len(data.get('topSpeciesCount', [])) else None,
            }
            records.append(record)

        df = pd.DataFrame(records)
        df['step'] = range(len(df))
        return df

    def to_interactions_dataframe(self, stats: Dict) -> pd.DataFrame:
        """
        Convert interaction data to a pandas DataFrame.

        Args:
            stats: Statistics dictionary from load_statistics()

        Returns:
            DataFrame with columns: time, combat_kills, cooperation_events
        """
        if 'data' not in stats:
            raise ValueError("No data found in statistics")

        data = stats['data']

        records = []
        for i, time in enumerate(data.get('time', [])):
            record = {
                'time': time,
                'combat_kills': data.get('combatKills', [])[i] if i < len(data.get('combatKills', [])) else None,
                'cooperation_events': data.get('cooperationEvents', [])[i] if i < len(data.get('cooperationEvents', [])) else None,
                'average_genome_length': data.get('averageGenomeLength', [])[i] if i < len(data.get('averageGenomeLength', [])) else None,
            }
            records.append(record)

        df = pd.DataFrame(records)
        df['step'] = range(len(df))
        return df

    def get_metadata(self, stats: Dict) -> Dict:
        """
        Extract metadata from statistics.

        Args:
            stats: Statistics dictionary from load_statistics()

        Returns:
            Dictionary of metadata
        """
        return stats.get('metadata', {})

    def load_all_data(self, filename: str) -> Dict:
        """
        Load all statistics from a file into DataFrames.

        Args:
            filename: Name of the JSON file to load

        Returns:
            Dictionary with keys 'population', 'species', 'interactions', 'metadata'
            and DataFrame/dict values
        """
        stats = self.load_statistics(filename)

        result = {}

        try:
            result['population'] = self.to_population_dataframe(stats)
        except (ValueError, KeyError, IndexError) as e:
            print(f"Warning: Could not load population data: {e}")
            result['population'] = pd.DataFrame()

        try:
            result['species'] = self.to_species_dataframe(stats)
        except (ValueError, KeyError, IndexError) as e:
            print(f"Warning: Could not load species data: {e}")
            result['species'] = pd.DataFrame()

        try:
            result['interactions'] = self.to_interactions_dataframe(stats)
        except (ValueError, KeyError, IndexError) as e:
            print(f"Warning: Could not load interactions data: {e}")
            result['interactions'] = pd.DataFrame()

        result['metadata'] = self.get_metadata(stats)

        return result


# Convenience functions for quick loading
def load_simulation(filename: str, data_dir: str = "../data") -> Dict:
    """
    Quick loader for simulation data.

    Args:
        filename: Name of the JSON file to load
        data_dir: Path to data directory (default: ../data)

    Returns:
        Dictionary of DataFrames with simulation data
    """
    loader = SimulationDataLoader(data_dir)
    return loader.load_all_data(filename)


if __name__ == "__main__":
    # Example usage
    print("Data loader utilities loaded successfully!")
    print("\nExample usage:")
    print("  from data_loader import load_simulation")
    print("  data = load_simulation('my_simulation.json')")
    print("  print(data['population'].head())")
