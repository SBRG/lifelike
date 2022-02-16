import { ViewBase } from './interfaces';

export const viewBaseToNameMapping = {
  [ViewBase.sankey]: 'Multi-Lane View',
  [ViewBase.sankeyManyToMany]: 'Single-Lane View'
};

export function extractDescriptionFromSankey(text: string): string {
  try {
    const content = JSON.parse(text);
    return content.graph.description || '';
  } catch (e) {
    return '';
  }
}
