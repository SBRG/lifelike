from typing import List, Tuple

from intervaltree import Interval, IntervalTree

from neo4japp.services.annotations.data_transfer_objects import Annotation


class AnnotationInterval(Interval):
    def __init__(self, begin, end, data=None):
        super().__new__(Interval, begin=begin, end=end, data=data)


class AnnotationIntervalTree(IntervalTree):
    """Need to inherit like this because the IntervalTree returns
    self.__init__ for each function. But it's not able to construct
    a new tree correctly with our annotations data.

    Also, in some cases we just want a new list of annotations.
    """
    def __init__(self, intervals=None):
        super().__init__(intervals=intervals)

    def merge_equals(
        self,
        data_reducer=None,
        data_initializer=None,
    ) -> List[Tuple[int, int]]:
        """Override to change return type and how the merged is added.
        See self.__init__ comment.

        Merge all annotations with equal intervals based on
        `data_reducer` function.
        """
        if not self:
            return []  # noqa

        sorted_intervals = sorted(self.all_intervals)  # get sorted intervals
        merged = []
        # use mutable object to allow new_series() to modify it
        current_reduced = [None]
        higher = None  # iterating variable, which new_series() needs access to

        def new_series():
            if data_initializer is None:
                current_reduced[0] = higher.data
                merged.append(higher)
                return
            else:  # data_initializer is not None
                current_reduced[0] = copy(data_initializer)
                current_reduced[0] = data_reducer(current_reduced[0], higher.data)
                merged.append(AnnotationInterval(higher.begin, higher.end, current_reduced[0]))

        for higher in sorted_intervals:
            if merged:  # series already begun
                lower = merged[-1]
                if higher.range_matches(lower):  # should merge
                    upper_bound = max(lower.end, higher.end)
                    if data_reducer is not None:
                        current_reduced[0] = data_reducer(current_reduced[0], higher.data)
                    else:  # annihilate the data, since we don't know how to merge it
                        current_reduced[0] = None
                    merged[-1] = AnnotationInterval(lower.begin, upper_bound, current_reduced[0])
                else:
                    new_series()
            else:  # not merged; is first of Intervals to merge
                new_series()
        return [(interval.begin, interval.end) for interval in merged]

    def merge_overlaps(
        self,
        data_reducer=None,
        data_initializer=None,
        strict=False,
    ) -> List[Tuple[int, int]]:
        """Override to change return type and how the merged is added.
        See self.__init__ comment.

        Merge all annotations with overlapping intervals based on
        `data_reducer` function.
        """
        if not self:
            return []  # noqa

        sorted_intervals = sorted(self.all_intervals)  # get sorted intervals
        merged = []
        # use mutable object to allow new_series() to modify it
        current_reduced = [None]
        higher = None  # iterating variable, which new_series() needs access to

        def new_series():
            if data_initializer is None:
                current_reduced[0] = higher.data
                merged.append(higher)
                return
            else:  # data_initializer is not None
                current_reduced[0] = copy(data_initializer)
                current_reduced[0] = data_reducer(current_reduced[0], higher.data)
                merged.append(AnnotationInterval(higher.begin, higher.end, current_reduced[0]))

        for higher in sorted_intervals:
            if merged:  # series already begun
                lower = merged[-1]
                if (higher.begin < lower.end or
                    not strict and higher.begin == lower.end):  # noqa # should merge
                    upper_bound = max(lower.end, higher.end)
                    if data_reducer is not None:
                        current_reduced[0] = data_reducer(current_reduced[0], higher.data)
                    else:  # annihilate the data, since we don't know how to merge it
                        current_reduced[0] = None
                    merged[-1] = AnnotationInterval(lower.begin, upper_bound, current_reduced[0])
                else:
                    new_series()
            else:  # not merged; is first of Intervals to merge
                new_series()
        return [(interval.begin, interval.end) for interval in merged]
