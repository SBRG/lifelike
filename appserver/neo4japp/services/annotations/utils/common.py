from typing import List


def has_center_point(coords: List[float], new_coords: List[float]) -> bool:
    """Checks if the center point of one set of coordinates
    are in another.
    """
    x1, y1, x2, y2 = coords
    new_x1, new_y1, new_x2, new_y2 = new_coords

    center_x = (new_x1 + new_x2)/2
    center_y = (new_y1 + new_y2)/2

    return x1 <= center_x <= x2 and y1 <= center_y <= y2
