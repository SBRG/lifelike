from collections import namedtuple


class ExportFormatError(Exception):
    pass


FileExport = namedtuple('FileExport', ['content', 'mime_type', 'filename'])
