# Extraction

This README describes how to set up a develoment environment to run scripts to parse data from various sources; e.g KEGG, BioCyc, etc... and produce `.tsv` files.

## Table of Contents
* [Initial setup](#initial-setup)
* [Parsing data](#parsing-data)
* [Liquibase changelogs](#liquibase-changelogs)

## Initial setup

Development and deployment depends on the `Pipenv` tool to create a virtual environment with all dependencies found in the `Pipfile`. Optionally, you can use `virtualenv` separately to create a virtual environment (still need `Pipenv` to install the dependencies).

INSTALL: https://pipenv.pypa.io/en/latest/#install-pipenv-today

### Create virtual environment
Create a virtual environment for the project and install dependencies from Pipfile (incl. dev dependencies):

```bash
pipenv install --dev
```

### Activate virtual environment
```bash
pipenv shell
```

Deactivate the shell using `exit`.

## Parsing Data

Data is parsed by executing the `app.py` script with the data domain as argument. Some domains, like BioCyc, will have additional arguments to specify which specific data sources to load.

The `.tsv` data files are zipped and uploaded to Azure (or other cloud storage of choice).

### Arguments
Required:

--prefix: The JIRA card numeric value. This is to link the data files to a JIRA card for reference tracking.

domain: name of data domain, like "biocyc".

Optional:

--log-level: Override the default (INFO) log level.

--log-file: Name of log file. If specified, logs are written to this files.

### Examples
Load Chebi with default (INFO) log level:
```bash
# assumes current directory is graph-db/extraction/src
python3 src/app.py --prefix LL-1234 chebi
```

Load Chebi, overriding log level and specifying log file:
```bash
# assumes current directory is graph-db/extraction/src
python3 src/app.py --prefix LL-1234 --log-file kg_load.log --log-level DEBUG chebi
```

Load all BioCyc sources as specified in src/biocyc/data_sources.json:
```bash
# assumes current directory is graph-db/extraction/src
python3 src/app.py --prefix LL-1234 biocyc
```

Load specific BioCyc data sources:
```bash
# assumes current directory is graph-db/extraction/src
python3 src/app.py --prefix LL-1234 biocyc --data-sources EcoCyc YeastCyc MetaCyc
```

## Liquibase changelogs

The `.tsv` data files are consumed by liquibase. In order for liquibase to work, it needs changelog `.xml` files, which are generated by running the `<domain>_liquibase.py` scripts. Each domain will have its own liquibase python script to generate.

```bash
# assumes current directory is graph-db/extraction/src
python3 kegg/kegg_liquibase.py
```

Running the script will create a changelog file in the same folder, edit that `.xml` file accordingly after, then it must be moved to `graph-db/liquibase/<folder-name>/changelogs`.

**IMPORTANT**: Rename the file to **MATCH** the naming convention, otherwise **RISK CORRUPTING THE GRAPH**. Because liquibase runs the changelogs **alphabetically**.
