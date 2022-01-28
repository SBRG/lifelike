import { FTSQueryRecord } from 'app/interfaces';

const DOMAINS_URL = {
  CHEBI: 'https://www.ebi.ac.uk/chebi/searchId.do?chebiId=',
  MESH: 'https://www.ncbi.nlm.nih.gov/mesh/?term=',
  UniProt: 'https://www.uniprot.org/uniprot/',
  GO: 'http://amigo.geneontology.org/amigo/term/',
  NCBI_Gene: 'https://www.ncbi.nlm.nih.gov/gene/',
  NCBI_Taxonomy: 'https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=',
};

export function getLink(data: FTSQueryRecord) {
  const domain = data.node.domainLabels[0].split('_')[1];
  const type = data.node.label;
  if (domain === 'NCBI' && type === 'Gene') {
    return DOMAINS_URL[domain + '_' + type] + data.node.data.eid;
  } else if (domain === 'NCBI' && type === 'Taxonomy') {
    return DOMAINS_URL[domain + '_' + type] + data.node.data.eid;
  } else if (domain === 'GO' || domain === 'UniProt') {
    return DOMAINS_URL[domain] + `GO:${data.node.data.eid}`;
  } else {
    return DOMAINS_URL[domain] + data.node.data.eid;
  }
}
