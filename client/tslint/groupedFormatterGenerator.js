"use strict";
// noinspection JSAnnotator
/**
 * To compile this file run `yarn run compileTsLintCustomisations`
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
exports.__esModule = true;
var tslint_1 = require("tslint");
function grouped(formatterClass) {
    return /** @class */ (function (_super) {
        __extends(Formatter, _super);
        function Formatter() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        Formatter.prototype.sortFailures = function (failures) {
            var groupedFailures = {
                warning: [],
                error: [],
                off: []
            };
            for (var _i = 0, failures_1 = failures; _i < failures_1.length; _i++) {
                var failure = failures_1[_i];
                groupedFailures[failure.getRuleSeverity()].push(failure);
            }
            return [].concat(groupedFailures.off.sort(tslint_1.RuleFailure.compare), groupedFailures.warning.sort(tslint_1.RuleFailure.compare), groupedFailures.error.sort(tslint_1.RuleFailure.compare));
        };
        return Formatter;
    }(formatterClass));
}
exports.grouped = grouped;
