from common.query_builder import *
from neo4j import GraphDatabase
from neo4j.exceptions import Neo4jError

from config.config import read_config
import logging
import pandas as pd


def get_database(dbname: str):
    """
    Get database instance based on environment variables
    :return: database instance
    """
    config = read_config()
    uri = config['neo4j']['uri']
    username = config['neo4j']['user']
    pwd = config['neo4j']['password']
    driver = GraphDatabase.driver(uri, auth=(username, pwd))
    return Database(driver, dbname)


class Database:
    def __init__(self, driver: GraphDatabase, dbname: str):
        self.driver = driver
        self.dbname = dbname
        self.logger = logging.getLogger(__name__)

    def close(self):
        self.driver.close()

    def create_database(self, database_name):
        with self.driver.session() as session:
            query = get_create_database_query(database_name)
            info = session.run(query).consume()
            self.logger(info.counters)

    def create_constraint(self, label: str, property_name: str, constraint_name=""):
        """
        Create neo4j constraint
        :param label: node label
        :param property_name: node property
        :param constrain_name: the name for the constraint (optional)
        """
        if not constraint_name:
            constraint_name = 'constraint_' + label + '_' + property_name
        query = get_create_constraint_query(label, property_name, constraint_name)
        self.logger.debug(query)
        with self.driver.session(database=self.dbname) as session:
            try:
                session.run(query)
            except Exception as error:
                self.logger.error("Could not create constraint %r. %r", constraint_name, error)

    def create_index(self, label: str, property_name, index_name=''):
        """
        Create neo4j index
        :param label: node label
        :param property_name: node property
        :param index_name: the name for the index (optional)
        """
        if not index_name:
            index_name = 'index_' + label.lower() + '_' + property_name
        query = get_create_index_query(label, property_name, index_name)
        with self.driver.session(database=self.dbname) as session:
            try:
                session.run(query)
            except Exception as error:
                self.logger.error("Could not create index %r. %r", index_name, error)

    def create_fulltext_index(self, index_name, node_labels: list, index_properties: list):
        query = get_create_fulltext_index_query()
        with self.driver.session(database=self.dbname) as session:
            try:
                session.run(query, indexName=index_name, labels=node_labels, properties=index_properties)
            except Exception as error:
                self.logger.error("Could not create index %r. %r", index_name, error)

    def run_query(self, query, **params):
        """
        Run query with parameter dict in the format {'rows': []}. Each row is a dict of prop_name-value pairs.
        e.g. for $dict = {'rows':[{'id': '123a', 'name':'abc'}, {'id':'456', 'name': 'xyz'}]}, the id_name should be 'id',
        and properties=['name']
        :param query: the cypher query with $dict parameter (see query_builder.py)
        :param params: the parameter in the format as described
        :return: None
        """
        with self.driver.session(database=self.dbname) as session:
            try:
                result = session.run(query, **params).consume()
                logging.info(result.counters)
            except Neo4jError as ex:
                self.logger.error(ex.message)

    def get_data(self, query:str, **params) -> pd.DataFrame:
        """
        Run query to get data as dataframe
        :param query: the query with parameter $dict (see query_builder.py)
        :param params: value passed to $dict, in format {'rows':[]} where the [] is a list of prop_name-value pairs.
        :return: dataframe for the result
        """
        with self.driver.session(database=self.dbname) as session:
            results = session.run(query, **params)
            # df = pd.DataFrame([dict(record) for record in results])
            df = pd.DataFrame(results.values(), columns=results.keys())
        return df

    def load_data_from_rows(self, query: str, data_rows: list, return_node_count: bool = False):
        """
        run the query by passing data rows
        :param query: the query with $dict parameter (see query_builder.py)
        :param data_rows: list of dict that can get from a dataframe as rows = dataframe.to_dict('records')
        :return_node_count: If True, return count. The query is expected to return COUNT(n).
        :return: ResultSummary.counters. If return_node_count=True, also return node_count.
        """
        with self.driver.session(database=self.dbname) as session:
            node_count = 0
            result = session.run(query, rows=data_rows)
            if return_node_count:
                record = result.single()
                if record:
                    node_count = record.value()
            info = result.consume()
            self.logger.info(info.counters)

            if return_node_count:
                return node_count, info.counters
            return info.counters

    def load_data_from_dataframe(self, query: str, data_frame: pd.DataFrame, chunksize=None):
        """
        Run query by passing dataframe
        :param data_frame: the dataframe to load
        :param query: the query with $dict parameter (see query_builder.py)
        :param chunksize: if set, the dataframe will be loaded in chunks.
        :return: none
        """
        with self.driver.session(database=self.dbname) as session:
            if chunksize:
                chunks = [data_frame[i:i + chunksize] for i in range(0, data_frame.shape[0], chunksize)]
                for chunk in chunks:
                    rows = chunk.fillna(value="").to_dict('records')
                    session.run(query, rows = rows)
                self.logger.info("Rows processed:" + str(len(data_frame)))
            else:
                rows = data_frame.fillna(value="").to_dict('records')
                result = session.run(query, rows=rows).consume()
                self.logger.info(result.counters)

    def load_csv_file(self, query:str, data_file: str, sep='\t', header='infer', colnames:[]=None, usecols = None,
                      skiprows=None, chunksize=None, dtype=None):
        """
        load csv file to neo4j database
        :param data_file: path to the file
        :param colnames: file headers (match database properties)
        :param query:  the query with $dict parameter (see query_builder.py)
        :param skiprows: number of rows skipped for reading
        :param sep: csv file delimiter
        :param chunksize: number of rows to read for each chunk
        :param dtype: pandas parameter, eg. converting column values to str, {PROP_ID: str}
        :return: number of items loaded
        """
        data_chunk = pd.read_csv(data_file, sep=sep, header=header, names=colnames, usecols=usecols,
                                 chunksize=chunksize, dtype=dtype, skiprows=skiprows, index_col=False)
        count = 0
        self.logger.info("Load file: " + data_file)
        self.logger.info("Query: " + query)
        with self.driver.session(database=self.dbname) as session:
            if not chunksize:
                df = data_chunk
                if usecols:
                    df = df.drop_duplicates()
                data_rows = df.fillna(value="").to_dict('records')
                result = session.run(query, rows=data_rows).consume()
                self.logger.info(result.counters)
            else:
                for i, chunk in enumerate(data_chunk):
                    if usecols:
                        chunk = chunk.drop_duplicates()
                    count = count + len(chunk)
                    data_rows = chunk.fillna(value="").to_dict('records')
                    result = session.run(query, rows=data_rows).consume()
                    # self.logger.info(result.counters)
                self.logger.info("Rows processed: " + str(count))

