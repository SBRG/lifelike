from common.database import *
from common.constants import *
from datetime import datetime
from common.utils import write_compressed_tsv_file_from_dataframe

def write_chemical_list_for_LMDB(database: Database, output_dir: str):
    query = f"""
    match (n:{NODE_CHEMICAL}:{NODE_CHEBI})-[:HAS_SYNONYM]-(s) 
    return n.{PROP_ID} as id, n.name as name, s.name as synonym, n.data_source as data_source
    """
    df = database.get_data(query)
    datestr = datetime.now().strftime("%m%d%Y")
    filename = f"{NODE_CHEMICAL}_list_for_LMDB_{datestr}.tsv"
    write_compressed_tsv_file_from_dataframe(df, filename, output_dir)
