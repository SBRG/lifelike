import { compileFind } from '../find';

export enum MatchPriority {
  NONE,
  OTHER,
  ENDS_WITH,
  STARTS_WITH,
  EXACT_MATCH,
}

export function prioritisedCompileFind(terms, options) {
  const standardMatcher = compileFind(terms, options);
  const pattern = standardMatcher.termPatterns.join('|');

  const exact = new RegExp(`^${pattern}$`, 'i');
  const starts = new RegExp(`^${pattern}`, 'i');
  const ends = new RegExp(`${pattern}$`, 'i');
  const other = new RegExp(pattern, 'i');

  return s => {
    if (other.test(s)) {
      if (starts.test(s)) {
        if (exact.test(s)) {
          return MatchPriority.EXACT_MATCH;
        } else {
          return MatchPriority.STARTS_WITH;
        }
      } else if (ends.test(s)) {
        return MatchPriority.ENDS_WITH;
      }
      return MatchPriority.OTHER;
    }
    return MatchPriority.NONE;
  };
}
