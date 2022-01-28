export interface FilterEntity {
  id: string;
  type: string;
  color: string;
  text: string;
  frequency: number;
}

export interface Visibility {
  identifier: string;
  visible: boolean;
  entity: FilterEntity|WordCloudFilterEntity;
}

export interface WordCloudFilterEntity extends FilterEntity {
  shown: boolean;
  synonyms?: string[];
}

export enum DefaultGroupByOptions {
  NONE = 'None',
  ENTITY_TYPE = 'Entity Type',
  // Disabling this for now, maybe bring it back in the future
  // FILTERED = 'Filtered',
  // TODO: Might want to have this later, right now the API response for the combined s doesn't tell us what kind each row is
  // _TYPE = ' Type (Manual vs. Automatic)'
}

export enum DefaultOrderByOptions {
  FREQUENCY = 'Frequency',
}

export enum OrderDirection {
  ASCENDING = 'Ascending',
  DESCENDING = 'Descending'
}
