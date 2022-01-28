/**
 * Till the time we have some mechanism to share these value this file contains copy of values from scss file with
 * the same name.
 */

export enum NodePosition {
  left,
  right,
  multi
}

export const nodeLightness = 60;
export const nodeSaturation = 40;

export const nodeColor = `hsl(0, 0, ${nodeLightness}%)`;

export const nodeColors = new Map<NodePosition, string>([
  [NodePosition.left, `#0065f4`],
  [NodePosition.right, `#ffb72e`],
  [NodePosition.multi, `hsl(180, ${nodeSaturation}%, ${nodeLightness}%)`],
]);
