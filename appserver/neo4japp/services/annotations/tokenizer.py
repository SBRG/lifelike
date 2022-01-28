import re

from string import ascii_letters, digits, punctuation, whitespace
from typing import List, Set

from .constants import (
    ABBREVIATION_WORD_LENGTH,
    COMMON_WORDS,
    MAX_ENTITY_WORD_LENGTH,
    PDF_NEW_LINE_THRESHOLD
)
from .data_transfer_objects import PDFWord


class Tokenizer:
    def __init__(self) -> None:
        self.abbreviations: Set[str] = set()
        self.token_word_check_regex = re.compile(r'[\d{}]+$'.format(re.escape(punctuation)))

    def _is_abbrev(self, token: PDFWord) -> bool:
        """Determine if a word is an abbreviation.

        Start from closest word to abbreviation, and check the first character.
        """
        if token.keyword in self.abbreviations:
            return True

        if len(token.keyword) not in ABBREVIATION_WORD_LENGTH:
            return False

        # a token will only have previous words
        # if it is a possible abbreviation
        # the assumption here is, if an abbreviation
        # is used the *first time*, it will have previous
        # words that it is an abbreviation of
        # any subsequent uses of the abbreviation
        # will not have the word it is abbreviated from
        # as a previous word in the document
        if not token.previous_words:
            return False

        abbrev = ''
        len_of_word = len(token.keyword)
        previous_words = token.previous_words.split(' ')
        for w in reversed(previous_words):
            if '-' in w:
                split = w.split('-')
                for w2 in reversed(split):
                    if w2:
                        abbrev = w2[0].upper() + abbrev
            elif '/' in w:
                split = w.split('/')
                for w2 in reversed(split):
                    if w2:
                        abbrev = w2[0].upper() + abbrev
            else:
                abbrev = w[0].upper() + abbrev
        abbrev = abbrev[-len_of_word:]

        if abbrev == token.keyword:
            self.abbreviations.add(token.keyword)
            return True
        return False

    def _create(self, words: List[PDFWord]) -> List[PDFWord]:
        prev_token = None
        new_tokens = []

        for word in words:
            if prev_token is None:
                # copied from def normalize_str
                # to avoid function calls, ~7-10 sec faster
                normalized = word.keyword.lower()
                normalized = normalized.translate(str.maketrans('', '', punctuation))
                normalized_keyword = normalized.translate(str.maketrans('', '', whitespace))
                new_token = PDFWord(
                    keyword=word.keyword,
                    normalized_keyword=normalized_keyword,
                    page_number=word.page_number,
                    lo_location_offset=word.lo_location_offset,
                    hi_location_offset=word.hi_location_offset,
                    coordinates=word.coordinates,
                    heights=word.heights,
                    widths=word.widths,
                    previous_words=word.previous_words
                )
                new_tokens.append(new_token)
                prev_token = new_token
            else:
                words_subset = [prev_token, word]
                curr_keyword = ' '.join([word.keyword for word in words_subset])
                coordinates = []
                heights = []
                widths = []

                start_lower_x = 0.0
                start_lower_y = 0.0
                end_upper_x = 0.0
                end_upper_y = 0.0
                prev_height = 0.0
                for word in words_subset:
                    # when combining sequential words
                    # need to merge their coordinates together
                    # while also keeping in mind words on new lines
                    for j, coords in enumerate(word.coordinates):
                        lower_x, lower_y, upper_x, upper_y = coords

                        if (start_lower_x == 0.0 and
                                start_lower_y == 0.0 and
                                end_upper_x == 0.0 and
                                end_upper_y == 0.0):
                            start_lower_x = lower_x
                            start_lower_y = lower_y
                            end_upper_x = upper_x
                            end_upper_y = upper_y
                            prev_height = word.heights[j]
                        else:
                            if lower_y != start_lower_y:
                                diff = abs(lower_y - start_lower_y)

                                # if diff is greater than height ratio
                                # then part of keyword is on a new line
                                if diff > prev_height * PDF_NEW_LINE_THRESHOLD:
                                    coordinates.append(
                                        [start_lower_x, start_lower_y, end_upper_x, end_upper_y])

                                    start_lower_x = lower_x
                                    start_lower_y = lower_y
                                    end_upper_x = upper_x
                                    end_upper_y = upper_y
                                    prev_height = word.heights[j]
                                else:
                                    if upper_y > end_upper_y:
                                        end_upper_y = upper_y

                                    if upper_x > end_upper_x:
                                        end_upper_x = upper_x
                            else:
                                if upper_y > end_upper_y:
                                    end_upper_y = upper_y

                                if upper_x > end_upper_x:
                                    end_upper_x = upper_x

                    heights += word.heights
                    widths += word.widths
                coordinates.append([start_lower_x, start_lower_y, end_upper_x, end_upper_y])

                # copied from def normalize_str
                # to avoid function calls, ~7-10 sec faster
                normalized = curr_keyword.lower()
                normalized = normalized.translate(str.maketrans('', '', punctuation))
                normalized_keyword = normalized.translate(str.maketrans('', '', whitespace))
                new_token = PDFWord(
                    keyword=curr_keyword,
                    normalized_keyword=normalized_keyword,
                    # take the page of the first word
                    # if multi-word, consider it as part
                    # of page of first word
                    page_number=words_subset[0].page_number,
                    lo_location_offset=words_subset[0].lo_location_offset,
                    hi_location_offset=words_subset[-1].hi_location_offset,
                    coordinates=coordinates,
                    heights=heights,
                    widths=widths,
                    previous_words=words_subset[0].previous_words,
                )

                new_tokens.append(new_token)
                prev_token = new_token

        # remove any keywords that fit the removal
        # criteria at the end here, e.g common words, digits, ascii_letters etc
        # because a term could start with them
        # had we removed earlier, then some terms may possibly
        # have been missed
        tokens_to_use = []
        for token in new_tokens:
            if (token.keyword.lower() in COMMON_WORDS or
                self.token_word_check_regex.match(token.keyword) or
                token.keyword in ascii_letters or
                token.keyword in digits or
                len(token.normalized_keyword) <= 2 or
                self._is_abbrev(token)
            ):  # noqa
                continue
            else:
                tokens_to_use.append(token)
        return tokens_to_use

    def create(self, words: List[PDFWord]) -> List[PDFWord]:
        return [
            current_token for idx, token in enumerate(words)
                for current_token in self._create(
                    words[idx:MAX_ENTITY_WORD_LENGTH + idx])]  # noqa
