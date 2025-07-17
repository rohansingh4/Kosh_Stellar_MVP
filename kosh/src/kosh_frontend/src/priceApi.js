const CMC_API_KEY = 'dc11b592-2722-48e7-9437-258f27ce8d3e';
const CMC_BASE_URL = 'https://pro-api.coinmarketcap.com/v1';

// CoinMarketCap API has CORS restrictions, so we'll use a proxy or alternative approach
// For development, we'll use coinlore API as a fallback which has no CORS issues
const COINLORE_API = 'https://api.coinlore.net/api/ticker/?id=4081'; // XLM ID on coinlore

export async function fetchXLMPrice() {
  try {
    // Try CoinMarketCap first (if proxy is available)
    // For production, you'd want to route this through your backend
    const response = await fetch(`${CMC_BASE_URL}/cryptocurrency/quotes/latest?symbol=XLM`, {
      headers: {
        'X-CMC_PRO_API_KEY': CMC_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      const xlmData = data.data.XLM;
      return {
        price: xlmData.quote.USD.price,
        change24h: xlmData.quote.USD.percent_change_24h,
        source: 'CoinMarketCap'
      };
    }
  } catch (error) {
    console.warn('CoinMarketCap API failed, trying fallback:', error);
  }

  try {
    // Fallback to CoinLore API (no CORS issues)
    const response = await fetch(COINLORE_API);
    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0) {
        const xlmData = data[0];
        return {
          price: parseFloat(xlmData.price_usd),
          change24h: parseFloat(xlmData.percent_change_24h),
          source: 'CoinLore'
        };
      }
    }
  } catch (error) {
    console.warn('CoinLore API failed:', error);
  }

  // If both APIs fail, return mock data
  return {
    price: 0.12,
    change24h: 2.34,
    source: 'Mock Data'
  };
}

export function formatPrice(price) {
  return price.toFixed(4);
}

export function formatUsdValue(xlmAmount, xlmPrice) {
  return (xlmAmount * xlmPrice).toFixed(2);
}

export function formatPercentChange(change) {
  const formatted = Math.abs(change).toFixed(2);
  const sign = change >= 0 ? '+' : '-';
  return `${sign}${formatted}%`;
} 