const HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
}
