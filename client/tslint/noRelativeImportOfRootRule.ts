import * as Lint from 'tslint';
import * as ts from 'typescript';
import { isExternalModuleNameRelative } from 'typescript';
import { findImports, ImportKind } from 'tsutils';

import * as path from 'path';

export class Rule extends Lint.Rules.AbstractRule {
  public static metadata: Lint.IRuleMetadata = {
    description: 'Disallow passing through root of module with relative imports',
    options: [],
    optionsDescription: '',
    rationale: Lint.Utils.dedent`
            It is easier to read \`import foo from 'app/baz';\` than resoning on where
            \`import foo from '../../../baz';\` is pointing to.
        `,
    ruleName: 'no-relative-import-of-root',
    type: 'style',
    typescriptOnly: false,
  };

  public static FAILURE_STRING = 'Root of application cannot be imported with relative path';

  public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
    return this.applyWithFunction(sourceFile, walk);
  }
}

function walk(ctx: Lint.WalkContext) {
  for (const name of findImports(ctx.sourceFile, ImportKind.All)) {
    if (isExternalModuleNameRelative(name.text)) {
      const sourceDir = path.parse(ctx.sourceFile.fileName).dir;
      let relativeEndFlag = false;
      const relativePart = [];
      const remainingPart = [];
      // imports always use '/'
      for (const part of name.text.split('/')) {
        if (part !== '.' && part !== '..' || relativeEndFlag) {
          relativeEndFlag = true;
          remainingPart.push(part);
        } else {
          relativePart.push(part);
        }
      }
      const relativeRoot = path.resolve(sourceDir, ...relativePart);
      // '.' workspace
      const relative = path.relative('.', relativeRoot).split(path.sep);
      if (relative.length === 2 && relative[1] === 'app') {
        // create a fixer for this failure
        const fix = new Lint.Replacement(name.getStart(), name.getWidth(), `'${['app', ...remainingPart].join('/')}'`);
        ctx.addFailure(
          name.getStart(ctx.sourceFile) + 1,
          name.end - 1,
          Rule.FAILURE_STRING,
          fix
        );
      }
    }
  }
}
