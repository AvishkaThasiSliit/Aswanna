/**
 * Market Price Forecast API Client
 * Backend Contract: GET /api/price/forecast?vegetable=...&horizon=...&model=...
 */

export async function forecastPrice({ commodity, horizon = 4, model = 'selected' }) {
  const url = `/api/price/forecast?vegetable=${encodeURIComponent(commodity)}&horizon=${horizon}&model=${encodeURIComponent(model)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Price API responded with status ${res.status}`);
  }
  return await res.json();
}
