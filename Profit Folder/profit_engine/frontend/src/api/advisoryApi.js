/**
 * Combined Advisory & Profit API Client
 * Backend Contracts:
 *   GET  /health
 *   GET  /api/metadata
 *   POST /api/advisory-predict
 */

export async function checkHealth() {
  const res = await fetch('/health');
  if (!res.ok) throw new Error(`Health check failed (${res.status})`);
  return await res.json();
}

export async function fetchMetadata() {
  const res = await fetch('/api/metadata');
  if (!res.ok) throw new Error(`Metadata fetch failed (${res.status})`);
  return await res.json();
}

export async function predictAdvisory(payload) {
  const res = await fetch('/api/advisory-predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Advisory API returned ${res.status}: ${errorText || res.statusText}`);
  }
  return await res.json();
}
