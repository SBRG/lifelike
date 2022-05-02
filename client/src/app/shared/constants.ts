export const NODE_EXPANSION_LIMIT = 500;
export const NODE_EXPANSION_CLUSTERING_RECOMMENDATION = 200;
export const SNIPPET_RESULT_LIMIT = 10000;
export const SNIPPET_PAGE_LIMIT = 25;

export const PUBMED_URL = 'https://pubmed.ncbi.nlm.nih.gov/';
export const PUBTATOR_URL = 'https://www.ncbi.nlm.nih.gov/research/pubtator/';
export function getPubtatorSearchUrl(searchTerm: string) {
  return `${PUBTATOR_URL}?view=docsum&query=${searchTerm}`;
}

export const VIZ_SEARCH_LIMIT = 10;

export enum DBHostname {
  ChEBI = 'www.ebi.ac.uk',
  UniProt = 'www.uniprot.org',
  NCBI = 'www.ncbi.nlm.nih.gov',
  GO = 'amigo.geneontology.org'
}

export enum AnnotationType {
  Chemical = 'Chemical',
  Compound = 'Compound',
  Disease = 'Disease',
  Gene = 'Gene',
  Protein = 'Protein',
  Species = 'Species',
  Phenotype = 'Phenotype',
  Company = 'Company',
  Mutation = 'Mutation',
  Pathway = 'Pathway',
  Entity = 'Entity',
}

export const LOGOUT_SUCCESS = '[Auth] Logout Success';

/** API response that contains the following message is
 * used as a flag to determine a user's course of action
 * within the auth-interceptors.
 */
export const JWT_AUTH_TOKEN_EXPIRED = 'auth token has expired';
export const JWT_AUTH_TOKEN_INVALID = 'auth token is invalid';
export const JWT_REFRESH_TOKEN_EXPIRED = 'refresh token has expired';
export const JWT_REFRESH_TOKEN_INVALID = 'refresh token is invalid';

export const LINK_NODE_ICON_OBJECT = {
  face: 'FontAwesome',
  weight: 'bold', // Font Awesome 5 doesn't work properly unless bold.
  code: '\uf15b',
  size: 50,
  color: '#669999',
};

export const DEFAULT_CLUSTER_ROWS = 5;

export const ORGANISM_SHORTLIST = new Map<string, string>([
  ['Escherichia coli K12 MG1655',	'511145'],
  ['Saccharomyces cerevisiae S288C',	'559292'],
  ['Pseudomonas aeruginosa PAO1',	'208964'],
  ['Clostridium difficile	Strain 630',	'272563'],
  ['Staphylococcus aureus USA300',	'367830'],
  ['Homo sapiens', '9606']
]);

export const KG_VIZ_FILTER_TYPES = [
  'Biological Process',
  'Cellular Component',
  'Chemical',
  'Disease',
  'Gene',
  'Molecular Function',
  'Protein',
  'Taxonomy'
];

export const KG_VIZ_DOMAINS = ['ChEBI', 'GO', 'Literature', 'MeSH', 'NCBI', 'UniProt'];

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 50;

export const MAX_DESCRIPTION_LENGTH = 5000;
export const FORMATS_WITH_POSSIBLE_DESCRIPTION = ['graph'];

export enum MimeTypes {
  Map = 'vnd.lifelike.document/map',
  EnrichmentTable = 'vnd.lifelike.document/enrichment-table',
  Directory = 'vnd.lifelike.filesystem/directory',
  Graph = 'vnd.lifelike.document/graph',
  Pdf = 'application/pdf',
  BioC = 'vnd.lifelike.document/bioc'
}

export enum FAClass {
  Directory = 'fa fa-folder',
  Map = 'fa fa-project-diagram',
  Graph = 'fak fa-diagram-sankey-solid',
  EnrichmentTable = 'fa fa-table',
  Pdf = 'fa fa-file-pdf',
  BioC = 'fa fa-file',
  Default = 'fa fa-file',
  Excel = 'fak fa-excel-solid',
  PowerPoint = 'fak fa-powerpoint-solid',
  Word = 'fak fa-word-solid',
  Cytoscape = 'fak fa-cytoscape-solid',

}

export enum Unicodes {
  Directory = '\uf07b',
  Map = '\uf542',
  EnrichmentTable = '\uf0ce',
  Pdf = '\uf1c1',
  BioC = '\uf15b',
  Mail = '\uf0e0',
  Project = '\uf5fd',
  Default = '\uf15b',
  // Careful using this, since it will only work when the font-family is specified as 'Font Awesome Kit.' This is normally done
// with the 'fak' css class, and should ONLY be done with icons we have manually added to the kit. If you use this font with any
// other unicode values, they WILL NOT work.
  Graph = '\ue000',
  Excel = '\ue001',
  Word = '\ue002',
  PowerPoint = '\ue003',
  Cytoscape = '\ue004'
}
// Colors used to render microsoft icons - they should not change
export enum CustomIconColors {
  Excel = '#2e7d32',
  Word = '#0d47a1',
  PowerPoint = '#e64a19',
  Cytoscape = '#ea9123'
}

// We need to specify different font family for custom icons (see comment about graph unicode above)
export const FA_CUSTOM_ICONS = [Unicodes.Graph, Unicodes.Excel, Unicodes.Word, Unicodes.PowerPoint, Unicodes.Cytoscape];

// Regex used to check if a map link is pointing to a file that can be looking for associated maps
export const associatedMapsRegex = /^\/projects\/(?:[^\/]+)\/[^\/]+\/([a-zA-Z0-9-]+)/;

export const handleBlue = '#97C2FC';

export const COUNTRY_NAME_LIST = [
  'Afghanistan',
  'Albania',
  'Algeria',
  'Andorra',
  'Angola',
  'Antigua & Deps',
  'Argentina',
  'Armenia',
  'Australia',
  'Austria',
  'Azerbaijan',
  'Bahamas',
  'Bahrain',
  'Bangladesh',
  'Barbados',
  'Belarus',
  'Belgium',
  'Belize',
  'Benin',
  'Bhutan',
  'Bolivia',
  'Bosnia Herzegovina',
  'Botswana',
  'Brazil',
  'Brunei',
  'Bulgaria',
  'Burkina',
  'Burundi',
  'Cambodia',
  'Cameroon',
  'Canada',
  'Cape Verde',
  'Central African Rep',
  'Chad',
  'Chile',
  'China',
  'Colombia',
  'Comoros',
  'Congo',
  'Costa Rica',
  'Croatia',
  'Cuba',
  'Cyprus',
  'Czech Republic',
  'Denmark',
  'Djibouti',
  'Dominica',
  'Dominican Republic',
  'East Timor',
  'Ecuador',
  'Egypt',
  'El Salvador',
  'Equatorial Guinea',
  'Eritrea',
  'Estonia',
  'Ethiopia',
  'Fiji',
  'Finland',
  'France',
  'Gabon',
  'Gambia',
  'Georgia',
  'Germany',
  'Ghana',
  'Greece',
  'Grenada',
  'Guatemala',
  'Guinea',
  'Guinea-Bissau',
  'Guyana',
  'Haiti',
  'Honduras',
  'Hungary',
  'Iceland',
  'India',
  'Indonesia',
  'Iran',
  'Iraq',
  'Ireland',
  'Israel',
  'Italy',
  'Ivory Coast',
  'Jamaica',
  'Japan',
  'Jordan',
  'Kazakhstan',
  'Kenya',
  'Kiribati',
  'Korea North',
  'Korea South',
  'Kosovo',
  'Kuwait',
  'Kyrgyzstan',
  'Laos',
  'Latvia',
  'Lebanon',
  'Lesotho',
  'Liberia',
  'Libya',
  'Liechtenstein',
  'Lithuania',
  'Luxembourg',
  'Macedonia',
  'Madagascar',
  'Malawi',
  'Malaysia',
  'Maldives',
  'Mali',
  'Malta',
  'Marshall Islands',
  'Mauritania',
  'Mauritius',
  'Mexico',
  'Micronesia',
  'Moldova',
  'Monaco',
  'Mongolia',
  'Montenegro',
  'Morocco',
  'Mozambique',
  'Myanmar',
  'Namibia',
  'Nauru',
  'Nepal',
  'Netherlands',
  'New Zealand',
  'Nicaragua',
  'Niger',
  'Nigeria',
  'Norway',
  'Oman',
  'Pakistan',
  'Palau',
  'Panama',
  'Papua New Guinea',
  'Paraguay',
  'Peru',
  'Philippines',
  'Poland',
  'Portugal',
  'Qatar',
  'Romania',
  'Russian Federation',
  'Rwanda',
  'St Kitts & Nevis',
  'St Lucia',
  'Saint Vincent & the Grenadines',
  'Samoa',
  'San Marino',
  'Sao Tome & Principe',
  'Saudi Arabia',
  'Senegal',
  'Serbia',
  'Seychelles',
  'Sierra Leone',
  'Singapore',
  'Slovakia',
  'Solomon Islands',
  'Somalia',
  'South Africa',
  'South Sudan',
  'Spain',
  'Sri Lanka',
  'Sudan',
  'Suriname',
  'Swaziland',
  'Sweden',
  'Switzerland',
  'Syria',
  'Taiwan',
  'Tajikistan',
  'Tanzania',
  'Thailand',
  'Togo',
  'Tonga',
  'Trinidad & Tobago',
  'Tunisia',
  'Turkey',
  'Turkmenistan',
  'Tuvalu',
  'Uganda',
  'Ukraine',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Uruguay',
  'Uzbekistan',
  'Vanuatu',
  'Vatican City',
  'Venezuela',
  'Vietnam',
  'Yemen',
  'Zambia',
  'Zimbabwe',
];
export enum SizeUnits {
  KiB = 2e10,
  MiB = 2e20,
  GiB = 2e30,
  TiB = 2e40
}
