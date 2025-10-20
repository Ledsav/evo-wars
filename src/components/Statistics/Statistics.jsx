import { useEffect, useRef, useState } from 'react';
import './Statistics.css';

/**
 * Format elapsed time (seconds) into a human-readable string
 */
function formatElapsedTime(seconds) {
  if (seconds < 60) {
    return Math.floor(seconds) + 's';
  }
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return minutes + 'm';
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return hours + 'h';
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return days + 'd ' + hours + 'h';
}

/**
 * LineChart - Lightweight canvas-based line chart component
 */
function LineChart({ data, lines, width = 400, height = 200, title }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.time.length === 0) return;

    const ctx = canvas.getContext('2d');
    const padding = { top: 30, right: 20, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    
    ctx.clearRect(0, 0, width, height);

    
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, 20);

    
    const timeValues = data.time;
    const minTime = timeValues[0] || 0;
    const maxTime = timeValues[timeValues.length - 1] || 1;
    const timeRange = maxTime - minTime || 1;

    
    let minY = Infinity;
    let maxY = -Infinity;

    for (const line of lines) {
      if (!line.enabled) continue;
      const values = data[line.key];
      if (values && values.length > 0) {
        minY = Math.min(minY, ...values);
        maxY = Math.max(maxY, ...values);
      }
    }

    
    if (minY === Infinity) minY = 0;
    if (maxY === -Infinity) maxY = 1;
    if (minY === maxY) {
      minY = Math.max(0, minY - 1);
      maxY = maxY + 1;
    }

    const yRange = maxY - minY;

    
    const scaleX = (time) => padding.left + ((time - minTime) / timeRange) * chartWidth;
    const scaleY = (value) => padding.top + chartHeight - ((value - minY) / yRange) * chartHeight;

    
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;

    
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const y = padding.top + (chartHeight / ySteps) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();

      
      const value = maxY - (yRange / ySteps) * i;
      ctx.fillStyle = '#888888';
      ctx.font = '11px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(value.toFixed(0), padding.left - 10, y + 4);
    }


    const xSteps = 5;
    for (let i = 0; i <= xSteps; i++) {
      const x = padding.left + (chartWidth / xSteps) * i;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + chartHeight);
      ctx.stroke();


      const time = minTime + (timeRange / xSteps) * i;
      ctx.fillStyle = '#888888';
      ctx.font = '11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(formatElapsedTime(time), x, height - 10);
    }

    
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
    ctx.stroke();

    
    for (const line of lines) {
      if (!line.enabled) continue;

      const values = data[line.key];
      if (!values || values.length === 0) continue;

      ctx.strokeStyle = line.color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      for (let i = 0; i < values.length; i++) {
        const x = scaleX(timeValues[i]);
        const y = scaleY(values[i]);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    }

    
    ctx.font = '12px system-ui';
    ctx.textAlign = 'left';
    let legendY = padding.top + 5;

    for (const line of lines) {
      if (!line.enabled) continue;

      
      ctx.fillStyle = line.color;
      ctx.fillRect(padding.left + chartWidth + 5, legendY - 8, 12, 12);

      
      ctx.fillStyle = '#ffffff';
      ctx.fillText(line.label, padding.left + chartWidth + 22, legendY + 2);
      legendY += 18;
    }

  }, [data, lines, width, height, title]);

  return <canvas ref={canvasRef} width={width} height={height} className="statistics-chart" />;
}

/**
 * Statistics - Display simulation statistics with time-series charts
 */
export function Statistics({ statsTracker, onUpdateSampleFrequency }) {
  // Initialize from statsTracker's current value (which may be loaded from storage)
  const [sampleFrequency, setSampleFrequency] = useState(() => {
    return statsTracker.sampleFrequency * 100; // Convert to percentage
  });


  const data = statsTracker.getData();
  const latest = statsTracker.getLatestValues();
  const dataPoints = statsTracker.getDataPointCount();

  const handleFrequencyChange = (e) => {
    const value = parseFloat(e.target.value);
    setSampleFrequency(value);
    onUpdateSampleFrequency(value / 100);
  };


  
  const organismsLines = [
    { key: 'aliveOrganisms', label: 'Organisms', color: '#4CAF50', enabled: true },
  ];

  const speciesLines = [
    { key: 'speciesCount', label: 'Species', color: '#2196F3', enabled: true },
  ];

  const topSpeciesLines = [
    { key: 'topSpeciesCount', label: 'Top Species', color: '#FF9800', enabled: true },
  ];

  const resourceLines = [
    { key: 'foodCount', label: 'Food', color: '#8BC34A', enabled: true },
  ];

  const energyLines = [
    { key: 'averageEnergy', label: 'Avg Energy', color: '#FFC107', enabled: true },
  ];

  const combatLines = [
    { key: 'combatKills', label: 'Combat Kills', color: '#F44336', enabled: true },
  ];

  const cooperationLines = [
    { key: 'cooperationEvents', label: 'Cooperation Events', color: '#9C27B0', enabled: true },
  ];

  const genomeLines = [
    { key: 'averageGenomeLength', label: 'Avg Genome Length', color: '#00BCD4', enabled: true },
  ];

  return (
    <div className="statistics">
      <h2>Simulation Statistics</h2>

      {/* Current values */}
      <div className="stats-summary">
        <div className="stat-card">
          <div className="stat-label">Organisms</div>
          <div className="stat-value">{latest.aliveOrganisms}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Species</div>
          <div className="stat-value">{latest.speciesCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Top Species</div>
          <div className="stat-value">{latest.topSpeciesCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Food</div>
          <div className="stat-value">{latest.foodCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Combat Kills</div>
          <div className="stat-value">{latest.combatKills}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Cooperation Events</div>
          <div className="stat-value">{latest.cooperationEvents}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Genome Length</div>
          <div className="stat-value">{latest.averageGenomeLength.toFixed(1)}</div>
        </div>
      </div>

      {/* Sampling controls */}
      <div className="stats-controls">
        <label className="control-label">
          Sample Frequency: {sampleFrequency}% ({dataPoints} points)
          <input
            type="range"
            min="0.1"
            max="5"
            step="0.1"
            value={sampleFrequency}
            onChange={handleFrequencyChange}
            className="slider"
          />
          <div className="control-hint">
            Lower = better performance, Higher = more detail (0.1% - 5% range)
          </div>
        </label>

        {/* Export controls */}
        <div className="export-controls">
          <div className="export-label">Export Data:</div>
          <button
            className="export-button"
            onClick={() => statsTracker.downloadData('json')}
            disabled={dataPoints === 0}
            title="Download statistics as JSON file"
          >
            📥 JSON
          </button>
          <button
            className="export-button"
            onClick={() => statsTracker.downloadData('csv')}
            disabled={dataPoints === 0}
            title="Download statistics as CSV file (Excel compatible)"
          >
            📊 CSV
          </button>
          <button
            className="export-button"
            onClick={() => {
              const summary = statsTracker.getSummary();
              console.log('Statistics Summary:', summary);
              alert('Summary logged to console. Press F12 to view.');
            }}
            disabled={dataPoints === 0}
            title="View statistical summary in console"
          >
            📈 Summary
          </button>
        </div>
      </div>

      {/* Charts */}
      {data.time.length > 0 ? (
        <div className="charts-container">
          <LineChart
            data={data}
            lines={organismsLines}
            width={450}
            height={220}
            title="Total Organisms Over Time"
          />
          <LineChart
            data={data}
            lines={speciesLines}
            width={450}
            height={220}
            title="Species Count Over Time"
          />
          <LineChart
            data={data}
            lines={topSpeciesLines}
            width={450}
            height={220}
            title="Top Species Population Over Time"
          />
          <LineChart
            data={data}
            lines={resourceLines}
            width={450}
            height={220}
            title="Food Particles Over Time"
          />
          <LineChart
            data={data}
            lines={energyLines}
            width={450}
            height={220}
            title="Average Energy Over Time"
          />
          <LineChart
            data={data}
            lines={combatLines}
            width={450}
            height={220}
            title="Combat Kills Over Time"
          />
          <LineChart
            data={data}
            lines={cooperationLines}
            width={450}
            height={220}
            title="Cooperation Events Over Time"
          />
          <LineChart
            data={data}
            lines={genomeLines}
            width={450}
            height={220}
            title="Average Genome Complexity Over Time"
          />
        </div>
      ) : (
        <div className="no-data">
          <p>No data collected yet. Statistics will appear as the simulation runs.</p>
        </div>
      )}
    </div>
  );
}
