// noinspection JSAnnotator
/**
 * To compile this file run `yarn run compileTsLintCustomisations`
 */

import * as Lint from 'tslint';
import { RuleFailure } from 'tslint';
import { RuleSeverity } from 'tslint/lib/language/rule/rule';

export function grouped(formatterClass) {
  return class Formatter extends formatterClass {
    protected sortFailures(failures: RuleFailure[]): RuleFailure[] {
      const groupedFailures: {
        [ruleSeverity in RuleSeverity]: Lint.RuleFailure[]
      } = {
        warning: [],
        error: [],
        off: []
      };
      for (const failure of failures) {
        groupedFailures[failure.getRuleSeverity()].push(failure);
      }
      return [].concat(
        groupedFailures.off.sort(RuleFailure.compare),
        groupedFailures.warning.sort(RuleFailure.compare),
        groupedFailures.error.sort(RuleFailure.compare)
      );
    }
  };
}
