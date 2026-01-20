const HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info';

// Fetch funding history for a single coin with pagination
async function fetchCoinHistory(coin, startTime, endTime) {
  const CHUNK_DAYS = 20; // Fetch in 20-day chunks to avoid API limits
  const CHUNK_MS = CHUNK_DAYS * 24 * 60 * 60 * 1000;

  let allData = [];
  let currentStart = startTime;

  while (currentStart < endTime) {
    const currentEnd = Math.min(currentStart + CHUNK_MS, endTime);

    const response = await fetch(HYPERLIQUID_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'fundingHistory',
        coin: coin,
        startTime: currentStart,
        endTime: currentEnd
      })
    });

    const data = await response.json();

    if (Array.isArray(data)) {
      allData = allData.concat(data);
    }

    currentStart = currentEnd;
  }

  // Sort by time and remove duplicates
  allData.sort((a, b) => a.time - b.time);
  const seen = new Set();
  return allData.filter(item => {
    if (seen.has(item.time)) return false;
    seen.add(item.time);
    return true;
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { coins, days = 30 } = req.body;

    const endTime = Date.now();
    const startTime = endTime - (parseInt(days) * 24 * 60 * 60 * 1000);

    const results = {};

    // Fetch funding history for each coin in parallel
    await Promise.all(coins.map(async (coin) => {
      const data = await fetchCoinHistory(coin, startTime, endTime);

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
}
