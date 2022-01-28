import { Hyperlink } from 'app/drawing-tool/services/interfaces';

export const SEARCH_LINKS: readonly Hyperlink[] = Object.freeze([
  {
    domain: 'NCBI_Taxonomy',
    url: 'https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=%s'
  },
  {
    domain: 'NCBI_Gene',
    url: 'https://www.ncbi.nlm.nih.gov/gene/?term=%s'
  },
  {
    domain: 'UniProt',
    url: 'https://www.uniprot.org/uniprot/?sort=score&query=%s'
  },
  {
    domain: 'MeSH',
    url: 'https://www.ncbi.nlm.nih.gov/mesh/?term=%s'
  },
  {
    domain: 'ChEBI',
    url: 'https://www.ebi.ac.uk/chebi/advancedSearchFT.do?searchString=%s'
  },
  {
    domain: 'PubChem',
    url: 'https://pubchem.ncbi.nlm.nih.gov/#query=%s'
  },
  {
    domain: 'Wikipedia',
    url: 'https://www.google.com/search?q=site:+wikipedia.org+%s'
  },
  {
    domain: 'Google',
    url: 'https://www.google.com/search?q=%s'
  }].map(item => Object.freeze(item)));
