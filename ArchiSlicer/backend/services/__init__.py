"""Services for infill generation and path optimization."""

from .geometry_utils import (
    points_to_shapely_polygon,
    polygon_with_holes_to_shapely,
    offset_polygon,
    clip_line_to_polygon,
)
from .infill_patterns import InfillGenerator, LineInfill, GridInfill
from .path_optimizer import optimize_drawing_path

__all__ = [
    "points_to_shapely_polygon",
    "polygon_with_holes_to_shapely",
    "offset_polygon",
    "clip_line_to_polygon",
    "InfillGenerator",
    "LineInfill",
    "GridInfill",
    "optimize_drawing_path",
]
