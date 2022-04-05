from ncbi.ncbi_taxonomy_parser import TaxonomyParser
from common.database import *
from config.config import get_data_dir
import os

# default strain for their species for organism searching
LMDB_SPECIES_MAPPING_STRAIN = ['367830','511145', '272563', '208964', '559292']
DATA_SOURCE = 'NCBI Taxonomy'

def write_LMDB_annotation_file(database, base_dir, excluded_names=['environmental sample']):
    '''
    If species_only, export species and their children only
    :param excluded_names: list of tax names that should not be used for annotation
    :return:
    '''

    # find the strains that are used to replace its parent species for annotation
    query = """
    match p=(n:Taxonomy)-[:HAS_PARENT*0..]->(:Taxonomy {rank: 'species'}) 
    where n.{PROP_ID} in $tax_ids
    with nodes(p) as nodes, n 
    unwind nodes as p 
    with n, p where n <> p
    return n.{PROP_ID} as tax_id, p.{PROP_ID} as parent_id, p.name as parent_name
    """
    df = database.get_data(query, {'tax_ids': LMDB_SPECIES_MAPPING_STRAIN})
    replace_id_map = {}
    for index, row in df.iterrows():
        replace_id_map[row['parent_id']] = row['tax_id']
    parser = TaxonomyParser(base_dir)
    nodes = parser.parse_files()
    outfile = os.path.join(parser.output_dir, 'species_for_LMDB.tsv')

    with open(outfile, 'w') as f:
        f.write('tax_id\trank\tcategory\tname\tname_class\torig_tax_id\tdata_source\n')
        for node in nodes.values():
            if node.top_category and node.rank == 'species':
                _write_node_names(node, f, excluded_names, replace_id_map)


def _write_node_names(tax, file, exclude_node_names=[], replace_id_map=None):
    """
    recursively write node names and children names
    :param tax: tax node
    :param file: outfile
    :param exclude_node_names:
    :param replace_id_map:
    :return:
    """
    if exclude_node_names:
        # if tax name contains the exclude_node_name, return without writing
        for name in tax.names.keys():
            for exclude in exclude_node_names:
                if exclude in name:
                    return
    if replace_id_map and tax.tax_id in replace_id_map:
        tax.orig_id = tax.tax_id
        tax.tax_id = replace_id_map[tax.orig_id]

    lines = ''
    for name, name_class in tax.names.items():
        lines = lines + '\t'.join([tax.tax_id, tax.rank, tax.top_category, name, name_class, tax.orig_id, DATA_SOURCE]) + '\n'
    file.write(lines)
    for child in tax.children:
        _write_node_names(child, file, exclude_node_names, replace_id_map)


def main():
    database = get_database()
    # pass the write base_data_dir for the parser
    write_LMDB_annotation_file(database, get_data_dir())
    database.close()


if __name__ == "__main__":
    main()