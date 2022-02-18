import logging
import os
import sys


class CloudStorage:
    def __init__(self, provider) -> None:
        """Provider is file client."""
        self.provider = provider
        self.logger = logging.getLogger('azure.storage.fileshare')
        self.logger.setLevel(logging.INFO)
        _handler = logging.StreamHandler(stream=sys.stdout)
        self.logger.addHandler(_handler)

    def _delete_local_file(self, filepath: str) -> None:
        os.remove(filepath)

    def close(self) -> None:
        raise NotImplementedError()

    def upload(self, filename: str, filepath: str) -> None:
        raise NotImplementedError()
