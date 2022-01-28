import { escapeRegExp } from 'lodash-es';

/**
 * Split a term into separate words.
 * @param s the term
 * @param options extra tokenization options
 */
export function tokenizeQuery(s: string,
                              options: TokenizationOptions = {}): string[] {
  if (options.singleTerm) {
    return [
      s.trim()
    ];
  } else {
    const terms = [];
    let term = '';
    let quoted = false;

    for (const char of s) {
      if (char === '"') {
        quoted = !quoted;
      } else if (!quoted && char === ' ') {
      } else {
        term += char;
        continue;
      }

      const trimmedTerm = term.trim();
      if (trimmedTerm.length) {
        terms.push(trimmedTerm);
      }
      term = '';
    }

    {
      const trimmedTerm = term.trim();
      if (trimmedTerm.length) {
        terms.push(trimmedTerm);
      }
    }

    return terms;
  }
}

export interface Matcher {
  (s: string): boolean;

  pattern: RegExp;
  termPatterns: string[];
}

/**
 * Compile a function to match search terms within text.
 * @param terms the terms to match
 * @param options extra options
 */
export function compileFind(terms: string[], options: FindOptions = {}): Matcher {
  const wrapper = options.wholeWord ? '\\b' : '';
  let termPatterns;

  if (options.keepSearchSpecialChars) {
    termPatterns = terms.map(term => {
      const pat = escapeRegExp(term)
        .replace(' ', ' +')
        .replace(/(\\\*)/g, '\\w*')
        .replace(/(\\\?)/g, '\\w?');
      return wrapper + pat + wrapper;
    });
  } else {
    termPatterns = terms.map(
      term => wrapper + escapeRegExp(term).replace(' ', ' +') + wrapper
    );
  }

  const pattern = new RegExp(termPatterns.join('|'), 'i');
  // We need to bind the pattern, or it will be destroyed after the function returns.
  // See: https://stackoverflow.com/questions/20579033/why-do-i-need-to-write-functionvalue-return-my-functionvalue-as-a-callb
  const matcher = RegExp.prototype.test.bind(pattern);
  Object.assign(matcher, {
    pattern,
    termPatterns
  });
  return matcher as Matcher;
}

export interface TokenizationOptions {
  singleTerm?: boolean;
}

export interface FindOptions {
  wholeWord?: boolean;
  keepSearchSpecialChars?: boolean;
}
