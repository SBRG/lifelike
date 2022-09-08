"""
Generate changelogs file to the $basedir, then users can move the file to the specific liquibase changelogs folder,
and rename the file.  This is mainly used for generating loading file after data parsed to tsv files
"""
from mako.template import Template
from config.config import Config
from common.query_builder import *
from common.constants import *
import os, logging
from datetime import datetime
import pandas as pd

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s',
                    handlers=[logging.StreamHandler()])

sql_template = 'sql_change_set.template'
custom_template = 'custom_change_set.template'
changelog_template = 'changelog.template'

CUSTOM_PARAMS = """
      neo4jHost="${neo4jHost}"
      neo4jCredentials="${neo4jCredentials}"
      neo4jDatabase="${neo4jDatabase}"
      localSaveFileDir="${localSaveFileDir}"
"""

QUERY_HANDLER = 'edu.ucsd.sbrg.ZipFileQueryHandler'

class ChangeLogFileGenerator(object):
    """
    The generator would expect a zip file containing tsv files for nodes, synonyms, relationships and others (e.g. dblinks).
    Expected File names in zip file as EntityName.tsv, EntityName-synonyms.tsv, EntityName-rels.tsv

    """
    def __init__(self, author, zipfile:str, db_source:str, entity_label:str, initial_load=True, basedir=None):
        """
        author: user name for changelog comment
        zipfile: zipfile name for the data files in tsv format. It should be located in processed_data_dir
        db_source: data source, e.g. BioCyc, GO, UniProt, CHEBI
        entity_label: node label, e.g. Gene, Protein,
        inital_load: if initial load, create indexes and constraints
        basedir: base data dir, under the data dir, there are subfolders 'download', 'processed', 'changelogs'
        """
        self.author = author
        self.initial_load = initial_load
        self.zipfile = zipfile
        self.db_source = db_source
        self.entity_label = entity_label
        if not basedir:
            basedir = Config().data_dir
        self.basedir = basedir
        self.processed_data_dir = os.path.join(self.basedir, 'processed', db_source.lower())
        self.output_dir = os.path.join(self.basedir, 'changelogs', db_source.lower())
        os.makedirs(self.output_dir, 0o777, True)

        self.date_tag = datetime.today().strftime('%m/%d/%Y')
        self.change_sets = []
        self.logger = logging.getLogger(__name__)

    def add_all_change_sets(self):
        if self.initial_load:
            self.add_index_changesets()
        self.add_node_changesets()
        self.add_synonym_changesets()
        self.add_relationship_changesets()

    def generate_changelog_file(self, outfile):
        if not self.change_sets:
            self.logger.error('Need to call create_change_logs first')
            return
        template = self.get_template(changelog_template)
        changes = []
        for cs in self.change_sets:
            s = cs.create_changelog_str()
            # self.logger.info(s)
            changes.append(s)
        change_str = '\n\n'.join(changes)
        file = os.path.join(self.output_dir, outfile)
        self.logger.info('write file ' + file)
        with open(file, 'w') as f:
            f.write(template.render(change_sets_str=change_str))

    def get_create_index_queries(self):
        pass

    def add_index_changesets(self):
        id = f'Create {self.db_source} constraints and indexes'
        comment = f"Create constraints and indexes for {self.db_source} nodes, created on {self.date_tag}"
        queries = self.get_create_index_queries()
        query_str = '\n'.join(queries)
        changeset = ChangeSet(id, self.author, comment, query_str)
        self.change_sets.append(changeset)

    def add_node_changesets(self):
        pass

    def add_synonym_changesets(self):
        pass

    def add_relationship_changesets(self):
        pass

    def get_node_changeset(self, df: pd.DataFrame, filename:str,  entity_label: str,
                            db_label=None, other_labels=[], row_filter_col=None, row_filter_val=None):
        """
        Generate cypher query for creating nodes. By default, db_label contraint is used for insertion. If use
        entity, need to override the method to create a different query
        """
        id = f'load {entity_label} from {self.zipfile}, date {self.date_tag}'
        comment = f'load {self.db_source} {filename} from {self.zipfile}, {len(df)} rows'
        attrs = list(df.columns)
        if not db_label:
            db_label = 'db_' + self.db_source
        additional_labels = [entity_label] + other_labels
        query = get_create_update_nodes_query(db_label, PROP_ID, attrs,
                                              additional_labels=additional_labels,
                                              datasource=self.db_source,
                                              row_filter_property=row_filter_col,
                                              row_filter_value=row_filter_val
                                              )
        changeset = CustomChangeSet(id, self.author, comment, query,
                                    handler=QUERY_HANDLER,
                                    filename=filename,
                                    zipfile=self.zipfile)
        return changeset

    def get_synonym_changeset(self, filename, entity_label, rel_props=[]):
        """
        Generate cypher query for creating node-synonym relationships.
        """
        id = f'load {entity_label} synonyms from {self.zipfile}, date {self.date_tag}'
        comment = f'Load {self.db_source} {filename} from {self.zipfile}'
        query = get_create_synonym_relationships_query(entity_label, PROP_ID, PROP_ID, PROP_NAME,
                                                       rel_properties=rel_props)
        changeset = CustomChangeSet(id, self.author, comment, query,
                                    handler=QUERY_HANDLER,
                                    filename=filename,
                                    zipfile=self.zipfile)
        return changeset

    def get_relationships_changesets(self, df:pd.DataFrame, filename:str, from_node_label, to_node_label, rel_props=[]):
        """
        Generate cypher query for creating node-relationships.
        """
        rels = df[REL_RELATIONSHIP].drop_duplicates()
        changesets = []
        for rel in rels:
            id = f'load {rel} relationship in {filename} from {self.zipfile}, date {self.date_tag}'
            comment = f'Load {self.db_source} {rel} relationships, {filename} from {self.zipfile}'
            query = get_create_relationships_query(from_node_label, PROP_ID, PROP_FROM_ID,
                                                   to_node_label, PROP_ID, PROP_TO_ID, rel,
                                                   rel_properties=rel_props,
                                                   row_filter_property=REL_RELATIONSHIP,
                                                   row_filter_value=rel)
            changeset = CustomChangeSet(id, self.author, comment, query,
                                        handler=QUERY_HANDLER,
                                        filename=filename,
                                        zipfile=self.zipfile)
            changesets.append(changeset)

        return changesets

    @classmethod
    def get_template(cls, templatefilename):
        return Template(filename=os.path.join(Config().get_changelog_template_dir(), templatefilename))

    def generate_sql_changelog_file(self, id, comment, cypher, outfile_name):
        change_set = ChangeSet(id, self.author, comment, cypher)
        temp = self.get_template(changelog_template)
        with open(os.path.join(self.output_dir, outfile_name), 'w') as f:
            f.write(temp.render(change_sets_str=change_set.create_changelog_str()))


class ChangeSet:
    def __init__(self, id, author: str, comment: str, cypher: str):
        self.id = id
        self.author = author
        self.comment = comment
        self.cypher = cypher

    def create_changelog_str(self):
        template = ChangeLogFileGenerator.get_template(sql_template)
        # liquibase doesn't like the `<` character
        self.cypher = self.cypher.replace('<', '&lt;')
        return template.render(change_id=self.id, author=self.author, change_comment=self.comment, cypher_query=self.cypher)


class CustomChangeSet(ChangeSet):
    def __init__(self, id, author, comment, cypher,
                 filename:str,
                 zipfile: str,
                 handler=QUERY_HANDLER,
                 startrow=1):
        ChangeSet.__init__(self, id, author, comment, cypher)
        self.handler = handler
        self.filename = filename
        self.zipFile = zipfile
        self.start_at = startrow

    def create_changelog_str(self):
        template = ChangeLogFileGenerator.get_template(custom_template)
        return template.render(change_id=self.id, change_comment=self.comment, author=self.author,
                               handler_class=self.handler, cypher_query=self.cypher, data_file=self.filename,
                               zip_file=self.zipFile, start_at=self.start_at, params=CUSTOM_PARAMS)



