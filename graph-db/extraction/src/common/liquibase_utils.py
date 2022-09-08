import os
import logging
import sys

from mako.template import Template
from common.utils import *

template_dir = os.path.join(get_data_dir(), 'templates')
sql_template = 'sql_changeset.template'
custom_template = 'custom_changeset.template'
changelog_template = 'changelog.template'

CUSTOM_PARAMS = """
      neo4jHost="${neo4jHost}"
      neo4jCredentials="${neo4jCredentials}"
      neo4jDatabase="${neo4jDatabase}"
      azureStorageName="${azureStorageName}"
      azureStorageKey="${azureStorageKey}"
      localSaveFileDir="${localSaveFileDir}"
"""


def get_template(templatefilename):
    return Template(filename=os.path.join(template_dir, templatefilename))


def get_changelog_template():
    return get_template(changelog_template)


class ChangeLog:
    def __init__(self, author: str, change_id_prefix: str):
        if not change_id_prefix:
            raise ValueError('The argument change_id_prefix must not be null or empty string')

        try:
            int(change_id_prefix.split('-')[1])
        except Exception:
            raise ValueError('The argument change_id_prefix must be the JIRA card number; e.g LL-1234')
        self.author = author
        self.id_prefix = change_id_prefix
        self.file_prefix = f'jira-{change_id_prefix}-'

        self.logger = logging.getLogger(__name__)
        self.logger.setLevel(logging.DEBUG)
        _handler = logging.StreamHandler(stream=sys.stdout)
        self.logger.addHandler(_handler)

    def generate_liquibase_changelog_file(self, outfile, directory):
        if not self.change_sets:
            self.logger.error('Need to call create_change_logs first')
            return
        template = get_changelog_template()
        changes = []
        for cs in self.change_sets:
            s = cs.create_changelog_str()
            self.logger.info(s)
            changes.append(s)
        change_str = '\n\n'.join(changes)
        with open(os.path.join(directory, outfile), 'w') as f:
            f.write(template.render(change_sets_str=change_str))


class ChangeSet:
    def __init__(self, id, author: str, comment: str, cypher: str):
        self.id = id
        self.author = author
        self.comment = comment
        self.cypher = cypher

    def create_changelog_str(self):
        template = get_template(sql_template)
        # liquibase doesn't like the `<` character
        self.cypher = self.cypher.replace('<', '&lt;')
        return template.render(change_id=self.id, author=self.author, change_comment=self.comment, cypher_query=self.cypher)


class CustomChangeSet(ChangeSet):
    def __init__(self, id, author, comment, cypher,
                 filename:str,
                 handler="edu.ucsd.sbrg.FileQueryHandler",
                 filetype='TSV',
                 startrow=1):
        ChangeSet.__init__(self, id, author, comment, cypher)
        self.handler = handler
        self.filename = filename.replace('.tsv', '.zip')
        self.filetype = filetype
        self.start_at = startrow

    def create_changelog_str(self):
        template = get_template(custom_template)
        return template.render(change_id=self.id, change_comment=self.comment, author=self.author,
                               handler_class=self.handler, cypher_query=self.cypher, data_file=self.filename,
                               start_at=self.start_at, file_type=self.filetype, params=CUSTOM_PARAMS)


def generate_sql_changelog_file(id, author, comment, cypher, outfile):
    changeset = ChangeSet(id, author, comment, cypher)
    temp = get_changelog_template()
    with open(outfile, 'w') as f:
        f.write(temp.render(change_sets_str=changeset.create_changelog_str()))


if __name__ == '__main__':
    cypher = 'match(n:Gene)-[r]-(:Gene) where r.score < 0.4 delete r;'
    comment = 'Remove ecocyc-plus string relationships with 0.4 threshold. After the update, create ecocyc-plus-10012021.dump file'
    outfile = os.path.join('../../../migration/liquibase/ecocyc-plus/ecocyc-plus changelog-0010.xml')
    generate_sql_changelog_file('LL-3702 cut string rels with threshold', 'robin cai',
                                comment,
                                cypher, outfile)
