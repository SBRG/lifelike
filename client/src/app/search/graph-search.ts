export interface GraphSearchParameters {
  query: string;
  domains?: string[];
  entities?: string[];
  organism?: string | null;
  page: number;
  limit: number;
}
