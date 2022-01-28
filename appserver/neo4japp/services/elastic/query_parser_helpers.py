import json
import re
import string

from neo4japp.database import get_file_type_service


class BoolOperand:
    def __init__(self, t, text_fields, text_field_boosts):
        self.text_fields = text_fields
        self.text_field_boosts = text_field_boosts
        self.term = t[0]

    def to_dict(self):
        wildcard_regex = r'^\S*(\?|\*)\S*$'
        file_type_regex = r'^\btype:\S*$'
        term_is_phrase = self.term[0] == '"' and self.term[-1] == '"' and len(self.term) >= 3
        normalized_term = self.term[1:-1] if term_is_phrase else self.term

        # Check if the operand is a wildcard, and use the corresponding query...
        if re.match(wildcard_regex, normalized_term) and not term_is_phrase:
            return {
                'bool': {
                    'should': [
                        {
                            'wildcard': {
                                field: {
                                    'value': normalized_term,
                                    'boost': self.text_field_boosts[field],
                                    'case_insensitive': True
                                }
                            }
                        }
                        for field in self.text_fields
                    ]
                }
            }
        # ...otherwise, check if it is a filter, and use the corresponding query...
        elif re.match(file_type_regex, normalized_term) and not term_is_phrase:
            file_type_to_match = normalized_term.split(':')[1]
            file_type_service = get_file_type_service()
            shorthand_to_mime_type_map = file_type_service.get_shorthand_to_mime_type_map()
            # TODO: Probably want to log if the given type is unknown, and report to the user that
            # they may have entered an unsupported type.
            return {
                'term': {
                    'mime_type': shorthand_to_mime_type_map.get(
                        file_type_to_match,
                        file_type_to_match
                    )
                }
            }
        # ...and finally, use a multi match query as the default.
        else:
            multi_match_query = {
                'multi_match': {
                    'query': normalized_term,  # type:ignore
                    'type': 'phrase',  # type:ignore
                    'fields': [
                        f'{field}^{self.text_field_boosts[field]}'
                        for field in self.text_fields
                    ]
                }
            }

            # If the term is not a phrase, and it contains punctuation, then add exact term matches
            # for each search field
            term_has_punctuation = any([c in string.punctuation for c in normalized_term])
            if ' ' not in normalized_term and term_has_punctuation:
                term_queries = [
                    {
                        'term': {
                            field: {
                                'value': normalized_term,
                                'boost': self.text_field_boosts[field]
                            }
                        }
                    } for field in self.text_fields

                ]
                return {
                    'bool': {
                        'should': [multi_match_query] + term_queries
                    }
                }
            else:
                return multi_match_query

    def __str__(self):
        return json.dumps(self.to_dict(), indent=4)

    __repr__ = __str__


class BoolBinOp:
    occurrence_type = ''

    def __init__(self, t):
        self.args = t[0][0::2]

    def to_dict(self):
        return {
            'bool': {
                self.occurrence_type: [arg.to_dict() for arg in self.args]
            }
        }

    def __str__(self):
        return json.dumps(self.to_dict(), indent=4)

    __repr__ = __str__


class BoolMust(BoolBinOp):
    occurrence_type = 'must'


class BoolShould(BoolBinOp):
    occurrence_type = 'should'


class BoolMustNot(BoolBinOp):
    occurrence_type = 'must_not'

    def __init__(self, t):
        self.arg = t[0][1]

    def to_dict(self):
        return {
            'bool': {
                'must_not': [self.arg.to_dict()]
            }
        }
