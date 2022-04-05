import pandas as pd
from common.database import *
from common.utils import get_data_dir
from datetime import datetime
from common.utils import write_compressed_tsv_file_from_dataframe


def generate_protein_list_for_LMDB(database, output_dir):
    """
    Export Uniprot Protein and synonyms to tsv file for LMDB annotation.
    Compound main change to Chemical in the future
    """
    query = """
    match(n:db_UniProt)--[:HAS_SYNONYM]-(s) 
    return n.eid as id, n.name as name, s.name as synonym,n.data_source as data_source
    """
    df = database.get_data(query)
    datestr = datetime.now().strftime("%m%d%Y")
    filename = f"Protein_list_for_LMDB_{datestr}.tsv"
    print("write", filename)
    write_compressed_tsv_file_from_dataframe(df, filename, output_dir)


if __name__ == '__main__':
    database = get_database()
    output_dir = get_data_dir()
    generate_protein_list_for_LMDB(database, output_dir)
    database.close()


