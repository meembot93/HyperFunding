import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info';

// Get available assets and their current funding rates
app.get('/api/assets', async (req, res) => {
  try {
    const response = await fetch(HYPERLIQUID_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs' })
    });

    const data = await response.json();

    // Extract asset names and current funding info
    const assets = data[0].universe.map((asset, index) => ({
      name: asset.name,
      currentFunding: data[1][index]?.funding || '0',
      markPrice: data[1][index]?.markPx || '0',
      openInterest: data[1][index]?.openInterest || '0'
    }));

    res.json(assets);
  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// Get funding history for a specific asset
app.get('/api/funding/:coin', async (req, res) => {
  try {
    const { coin } = req.params;
    const { days = 30 } = req.query;

    const endTime = Date.now();
    const startTime = endTime - (parseInt(days) * 24 * 60 * 60 * 1000);

    const response = await fetch(HYPERLIQUID_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'fundingHistory',
        coin: coin,
        startTime: startTime,
        endTime: endTime
      })
    });

    const data = await response.json();

    // Format the data for the frontend
    const formattedData = data.map(item => ({
      time: item.time,
      fundingRate: parseFloat(item.fundingRate),
      premium: parseFloat(item.premium)
    }));

    res.json(formattedData);
  } catch (error) {
    console.error('Error fetching funding history:', error);
    res.status(500).json({ error: 'Failed to fetch funding history' });
  }
});

// Get funding history for multiple assets
app.post('/api/funding/batch', async (req, res) => {
  try {
    const { coins, days = 30 } = req.body;

    const endTime = Date.now();
    const startTime = endTime - (parseInt(days) * 24 * 60 * 60 * 1000);

    const results = {};

    // Fetch funding history for each coin in parallel
    await Promise.all(coins.map(async (coin) => {
      const response = await fetch(HYPERLIQUID_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'fundingHistory',
          coin: coin,
          startTime: startTime,
          endTime: endTime
        })
      });

      const data = await response.json();

      results[coin] = data.map(item => ({
        time: item.time,
        fundingRate: parseFloat(item.fundingRate),
        premium: parseFloat(item.premium)
      }));
    }));

    res.json(results);
  } catch (error) {
    console.error('Error fetching batch funding history:', error);
    res.status(500).json({ error: 'Failed to fetch funding history' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
