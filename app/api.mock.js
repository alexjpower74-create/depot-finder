// api.mock.js — in-memory stand-in for the Worker, used with ?mock=1. Records every post
// on window.__mockCorrections so tests can prove the form actually sent something.
export { CORRECTION_FIELDS } from './api.js';

export async function postCorrection(body) {
  const required = ['depot_id', 'field', 'proposed'];
  for (const k of required) if (!body || typeof body[k] !== 'string' || !body[k]) throw new Error(`Missing ${k}`);
  window.__mockCorrections = window.__mockCorrections || [];
  const id = `mock-${window.__mockCorrections.length + 1}`;
  window.__mockCorrections.push({ id, ...body });
  await new Promise((r) => setTimeout(r, 50));
  return { id };
}
