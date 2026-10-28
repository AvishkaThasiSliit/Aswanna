/**
 * Cost Estimator API Client
 * Backend Contract: POST /api/cost/predict
 */

export async function predictCost(payload) {
  const res = await fetch('/api/cost/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    throw new Error(`Cost API responded with status ${res.status}`);
  }
  return await res.json();
}
