import type { StoredPrediction } from '../types/api';

const STORAGE_KEY = 'agricost_recent_predictions';
const MAX_STORED = 20;

export function getStoredPredictions(): StoredPrediction[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function addStoredPrediction(pred: StoredPrediction): StoredPrediction[] {
  if (typeof window === 'undefined') return [];
  try {
    const existing = getStoredPredictions();
    // Prepend and de-duplicate by request_id
    const updated = [pred, ...existing.filter((p) => p.request_id !== pred.request_id)].slice(0, MAX_STORED);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function clearStoredPredictions(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
