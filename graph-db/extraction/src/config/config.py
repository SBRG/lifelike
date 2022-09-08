import yaml
import os


class Config:
    def __init__(self):
        cwd = os.path.abspath(os.path.dirname(__file__))
        self.config_dir = os.path.join(cwd, '')
        self.content = self._read_config()
        self.data_dir = self._get_data_dir()

    def _read_config(self):
        config_file = os.path.join(self.config_dir, 'config.yml')
        content = self.read_yaml(config_file)
        return content

    @classmethod
    def read_yaml(cls, yaml_file):
        content = None
        with open(yaml_file, 'r') as stream:
            try:
                content = yaml.safe_load(stream)
            except yaml.YAMLError as err:
                raise yaml.YAMLError("The yaml file {} could not be parsed. {}".format(yaml_file, err))
        return content

    def _get_data_dir(self):
        datadir = self.content['directories']['dataDirectory']
        if datadir.startswith('/'):
            return datadir
        cwd = os.path.abspath(os.path.dirname(__file__))
        datadir = os.path.abspath(os.path.join(cwd, datadir))
        return datadir

    def get_biocyc_files_map(self):
        """
        @return dict {biocyc_db_name: file_name}
        """
        self.content["biocycFiles"]

    def get_biocyc_tar_file(self, biocyc_dbname):
        """
        Get the downloaded biocyc file
        @param biocyc_dbname: individual biocyc database name, e.g. EcoCyc, HumanCyc, YeastCyc
        @return the downloaded tar file name
        """
        biocyc_files = self.content["biocycFiles"]
        if biocyc_dbname in biocyc_files:
            return biocyc_files[biocyc_dbname]
        return ""

    def get_changelog_template_dir(self):
        return os.path.join(self.config_dir, 'templates')

    def get_cypher_dir(self):
        return os.path.join(self.config_dir, 'cypher')

    def get_biocyc_cyphers(self):
        return self.read_yaml(os.path.join(self.get_cypher_dir(), 'biocyc-cypher.yml'))

    def get_string_cyphers(self):
        return self.read_yaml(os.path.join(self.get_cypher_dir(), 'string-cypher.yml'))










