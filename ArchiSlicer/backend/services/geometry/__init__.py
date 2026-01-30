"""Geometry utilities using Shapely for polygon operations."""

from .utils import (
    LineSegment,
    Point2D,
    Polyline,
    calculate_line_length,
    clip_line_to_polygon,
    get_polygon_bounds,
    offset_polygon,
    points_to_shapely_polygon,
    polygon_with_holes_to_shapely,
)

__all__ = [
    "Point2D",
    "LineSegment",
    "Polyline",
    "points_to_shapely_polygon",
    "polygon_with_holes_to_shapely",
    "offset_polygon",
    "clip_line_to_polygon",
    "get_polygon_bounds",
    "calculate_line_length",
]
