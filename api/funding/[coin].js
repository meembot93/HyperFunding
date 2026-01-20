const HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { coin } = req.query;
    const days = req.query.days || 30;

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
}
