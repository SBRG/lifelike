import importlib.resources as resources
import json

import fastjsonschema

from .. import formats

# noinspection PyTypeChecker
with resources.open_text(formats, 'map_v2.json') as f:
    # Use this method to validate the content of a map
    validate_map = fastjsonschema.compile(json.load(f))
    # used during migration to fix outdated json
    current_version = '2'
