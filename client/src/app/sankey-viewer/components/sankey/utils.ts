import { uniqueBy } from '../utils';

export const normalizeGenerator = values => {
  const min = Math.min(...values);
  const max = values.reduce((o, n) => o + n, 0);
  return {
    min, max,
    normalize: (max - min) ? d => Math.max(0, d / max) : d => d / max
  };
};

export const RELAYOUT_DURATION = 250;

export function symmetricDifference(setA, setB, accessor) {
  return [...uniqueBy(setB, accessor).entries()].reduce((difference, [identifier, elem]) => {
    if (difference.has(identifier)) {
      difference.delete(identifier);
    } else {
      difference.set(identifier, elem);
    }
    return difference;
  }, uniqueBy(setA, accessor));
}
