import re
import sys
from typing import Generator, Union

import unicodedata


def is_nice_word_boundary_char(ch):
    return not unicodedata.category(ch)[0] in ('C', 'Z')


def is_nice_char(ch):
    return not unicodedata.category(ch)[0] in ('C',)


def is_nice_filename_char(ch):
    category = unicodedata.category(ch)
    return not category[0] in ('C',) and (category[0] != 'Z' or category == 'Zs')


all_unicode_chars = ''.join(chr(c) for c in range(sys.maxunicode + 1))
unicode_whitespace = ''.join(re.findall(r'\s', all_unicode_chars))
stripped_characters = ''.join(ch for ch in all_unicode_chars if (
        unicodedata.category(ch)[0] in ('C', 'Z')
))


def extract_text(d):
    """Recursively extract all strings from python object
    :param d: Any object
    :returns Iterator over str instances
    """
    if isinstance(d, str):
        yield d
    elif isinstance(d, dict):
        for value in d.values():
            for v in extract_text(value):
                yield v
    else:
        try:
            for value in d:
                for v in extract_text(value):
                    yield v
        except TypeError:
            # not iterable
            pass
