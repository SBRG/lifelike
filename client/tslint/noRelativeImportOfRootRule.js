"use strict";
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
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
var Lint = require("tslint");
var typescript_1 = require("typescript");
var tsutils_1 = require("tsutils");
var path = require("path");
var Rule = /** @class */ (function (_super) {
    __extends(Rule, _super);
    function Rule() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Rule.prototype.apply = function (sourceFile) {
        return this.applyWithFunction(sourceFile, walk);
    };
    Rule.metadata = {
        description: 'Disallow passing through root of module with relative imports',
        options: [],
        optionsDescription: '',
        rationale: Lint.Utils.dedent(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n            It is easier to read `import foo from 'app/baz';` than resoning on where\n            `import foo from '../../../baz';` is pointing to.\n        "], ["\n            It is easier to read \\`import foo from 'app/baz';\\` than resoning on where\n            \\`import foo from '../../../baz';\\` is pointing to.\n        "]))),
        ruleName: 'no-relative-import-of-root',
        type: 'style',
        typescriptOnly: false
    };
    Rule.FAILURE_STRING = 'Root of application cannot be imported with relative path';
    return Rule;
}(Lint.Rules.AbstractRule));
exports.Rule = Rule;
function walk(ctx) {
    for (var _i = 0, _a = tsutils_1.findImports(ctx.sourceFile, 63 /* All */); _i < _a.length; _i++) {
        var name_1 = _a[_i];
        if (typescript_1.isExternalModuleNameRelative(name_1.text)) {
            var sourceDir = path.parse(ctx.sourceFile.fileName).dir;
            var relativeEndFlag = false;
            var relativePart = [];
            var remainingPart = [];
            // imports always use '/'
            for (var _b = 0, _c = name_1.text.split('/'); _b < _c.length; _b++) {
                var part = _c[_b];
                if (part !== '.' && part !== '..' || relativeEndFlag) {
                    relativeEndFlag = true;
                    remainingPart.push(part);
                }
                else {
                    relativePart.push(part);
                }
            }
            var relativeRoot = path.resolve.apply(path, __spreadArrays([sourceDir], relativePart));
            // '.' workspace
            var relative = path.relative('.', relativeRoot).split(path.sep);
            if (relative.length === 2 && relative[1] === 'app') {
                // create a fixer for this failure
                var fix = new Lint.Replacement(name_1.getStart(), name_1.getWidth(), "'" + __spreadArrays(['app'], remainingPart).join('/') + "'");
                ctx.addFailure(name_1.getStart(ctx.sourceFile) + 1, name_1.end - 1, Rule.FAILURE_STRING, fix);
            }
        }
    }
}
var templateObject_1;
