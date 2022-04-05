import pandas as pd
from common.database import *
from common.utils import get_data_dir


def load_pruned_terms_as_disease_synonym(file, database):
    """
    Check all disease synonyms that end with 'Disease' or 'disease', then prune the disease term at end and add the pruned term
    as the disease synonym.
    Since a lot of terms after pruning disease did not make a good disease name, Sharon manually checked each of the terms,
    and marked as status 'remove' if the term did not make sense.
    """
    df = pd.read_csv(file, skiprows=1, names=['mesh_id', 'name', 'synonym', 'pruned_syn', 'status'])
    print(len(df))
    df = df[df['status'].isna()]
    print(len(df))
    query = """
        with  $dict.rows as rows unwind rows as row
        match(n:db_MESH {id:row.mesh_id}) 
        merge (s:Synonym {name:row.pruned_syn}) 
        merge (n)-[r:HAS_SYNONYM]->(s) set r.created_date = datetime()
    """
    database.load_data_from_dataframe(df, query)


def main():
    file = os.path.join(get_data_dir(), "Pruned mesh_terms_ends_with_disease.csv")
    database = get_database()
    load_pruned_terms_as_disease_synonym(file, database)
    database.close()


if __name__ == "__main__":
    main()
