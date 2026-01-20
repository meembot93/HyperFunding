const HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info';

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
}
