import { ValueProcessingStep } from 'app/shared-sankey/interfaces';

import { representativePositiveNumber } from '../utils';
import { SankeyControllerService } from '../../services/sankey-controller.service';

export const fixedValue: (value: number) => ValueProcessingStep =
  value =>
    // tslint:disable-next-line:only-arrow-functions // allowing non-arrow function so we can maintain execution context
    function(this: SankeyControllerService, {nodes}) {
      nodes.forEach(n => {
        n._fixedValue = value;
      });
      return {
        nodes,
        _sets: {
          node: {
            _fixedValue: true
          }
        }
      };
    };

export function noneNodeValue(this: SankeyControllerService, {nodes}) {
  nodes.forEach(n => {
    delete n._fixedValue;
    delete n._value;
  });
  return {
    _sets: {
      node: {
        _fixedValue: false,
        _value: false
      }
    }
  };
}

export const byProperty: (property: string) => ValueProcessingStep =
  property =>
    // tslint:disable-next-line:only-arrow-functions // allowing non-arrow function so we can maintain execution context
    function(this: SankeyControllerService, {nodes}) {
      nodes.forEach(n => {
        n._fixedValue = representativePositiveNumber(n[property]);
      });
      return {
        _sets: {
          node: {
            _fixedValue: true
          }
        }
      };
    };
