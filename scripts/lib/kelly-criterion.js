// Kelly criterion bet sizing functions
// odds: decimal odds (e.g. 3.5 means a 100-yen bet returns 350 yen)
// b: net profit multiplier = odds - 1

export function kellyFraction(probability, odds) {
  const b = odds - 1;
  const q = 1 - probability;
  const fraction = (b * probability - q) / b;
  return Math.max(0, fraction);
}

export function halfKelly(probability, odds) {
  return kellyFraction(probability, odds) * 0.5;
}

export function quarterKelly(probability, odds) {
  return kellyFraction(probability, odds) * 0.25;
}
