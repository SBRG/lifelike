from common.database import *
from common.constants import *
from datetime import datetime
from common.utils import write_compressed_tsv_file_from_dataframe


def _write_entity_list_for_LMDB(entity_node_label: str, database: Database, output_dir: str):
    query = f"match (n:{entity_node_label}:{NODE_MESH})-[:HAS_SYNONYM]-(s) return n.eid as id, n.name as name, s.name as synonym, n.data_source as data_source"
    df = database.get_data(query)
    datestr = datetime.now().strftime("%m%d%Y")
    filename = f"{entity_node_label}_list_for_LMDB_{datestr}.tsv"
    print("write", filename)
    write_compressed_tsv_file_from_dataframe(df, filename, output_dir)

def write_mesh_annotation_files(database, output_dir):
    _write_entity_list_for_LMDB(NODE_DISEASE, database, output_dir)
    _write_entity_list_for_LMDB(NODE_FOOD, database, output_dir)
    _write_entity_list_for_LMDB(NODE_ANATOMY, database, output_dir)
    _write_entity_list_for_LMDB(NODE_PHENOMENA, database, output_dir)
