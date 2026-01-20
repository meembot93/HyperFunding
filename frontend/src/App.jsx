import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

const COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#f43f5e', '#a855f7', '#0ea5e9', '#eab308'
];

function App() {
  const [assets, setAssets] = useState([]);
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [fundingData, setFundingData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(30);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSmoothed, setShowSmoothed] = useState(false);
  const [topPerformers, setTopPerformers] = useState([]);
  const [loadingTop, setLoadingTop] = useState(false);

  // Fetch available assets on mount
  useEffect(() => {
    fetchAssets();
  }, []);

  // Fetch funding data when selected assets or days change
  useEffect(() => {
    if (selectedAssets.length > 0) {
      fetchFundingData();
    }
  }, [selectedAssets, days]);

  const fetchAssets = async () => {
    try {
      const response = await fetch('/api/assets');
      const data = await response.json();
      setAssets(data);
      // Pre-select BTC and ETH by default
      const defaults = data.filter(a => ['BTC', 'ETH'].includes(a.name)).map(a => a.name);
      setSelectedAssets(defaults);
      // Fetch top performers
      fetchTopPerformers(data);
    } catch (err) {
      setError('Failed to fetch assets');
      console.error(err);
    }
  };

  const fetchTopPerformers = async (assetList) => {
    setLoadingTop(true);
    try {
      // Filter assets with >= 1M open interest (OI is in contracts, multiply by price for USD)
      const eligibleAssets = assetList
        .map(a => ({
          ...a,
          oiUsd: parseFloat(a.openInterest) * parseFloat(a.markPrice)
        }))
        .filter(a => a.oiUsd >= 1000000)
        .sort((a, b) => b.oiUsd - a.oiUsd)
        .slice(0, 30); // Limit to top 30 by OI to avoid timeout

      if (eligibleAssets.length === 0) {
        setTopPerformers([]);
        return;
      }

      // Fetch 30-day funding data for eligible assets
      const response = await fetch('/api/funding/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coins: eligibleAssets.map(a => a.name), days: 30 })
      });

      if (!response.ok) {
        throw new Error('Batch request failed');
      }

      const fundingResults = await response.json();

      // Calculate average funding rate for each asset
      const rankings = eligibleAssets.map(asset => {
        const data = fundingResults[asset.name] || [];
        if (data.length === 0) return null;

        const rates = data.map(d => d.fundingRate);
        const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
        const avgAnnualized = avgRate * 100 * 24 * 365;

        return {
          name: asset.name,
          avgRate: avgAnnualized,
          openInterest: asset.oiUsd
        };
      }).filter(Boolean);

      // Sort by average rate and take top 5
      rankings.sort((a, b) => b.avgRate - a.avgRate);
      setTopPerformers(rankings.slice(0, 5));
    } catch (err) {
      console.error('Failed to fetch top performers:', err);
      setTopPerformers([]);
    } finally {
      setLoadingTop(false);
    }
  };

  const fetchFundingData = async () => {
    if (selectedAssets.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/funding/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coins: selectedAssets, days })
      });

      const data = await response.json();
      setFundingData(data);
    } catch (err) {
      setError('Failed to fetch funding data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleAsset = (assetName) => {
    setSelectedAssets(prev => {
      if (prev.includes(assetName)) {
        return prev.filter(a => a !== assetName);
      } else {
        return [...prev, assetName];
      }
    });
  };

  const filteredAssets = assets.filter(asset =>
    asset.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate 24-hour moving average
  const calculateMovingAverage = (data, windowSize = 24) => {
    return data.map((point, index) => {
      const start = Math.max(0, index - windowSize + 1);
      const window = data.slice(start, index + 1);
      const avg = window.reduce((sum, p) => sum + p.y, 0) / window.length;
      return { x: point.x, y: avg };
    });
  };

  // Prepare chart data
  const chartData = {
    datasets: selectedAssets.flatMap((coin, index) => {
      const data = fundingData[coin] || [];
      const rawData = data.map(d => ({
        x: new Date(d.time),
        y: d.fundingRate * 100 * 24 * 365 // Annualized rate
      }));

      // If smoothed mode, only show the moving average
      if (showSmoothed) {
        return rawData.length > 0 ? [{
          label: `${coin} (24h avg)`,
          data: calculateMovingAverage(rawData, 24),
          borderColor: COLORS[index % COLORS.length],
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.3
        }] : [];
      }

      // Otherwise show raw data
      return [{
        label: coin,
        data: rawData,
        borderColor: COLORS[index % COLORS.length],
        backgroundColor: COLORS[index % COLORS.length] + '20',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.1
      }];
    })
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#e5e7eb',
          usePointStyle: true,
          padding: 20
        }
      },
      title: {
        display: true,
        text: `Annualized Funding Rates - ${days} Days`,
        color: '#f3f4f6',
        font: {
          size: 18,
          weight: '600'
        }
      },
      tooltip: {
        backgroundColor: '#1f2937',
        titleColor: '#f3f4f6',
        bodyColor: '#d1d5db',
        borderColor: '#374151',
        borderWidth: 1,
        callbacks: {
          label: (context) => {
            const annualized = context.parsed.y;
            const hourly = annualized / (24 * 365);
            return `${context.dataset.label}: ${annualized.toFixed(2)}% APR (${hourly.toFixed(4)}%/hr)`;
          }
        }
      }
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: days <= 14 ? 'day' : days <= 60 ? 'week' : 'month',
          displayFormats: {
            day: 'MMM d',
            week: 'MMM d',
            month: 'MMM yyyy'
          }
        },
        grid: {
          color: '#374151'
        },
        ticks: {
          color: '#9ca3af',
          maxTicksLimit: 12
        }
      },
      y: {
        title: {
          display: true,
          text: 'Annualized Rate (% APR)',
          color: '#9ca3af'
        },
        grid: {
          color: '#374151'
        },
        ticks: {
          color: '#9ca3af',
          callback: (value) => value.toFixed(1) + '%'
        }
      }
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>HyperFunding</h1>
        <p>Track Hyperliquid Funding Rates</p>
      </header>

      <div className="main-content">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2>Select Assets</h2>
            <span className="selected-count">{selectedAssets.length} selected</span>
          </div>

          <input
            type="text"
            className="search-input"
            placeholder="Search assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <div className="time-selector">
            <label>Time Period</label>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={7}>7 Days</option>
              <option value={14}>14 Days</option>
              <option value={30}>30 Days</option>
              <option value={60}>60 Days</option>
              <option value={90}>90 Days</option>
              <option value={180}>180 Days</option>
            </select>
          </div>

          <div className="smoothing-toggle">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={showSmoothed}
                onChange={(e) => setShowSmoothed(e.target.checked)}
              />
              <span>24h Moving Average</span>
            </label>
          </div>

          <div className="asset-list">
            {filteredAssets.map(asset => (
              <div
                key={asset.name}
                className={`asset-item ${selectedAssets.includes(asset.name) ? 'selected' : ''}`}
                onClick={() => toggleAsset(asset.name)}
              >
                <div className="asset-info">
                  <span className="asset-name">{asset.name}</span>
                  <span className="asset-funding">
                    {(parseFloat(asset.currentFunding) * 100).toFixed(4)}%
                  </span>
                </div>
                <div className="asset-checkbox">
                  {selectedAssets.includes(asset.name) && <span>✓</span>}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className="chart-container">
          {error && <div className="error-message">{error}</div>}

          <div className="top-performers">
            <h3>Top 5 Funding Rates (30d avg, min $1M OI)</h3>
            {loadingTop ? (
              <p className="loading-text">Loading...</p>
            ) : (
              <div className="top-list">
                {topPerformers.map((asset, index) => (
                  <div
                    key={asset.name}
                    className="top-item"
                    onClick={() => !selectedAssets.includes(asset.name) && toggleAsset(asset.name)}
                  >
                    <span className="top-rank">#{index + 1}</span>
                    <span className="top-name">{asset.name}</span>
                    <span className={`top-rate ${asset.avgRate >= 0 ? 'positive' : 'negative'}`}>
                      {asset.avgRate.toFixed(1)}% APR
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {loading && (
            <div className="loading-overlay">
              <div className="spinner"></div>
              <p>Loading funding data...</p>
            </div>
          )}

          {selectedAssets.length === 0 ? (
            <div className="empty-state">
              <h3>No Assets Selected</h3>
              <p>Select one or more assets from the sidebar to view their funding rates.</p>
            </div>
          ) : (
            <div className="chart-wrapper">
              <Line data={chartData} options={chartOptions} />
            </div>
          )}

          {selectedAssets.length > 0 && !loading && (
            <div className="stats-grid">
              {selectedAssets.map((coin, index) => {
                const data = fundingData[coin] || [];
                if (data.length === 0) return null;

                const rates = data.map(d => d.fundingRate * 100);
                const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
                const max = Math.max(...rates);
                const min = Math.min(...rates);
                const current = rates[rates.length - 1] || 0;

                return (
                  <div key={coin} className="stat-card" style={{ borderColor: COLORS[index % COLORS.length] }}>
                    <h4>{coin}</h4>
                    <div className="stat-row">
                      <span>Current:</span>
                      <span className={current >= 0 ? 'positive' : 'negative'}>
                        {current.toFixed(4)}%
                      </span>
                    </div>
                    <div className="stat-row">
                      <span>Average:</span>
                      <span>{avg.toFixed(4)}%</span>
                    </div>
                    <div className="stat-row">
                      <span>Max:</span>
                      <span className="positive">{max.toFixed(4)}%</span>
                    </div>
                    <div className="stat-row">
                      <span>Min:</span>
                      <span className="negative">{min.toFixed(4)}%</span>
                    </div>
                    <div className="stat-row">
                      <span>APR (avg):</span>
                      <span>{(avg * 24 * 365).toFixed(2)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
