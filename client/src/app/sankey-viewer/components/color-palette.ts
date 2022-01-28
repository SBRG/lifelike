// region Colors
import { isDevMode } from '@angular/core';

import { cubehelix } from 'd3-color';

import { Palette } from 'app/shared-sankey/interfaces';

export const DEFAULT_SATURATION = 0.35;
export const DEFAULT_LIGHTNESS = 0.75;
export const DEFAULT_ALPHA = 1;

export const christianColors = [
  '#1CE6FF', '#FF34FF', '#FF4A46', '#008941', '#006FA6', '#A30059', '#FFFF00',
  '#FFDBE5', '#7A4900', '#0000A6', '#63FFAC', '#B79762', '#004D43', '#8FB0FF', '#997D87',
  '#5A0007', '#809693', '#FEFFE6', '#1B4400', '#4FC601', '#3B5DFF', '#4A3B53', '#FF2F80',
  '#61615A', '#BA0900', '#6B7900', '#00C2A0', '#FFAA92', '#FF90C9', '#B903AA', '#D16100',
  '#DDEFFF', '#000035', '#7B4F4B', '#A1C299', '#300018', '#0AA6D8', '#013349', '#00846F',
  '#372101', '#FFB500', '#C2FFED', '#A079BF', '#CC0744', '#C0B9B2', '#C2FF99', '#001E09',
  '#00489C', '#6F0062', '#0CBD66', '#EEC3FF', '#456D75', '#B77B68', '#7A87A1', '#788D66',
  '#885578', '#FAD09F', '#FF8A9A', '#D157A0', '#BEC459', '#456648', '#0086ED', '#886F4C',
  '#34362D', '#B4A8BD', '#00A6AA', '#452C2C', '#636375', '#A3C8C9', '#FF913F', '#938A81',
  '#575329', '#00FECF', '#B05B6F', '#8CD0FF', '#3B9700', '#04F757', '#C8A1A1', '#1E6E00',
  '#7900D7', '#A77500', '#6367A9', '#A05837', '#6B002C', '#772600', '#D790FF', '#9B9700',
  '#549E79', '#FFF69F', '#201625', '#72418F', '#BC23FF', '#99ADC0', '#3A2465', '#922329',
  '#5B4534', '#FDE8DC', '#404E55', '#0089A3', '#CB7E98', '#A4E804', '#324E72', '#6A3A4C',
  '#83AB58', '#001C1E', '#D1F7CE', '#004B28', '#C8D0F6', '#A3A489', '#806C66', '#222800',
  '#BF5650', '#E83000', '#66796D', '#DA007C', '#FF1A59', '#8ADBB4', '#1E0200', '#5B4E51',
  '#C895C5', '#320033', '#FF6832', '#66E1D3', '#CFCDAC', '#D0AC94', '#7ED379', '#012C58'];

export const predefinedColorPaletteGenerator = (
  size,
  {
    palette = christianColors
  } = {}
) => {
  if (isDevMode() && palette.length < size) {
    this.warningController.warn(`Predefined palette has not enough colors.`, palette, size);
  }
  return i => palette[i % palette.length];
};

export const colorPaletteGenerator = (
  size,
  {
    hue = (i, n) => i / n,
    saturation = (_i, _n): number => DEFAULT_SATURATION,
    lightness = (_i, _n): number => DEFAULT_LIGHTNESS,
    alpha = (_i, _n): number => DEFAULT_ALPHA
  } = {}
) => {
  return (i: number) => cubehelix(
    360 * hue(i, size),
    2 * saturation(i, size),
    lightness(i, size),
    alpha(i, size)
  );
};

// Calculates value for index `i` in between of min and max (not included)
// assuming the axis has been divided into `steps + 1` intervals
// with special case of only one interval when default value is returned.
// By design this function operates on floats as well as on integers.
function skewNorm(min: number, max: number, init: number, steps: number, i: number): number {
  if (steps <= 1.5) {
    return init;
  }
  const size = max - min;
  const step = size / (steps + 1);
  return min + step * (i + 1);
}

// Color palette gradually expanding from hue to saturation and lightness
export const expandingColorPalletGenerator = (
  size,
  {} = {}
) => {
  // Empirical value which scales importance of proportion between color components (PBCC) based on size
  // = 0 - PBCC is not affected by size
  // increase - PBCC is more neglectable for higher size
  // decrease - PBCC is more significant for higher size
  const unificationCoeff = 0.4;
  let hueCoeff = 32 / size + unificationCoeff;
  let satCoeff = 4 / size + unificationCoeff;
  let ligCoeff = 1 / size + unificationCoeff;
  if (hueCoeff >= size) {
    hueCoeff = size;
    satCoeff = 1;
    ligCoeff = 1;
  } else if (hueCoeff * satCoeff >= size) {
    satCoeff = size / hueCoeff;
    ligCoeff = 1;
  }
  // factor to normalise coefficients to make their multiplication equal to size
  // hueSteps * saturationSteps * lightnessSteps === size
  const normFact = Math.cbrt(size / (hueCoeff * satCoeff * ligCoeff));
  const hueSteps = hueCoeff * normFact;
  const saturationSteps = satCoeff * normFact;
  const lightnessSteps = ligCoeff * normFact;
  // 3d table (hueSteps x saturationSteps x lightnessSteps) walk based on i
  const hue = i => i % hueSteps / hueSteps;
  const saturation = i => skewNorm(
    0, 1, DEFAULT_SATURATION, saturationSteps,
    (i / hueSteps) % saturationSteps
  );
  const lightness = i => skewNorm(
    0.2, 0.8, DEFAULT_LIGHTNESS, lightnessSteps,
    (i / hueSteps / saturationSteps) % lightnessSteps
  );
  return colorPaletteGenerator(size, {
    hue, saturation, lightness
  });
};

export enum LINK_PALETTE_ID {
  hue_palette = 'Hue palette',
  adaptive_hue_sat_lgh = 'Adaptive hue, saturation, lightness',
  predefined_palette = 'Predefined palette'
}

export type LINK_PALETTES = { [paletteId in LINK_PALETTE_ID]: Palette };

export const linkPalettes: LINK_PALETTES = {
  [LINK_PALETTE_ID.hue_palette]: {
    name: LINK_PALETTE_ID.hue_palette,
    palette: colorPaletteGenerator
  },
  [LINK_PALETTE_ID.adaptive_hue_sat_lgh]: {
    name: LINK_PALETTE_ID.adaptive_hue_sat_lgh,
    palette: expandingColorPalletGenerator
  },
  [LINK_PALETTE_ID.predefined_palette]: {
    name: LINK_PALETTE_ID.predefined_palette,
    palette: predefinedColorPaletteGenerator
  }
};

export const createMapToColor = (arr, params, generator = colorPaletteGenerator) => {
  const uniq = arr instanceof Set ? arr : new Set(arr);
  const palette = generator(uniq.size, params);
  return new Map([...uniq].map((v, i) => [v, palette(i)]));
};
