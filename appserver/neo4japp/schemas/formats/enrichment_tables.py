import importlib.resources as resources
import json

import fastjsonschema

from .. import formats

# noinspection PyTypeChecker
with resources.open_text(formats, 'enrichment_tables_v5.json') as f:
    # Use this method to validate the content of an enrichment table
    validate_enrichment_table = fastjsonschema.compile(json.load(f))
