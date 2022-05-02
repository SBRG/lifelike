import {HttpErrorResponse} from '@angular/common/http';

import {catchError} from 'rxjs/operators';
import {from, Observable, pipe, throwError} from 'rxjs';
import {UnaryFunction} from 'rxjs/internal/types';

import {OperatingSystems} from 'app/interfaces/shared.interface';

import {FAClass, CustomIconColors, Unicodes} from './constants';


/**
 * Splits a pascal-case (e.g. "TheQuickRedFox") string, separating the words by a " " character. E.g. "The Quick Red Fox".
 * @param str the pascal-case string to split
 * @returns the input string with the words split by " "
 */
export function splitPascalCaseStr(str: string): string {
  return str
    // Look for long acronyms and filter out the last letter
    .replace(/([A-Z]+)([A-Z][a-z])/g, ' $1 $2')
    // Look for lower-case letters followed by upper-case letters
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    // Look for lower-case letters followed by numbers
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/^./, (s) => s.toUpperCase())
    // Remove any white space left around the word
    .trim();
}

/**
 * Takes an input string and returns the title-cased version of that string. E.g., 'lazy dog' becomes 'Lazy Dog'.
 *
 * TODO: This could be smarter, since cases like '$foobar' or '"lazy dog"' have somewhat unexpected results ('$foobar' and '"lazy Dog"'
 * respectively).
 * @param str string to convert to title-case
 * @returns the title-cased version of the input string
 */
export function toTitleCase(str: string) {
  return str.replace(
    /\w\S*/g,
    (txt: string) => {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    }
  );
}

export function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';

  [...Array(6).keys()].forEach(
    _ => color += letters[Math.floor(Math.random() * 16)],
  );

  return color;
}

/**
 * Converts a string to hex.
 * TODO: Consider a better way to encode data (e.g. base64/32)
 *
 * Use cases:
 * 1. Allow us to use various characters without having
 * to deal with escaping them in URLs
 * (i.e.) n1,n2&n3,n4 does not need to have the & escaped
 */
export function stringToHex(s: string) {
  const hexFormat = [];
  for (let i = 0, l = s.length; i < l; i++) {
    const hex = Number(s.charCodeAt(i)).toString(16);
    hexFormat.push(hex);
  }
  return hexFormat.join('');
}

/**
 * Transforms a hex code and opacity value into an rgba value.
 * @param hex hex code to turn into rgba value
 */
export function hexToRGBA(hex: string, opacity: number) {
  let c;
  if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    c = hex.substring(1).split('');
    if (c.length === 3) {
      c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    c = '0x' + c.join('');
    /* tslint:disable:no-bitwise*/
    return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + `,${opacity})`;
  }
  throw new Error('Bad Hex');
}

/**
 * Generate a UUID. Source: https://stackoverflow.com/a/2117523
 */
export function uuidv4(): string {
  // @ts-ignore
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
    /* tslint:disable:no-bitwise*/
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16),
  );
}


/**
 * Determines which event listener to use (dependent on browser)
 */
export function whichTransitionEvent() {
  const el = document.createElement('fakeelement');
  const transitions = {
    animation: 'animationend',
    OAnimation: 'oAnimationEnd',
    MozAnimation: 'animationend',
    WebkitAnimation: 'webkitAnimationEnd',
  };

  for (const t in transitions) {
    if (el.style[t] !== undefined) {
      return transitions[t];
    }
  }
}

export function getClientOS() {
  if (navigator.appVersion.indexOf('Linux') !== -1) {
    return OperatingSystems.LINUX;
  }
  if (navigator.appVersion.indexOf('Mac') !== -1) {
    return OperatingSystems.MAC;
  }
  if (navigator.appVersion.indexOf('Win') !== -1) {
    return OperatingSystems.WINDOWS;
  }
  return OperatingSystems.UNKNOWN;

}

export function keyCodeRepresentsCopyEvent(event: any) {
  const clientOS = getClientOS();
  switch (clientOS) {
    case OperatingSystems.MAC:
    case OperatingSystems.LINUX:
    case OperatingSystems.WINDOWS: {
      return event.code === 'KeyC' && event.ctrlKey === true;
    }
    default: {
      return false;
    }
  }
}

export function isAltOrOptionPressed(event: KeyboardEvent | MouseEvent) {
  return event.altKey;
}

export function isShiftPressed(event: KeyboardEvent | MouseEvent) {
  return event.shiftKey;
}

export function isCtrlOrMetaPressed(event: KeyboardEvent | MouseEvent) {
  const os = getClientOS();
  switch (os) {
    case OperatingSystems.MAC:
      return event.metaKey;
    default:
      return event.ctrlKey;
  }
}

export function keyCodeRepresentsPasteEvent(event: any) {
  const clientOS = getClientOS();
  switch (clientOS) {
    case OperatingSystems.MAC: {
      if (event.code === 'KeyV' && event.metaKey === true) {
        return true;
      }
      return false;
    }
    case OperatingSystems.LINUX:
    case OperatingSystems.WINDOWS: {
      if (event.code === 'KeyV' && event.ctrlKey === true) {
        return true;
      }
      return false;
    }
    default: {
      return false;
    }
  }
}

/**
 * Generates a downloadable file that is cross compatible
 * with multiple browsers.
 * @param blobData - the blob data
 * @param mimeType - mimetype
 * @param saveAs - the filename to save the file as (must include extension)
 */
export function downloader(blobData: any, mimeType: string, saveAs: string) {
  const newBlob = new Blob([blobData], {type: mimeType});
  // IE doesn't allow using a blob object directly as link href
  // instead it is necessary to use msSaveOrOpenBlob
  if (window.navigator && window.navigator.msSaveOrOpenBlob) {
    window.navigator.msSaveOrOpenBlob(newBlob);
    return;
  }
  // For other browsers:
  // Create a link pointing to the ObjectURL containing the blob.
  const data = window.URL.createObjectURL(newBlob);

  const link = document.createElement('a');
  link.href = data;
  link.download = saveAs;
  // this is necessary as link.click() does not work on the latest firefox
  link.dispatchEvent(new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window,
  }));

  setTimeout(() => {
    // For Firefox it is necessary to delay revoking the ObjectURL
    window.URL.revokeObjectURL(data);
    link.remove();
  }, 100);
}

/**
 * Catches and swallows 404 errors, preventing it
 * from bubbling up.
 */
export function ignore404Errors<T>(): UnaryFunction<Observable<T>, Observable<T>> {
  return pipe(catchError(error => {
    if (error instanceof HttpErrorResponse) {
      const res = error as HttpErrorResponse;
      if (res.status === 404) {
        return from([null]);
      }
    }
    return throwError(error);
  }));
}

/**
 * Matches filename/url with supported extensions and returns its information
 */
export function getSupportedFileCodes(text: string): SupportedExtensionInfo {
  if (text.endsWith('.docx') || text.endsWith('.doc')) {
    return {
      unicode: Unicodes.Word,
      FAClass: FAClass.Word,
      color: CustomIconColors.Word
    };
  } else if (text.endsWith('.xlsx') || text.endsWith('.xls')) {
    return {
      unicode: Unicodes.Excel,
      FAClass: FAClass.Excel,
      color: CustomIconColors.Excel
    };
  } else if (text.endsWith('.pptx') || text.endsWith('.ppt')) {
    return {
      unicode: Unicodes.PowerPoint,
      FAClass: FAClass.PowerPoint,
      color: CustomIconColors.PowerPoint
    };
  } else if (text.endsWith('.cys')) {
    return {
      unicode: Unicodes.Cytoscape,
      FAClass: FAClass.Cytoscape,
      color: CustomIconColors.Cytoscape
    };
  }
  return undefined;
}


export interface SupportedExtensionInfo {
  unicode: Unicodes;
  FAClass: FAClass;
  color: CustomIconColors;
}
