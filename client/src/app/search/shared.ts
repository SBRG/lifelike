export interface SearchType {
  id: string;
  shorthand: string;
  name: string;
}

export interface SynonymData {
  type: string;
  name: string;
  organism: string;
  synonyms: string[];
}
