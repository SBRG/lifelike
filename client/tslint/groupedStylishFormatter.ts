// noinspection JSAnnotator
/**
 * To compile this file run `yarn run compileTsLintCustomisations`
 */

import * as Lint from 'tslint';

import { grouped } from './groupedFormatterGenerator';

// tslint:disable-next-line:variable-name
export const Formatter = grouped(Lint.Formatters.StylishFormatter);
