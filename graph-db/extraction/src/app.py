import argparse
import logging
import logging.handlers
import sys
from pathlib import Path

import coloredlogs

import biocyc.biocyc_parser as biocyc_parser
import chebi.chebi_parser as chebi_parser
import enzyme.enzyme_parser as enzyme_parser
import go.go_parser as go_parser
import kegg.kegg_parser as kegg_parser
import mesh.mesh_parser as mesh_parser
import mesh.add_disease_synonyms_by_pruning_disease as add_disease_synonyms_by_pruning_disease
import mesh.mesh_annotations as mesh_annotations
import ncbi.ncbi_gene_parser as ncbi_gene_parser
import ncbi.ncbi_taxonomy_parser as ncbi_taxonomy_parser
import literature.literature_data_parser as literature_data_parser
import regulondb.regulondb_parser as regulondb_parser
import stringdb.stringdb_parser as stringdb_parser
import uniprot.uniprot_parser as uniprot_parser

_LOG_FORMAT = '%(asctime)s %(levelname)s %(message)s'
_LOG_MAX_SIZE = 1024 * 1024
_LOG_MAX_FILES = 5

DOMAIN_PARSERS = {
    'biocyc': biocyc_parser,
    'chebi': chebi_parser,
    'enzyme': enzyme_parser,
    'go': go_parser,
    'kegg': kegg_parser,
    'mesh': mesh_parser,
    'mesh-add-disease-synonyms': add_disease_synonyms_by_pruning_disease,
    'mesh-annotations': mesh_annotations,
    'ncbi-gene': ncbi_gene_parser,
    'ncbi-taxonomy': ncbi_taxonomy_parser,
    'regulondb': regulondb_parser,
    'stringdb': stringdb_parser,
    'uniprot': uniprot_parser,
    'zenodo-literature': literature_data_parser
}


def get_domain_parser(domain: str):
    return DOMAIN_PARSERS[domain]


def parse_args(argv):
    parser = argparse.ArgumentParser()

    parser.add_argument(
        '--log-file',
        help='Append log messages to file; files are rotated at 1MB',
        type=Path,
    )
    parser.add_argument(
        '--log-level',
        default='INFO',
        choices=('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'),
    )
    parser.add_argument('--prefix', help='The JIRA card numeric number; e.g LL-1234')

    subparser = parser.add_subparsers(dest='domain', required=True)
    biocyc_parser = subparser.add_parser('biocyc')
    biocyc_parser.add_argument(
        '--data-sources',
        nargs='*',
        help='A list of data sources to load, e.g. PseudomonasCyc YeastCyc EcoCyc HumanCyc',
    )

    # parsers with no additional arguments
    subparser.add_parser('chebi')
    subparser.add_parser('enzyme')
    subparser.add_parser('go')
    subparser.add_parser('kegg')
    subparser.add_parser('mesh')
    subparser.add_parser('mesh-add-disease-synonyms')
    subparser.add_parser('mesh-annotations')
    subparser.add_parser('ncbi-gene')
    subparser.add_parser('ncbi-taxonomy')
    subparser.add_parser('regulondb')
    subparser.add_parser('stringdb')
    subparser.add_parser('uniprot')
    subparser.add_parser('zenodo-literature')

    return parser.parse_args(argv)


def setup_logging(args):
    coloredlogs.install(fmt=_LOG_FORMAT, level=args.log_level)

    root_log = logging.getLogger()
    if args.log_file is not None:
        handler = logging.handlers.RotatingFileHandler(
            filename=args.log_file, maxBytes=_LOG_MAX_SIZE, backupCount=_LOG_MAX_FILES
        )
        handler.setFormatter(logging.Formatter(_LOG_FORMAT))

        root_log.addHandler(handler)


def main(argv):
    args = parse_args(argv)

    setup_logging(args)

    logger = logging.getLogger('main')
    logger.info(
        'Executing '
        + __file__
        + ' with arguments: '
        + ', '.join(['%s=%s' % (key, value) for (key, value) in args.__dict__.items()])
    )

    try:
        int(args.prefix.split('-')[1])
    except Exception:
        raise ValueError('The argument change_id_prefix must be the JIRA card number; e.g LL-1234')

    # get parser function using args.domain
    parser = get_domain_parser(args.domain)

    # call main function and pass arguments
    parser.main(args)


if __name__ == '__main__':
    main(sys.argv[1:])
