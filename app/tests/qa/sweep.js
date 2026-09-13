// The plain-English sweep. Pure functions over visible text so the negative control can call them
// against a planted page and prove they go red.

/** Developer words that must never reach a screen. */
export const BANNED = [
  /\bnull\b/, /\bundefined\b/, /\bNaN\b/, /\[object Object\]/, /\bTODO\b/, /\bFIXME\b/, /lorem ipsum/i,
  /\bJSON\b/, /\bAPI\b/, /\bTypeError\b/, /\bReferenceError\b/, /\bSyntaxError\b/, /Failed to fetch/,
  /\b(?:lat|lng|tz)\s*[:=]/, /\bAmerica\/St_Johns\b/, /\bAmerica\/Goose_Bay\b/,
  /\b[a-z]+_[a-z]+(?:_[a-z]+)*\b/, // snake_case identifiers leaking (refillable_beer, depot_id, last_checked)
];

/** "all depots accept" / "every depot takes" in any spelling, except the one fixed sentence. */
export const OVERCLAIM = /\b(?:all|every)\s+(?:green\s+)?depots?\s+(?:accepts?|takes?)\b[^.\n]*/gi;
export const BEVERAGE_SENTENCE = 'Every Green Depot takes beverage containers.';

export function findBanned(text) {
  const hits = [];
  for (const re of BANNED) {
    const m = text.match(re);
    if (m) hits.push(`${re} -> "${m[0]}"`);
  }
  return hits;
}

export function findOverclaims(text) {
  const hits = [];
  for (const m of text.matchAll(OVERCLAIM)) {
    const sentence = (m[0] + '.').trim();
    if (sentence !== BEVERAGE_SENTENCE) hits.push(sentence);
  }
  return hits;
}

/**
 * On a depot page every line that states an Unknown verdict must also say "call to confirm".
 * Lines are what the user reads; a chip legend saying just "Unknown" on the LIST screen is not checked here.
 */
export function findBareUnknowns(text) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /\bUnknown\b/.test(l) && !/call to confirm/i.test(l));
}

/** Throws with every problem on the screen; used by the spec and by the negative control. */
export function sweep(text, { depotPage = false } = {}) {
  const problems = [
    ...findBanned(text).map((h) => `developer word: ${h}`),
    ...findOverclaims(text).map((h) => `overclaim: "${h}"`),
    ...(depotPage ? findBareUnknowns(text).map((h) => `Unknown without "call to confirm": "${h}"`) : []),
  ];
  if (problems.length) throw new Error(problems.join('\n'));
  return true;
}
