"use strict";
// noinspection JSAnnotator
/**
 * To compile this file run `yarn run compileTsLintCustomisations`
 */
exports.__esModule = true;
var Lint = require("tslint");
var groupedFormatterGenerator_1 = require("./groupedFormatterGenerator");
// tslint:disable-next-line:variable-name
exports.Formatter = groupedFormatterGenerator_1.grouped(Lint.Formatters.StylishFormatter);
