// api.js — the real Worker client. Contract: docs/API.md.
import { API_BASE } from './config.js';

export const CORRECTION_FIELDS = ['hours', 'phone', 'address', 'refillable_beer', 'iceberg_bottles',
  'paper_cardboard', 'paint', 'electronics', 'other'];

export async function postCorrection(body) {
  const res = await fetch(`${API_BASE}/correction`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status !== 201) throw new Error(data.error || `Could not send (status ${res.status})`);
  return data; // { id }
}
