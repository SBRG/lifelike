/* PDF search result backend representation  */
export interface PDFResult {
  hits: [PDFSnippets];
  maxScore: number;
  total: number;
}

/* Results representation of elastic search hit*/
export interface PDFSnippets {
  file_id: string;
  doi: string;
  email: string;
  external_url: string;
  filename: string;
  description: string;
  uploaded_date: string;
  preview_text: string;
  project_directory: string;
  annotations: [any];
}
