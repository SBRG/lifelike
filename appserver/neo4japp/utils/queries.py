import string
from typing import List, Tuple

from neo4japp.utils.stopwords import StopWords

WILDCARD_MIN_LEN = 3


def parse_query_terms(user_query: str) -> Tuple[List[str], List[str], List[str]]:
    """Takes a user query and returns a list of individual query terms
    """
    query_string = user_query.lower()
    phrases = []
    terms = []
    wildcards = []
    query_terms = []
    start_idx = 0
    while start_idx < len(query_string):
        start_quote_idx, end_quote_idx = _find_start_end_quote(query_string, start_idx)
        if start_quote_idx == -1:
            query_terms.append(query_string[start_idx:])
            start_idx = len(query_string)  # end loop
        else:
            query_terms.append(query_string[start_idx:start_quote_idx])
            phrase = query_string[start_quote_idx + 1:end_quote_idx]
            phrases.append(phrase)
            start_idx = end_quote_idx + 1
    for term in query_terms:
        for item in term.split():
            if item not in StopWords:
                # for each term, prefix the greek delta
                if "*" in item:
                    if len(item) >= WILDCARD_MIN_LEN:
                        wildcards.append(item)
                else:
                    terms.append(item)
    return terms, wildcards, phrases


def _find_start_end_quote(query_string: str, start=0) -> Tuple[int, int]:
    """
    find valid start quote location in given string
    :param query_string: input string to analyze
    :return: index of the potential start quote
    """
    single_quote_idx = _find_first_start_quote(query_string, "'", start)
    double_quote_idx = _find_first_start_quote(query_string, '"', start)
    if single_quote_idx == -1 and double_quote_idx == -1:
        return -1, -1
    elif single_quote_idx == -1 or double_quote_idx == -1:
        if single_quote_idx >= 0:
            start_idx = single_quote_idx
            quote = "'"
        else:
            start_idx = double_quote_idx
            quote = '"'
        if (start_idx == 0 or query_string[start_idx - 1] in string.whitespace) and \
                start_idx < len(query_string) - 1:
            end_idx = query_string.find(quote, start_idx + 1)
            if query_string[end_idx - 1] == '\\':
                end_idx = query_string.find(quote, end_idx + 1)
            if end_idx != -1:
                return start_idx, end_idx
        return -1, -1
    else:
        if single_quote_idx < double_quote_idx:
            quote = "'"
            start_idx = single_quote_idx
        else:
            quote = '"'
            start_idx = double_quote_idx

        if start_idx == 0 or query_string[start_idx - 1] in string.whitespace:
            end_idx = query_string.find(quote, start_idx + 1)
            if end_idx > 0:
                return start_idx, end_idx
            else:
                return _find_start_end_quote(query_string, start_idx + 1)
    return -1, -1


def _find_first_start_quote(s: str, quote: str, start_idx=0) -> int:
    idx = s.find(quote, start_idx)
    if idx > 0 and not s[idx - 1] in string.whitespace:
        return _find_first_start_quote(s, quote, idx + 1)
    return idx
