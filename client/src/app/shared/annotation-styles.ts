// TODO - Create sub-types for mutation
// - snp
// - sub
// - del
// - ins
// - mob
// - amp
// - con
// - inv

interface AnnotationStyle {
  // Mandatory fields

  label: string;
  color: string;
  // Optional fields
  iconCode?: string;
  subtypes?: string[];
  style?: {
    // Override the border-color of the node on vis-network
    border?: string;
    // Override the background-color of the node on vis-network
    background?: string;
    // Override the font-color of the node on the vis-network
    color?: string;
  };
}

const GENE = '#673ab7';
const DISEASE = '#ff9800';
const CHEMICAL = '#4caf50';
const COMPOUND = '#4caf50';
const MUTATION = '#5d4037';
const SPECIES = '#3177b8';
const COMPANY = '#d62728';
const STUDY = '#17becf';
const PROTEIN = '#bcbd22';
const PATHWAY = '#e377c2';
const PHENOMENA = '#edc949';
const PHENOTYPE = '#edc949';
const FOOD = '#8eff69';
const ANATOMY = '#0202bd';
const LABSAMPLE = '#f71698';
const LABSTRAIN = '#f71698';

const NOTE = '#edc949';
const MAP = '#0277bd';

const ENTITY = '#7f7f7f';
const LINK = '#669999';

// Non-Entity Types
const CORRELATION = '#d7d9f8';
const CAUSE = '#d7d9f8';
const EFFECT = '#d7d9f8';
const OBSERVATION = '#d7d9f8';
const ASSOCIATION = '#d7d9f8';

// const IMAGE = '#FFFFFF';


const annotationTypes: AnnotationStyle[] = [
  {
    label: 'gene',
    color: GENE,
  },
  {
    label: 'disease',
    color: DISEASE,
  },
  {
    label: 'chemical',
    color: CHEMICAL,
  },
  {
    label: 'compound',
    color: COMPOUND,
  },
  {
    label: 'mutation',
    color: MUTATION,
    subtypes: [
      'SNP',
      'SUB',
      'DEL',
      'INS',
      'MOB',
      'AMP',
      'CON',
      'INV'
    ],
  },
  {
    label: 'species',
    color: SPECIES,
  },
  {
    label: 'company',
    color: COMPANY,
  },
  {
    label: 'study',
    color: STUDY,
  },
  {
    label: 'protein',
    color: PROTEIN,
  },
  {
    label: 'pathway',
    color: PATHWAY,
  },
  {
    label: 'phenomena',
    color: PHENOMENA,
  },
  {
    label: 'phenotype',
    color: PHENOTYPE,
  },
  {
    label: 'food',
    color: FOOD,
  },
  {
    label: 'anatomy',
    color: ANATOMY,
  },
  {
    label: 'lab sample',
    color: LABSAMPLE,
  },
  {
    label: 'lab strain',
    color: LABSTRAIN,
  },
  {
    label: 'link',
    color: LINK,
    iconCode: '\uf0c1'
  },
  {
    label: 'entity',
    color: ENTITY,
  },
  {
    label: 'map',
    color: MAP,
    iconCode: '\uf542'
  },
  {
    label: 'note',
    color: NOTE,
    iconCode: '\uf249'
  },
  // Non-Entity types
  {
    label: 'correlation',
    color: CORRELATION,
    style: {
      border: CORRELATION,
      background: CORRELATION,
      color: '#000'
    },
  },
  {
    label: 'cause',
    color: CAUSE,
    style: {
      border: CAUSE,
      background: CAUSE,
      color: '#000'
    },
  },
  {
    label: 'effect',
    color: EFFECT,
    style: {
      border: EFFECT,
      background: EFFECT,
      color: '#000'
    },
  },
  {
    label: 'observation',
    color: OBSERVATION,
    style: {
      border: OBSERVATION,
      background: OBSERVATION,
      color: '#000'
    },
  },
  {
    label: 'association',
    color: ASSOCIATION,
    style: {
      border: ASSOCIATION,
      background: ASSOCIATION,
      color: '#000'
    },
  },
  /**
   * Adding image here allows to change the entity type to image and adds it to a pallete. Currently, we cannot
   * handle such behaviour. If we decide to add additional image handling options (like adding additional tab,
   * where we can handle uploading from file/resizing ect.), we should uncomment that
   */
  // {
  //   label: 'image',
  //   color: IMAGE,
  //   style: {
  //     border: IMAGE,
  //     background: IMAGE,
  //     color: '#000',
  //   }
  // },
];

const annotationTypesMap: Map<string, AnnotationStyle> = annotationTypes.reduce((map, item) => {
  map.set(item.label, item);
  return map;
}, new Map());

/**
 * Return group styling based on the annotation
 * style definition
 * @param ann - annotation style definition
 */
function groupStyle(ann: AnnotationStyle) {
  const gStyle: any = {
    borderWidth: 1,
    color: {
      background: ann.style && ann.style.background ? ann.style.background : '#fff',
      border: ann.style && ann.style.border ? ann.style.border : '#2B7CE9'
    },
    font: {
      color: ann.style && ann.style.color ? ann.style.color : ann.color
    }
  };

  if (ann.iconCode) {
    gStyle.icon = {
      face: 'FontAwesome',
      weight: 'bold',
      code: ann.iconCode,
      size: 50,
      color: ann.color
    };
    gStyle.shape = 'icon';
  }

  return gStyle;
}

/**
 * Return group style dictionary for nodes of
 * different group types for vis-js network library
 */
function visJsGroupStyleFactory() {
  const groupStyleDict = {};

  annotationTypes.map(
    ann => {
      groupStyleDict[ann.label] = groupStyle(ann);
    }
  );

  return groupStyleDict;
}

export {
  AnnotationStyle,
  annotationTypes,
  annotationTypesMap,
  visJsGroupStyleFactory
};
