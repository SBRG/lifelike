import { formatNumber } from '@angular/common';

// region Collections
export function isIterable(obj) {
  // checks for null and undefined
  if (obj == null) {
    return false;
  }
  return typeof obj[Symbol.iterator] === 'function';
}

export const uniqueBy = (arr, accessor) =>
  arr.reduce((identifiers, elem) => {
    const identifier = accessor(elem);
    if (identifiers.has(identifier)) {
      return identifiers;
    } else {
      identifiers.set(identifier, elem);
      return identifiers;
    }
  }, new Map());
// endregion

// region Numbers
export const isNumber = (v: any) => !isNaN(v) && typeof v !== 'boolean';

export const isPositiveNumber = (v: any) => isNumber(v) || v > 0;

export const clamp = (min, max) => value => Math.min(Math.max(min, Number(value)), max);

export const representativePositiveNumber = clamp(Number.MIN_VALUE, 1e4);
// endregion

export const parseForRendering = (v, propertyName: string | boolean = true) => {
  if (!isNaN(v)) {
    return formatNumber(v, 'en-US', '1.0-6');
  }
  if (typeof v === 'string' || v instanceof String) {
    return v;
  }
  if (typeof v === 'object' && propertyName) {
    if (isIterable(v)) {
      // propertyName === true -- if was not called by JSON parser
      if (propertyName === true) {
        return v.map(n => parseForRendering(n)).join(', ');
      }
      const vAsArray = [...v];
      if (vAsArray.length > 3) {
        return vAsArray.slice(0, 3).concat(`...${vAsArray.length - 3} hidden elements`);
      } else {
        return vAsArray;
      }
    }
    if (v.id) {
      return `{ id: ${v.id}, ... }`;
    }
    if (v.index) {
      return `{ index: ${v.index}, ... }`;
    }
  }
  return v;
};
