"""Geometry utilities using Shapely for polygon operations."""

from typing import List, Tuple
from shapely.geometry import Polygon, LineString, Point
from shapely.ops import unary_union
from shapely.validation import make_valid
import numpy as np


Point2D = Tuple[float, float]
LineSegment = Tuple[Point2D, Point2D]


def points_to_shapely_polygon(points: List[dict]) -> Polygon:
    """
    Convert API point list to Shapely Polygon.

    Args:
        points: List of {"x": float, "y": float} dicts

    Returns:
        Shapely Polygon object
    """
    if len(points) < 3:
        raise ValueError("Polygon must have at least 3 points")

    coords = [(p["x"], p["y"]) for p in points]

    # Ensure polygon is closed
    if coords[0] != coords[-1]:
        coords.append(coords[0])

    polygon = Polygon(coords)

    # Handle invalid polygons (self-intersecting, etc.)
    if not polygon.is_valid:
        polygon = make_valid(polygon)
        # make_valid might return a GeometryCollection, extract polygon
        if polygon.geom_type == "GeometryCollection":
            for geom in polygon.geoms:
                if geom.geom_type == "Polygon" and geom.area > 0:
                    polygon = geom
                    break
        elif polygon.geom_type == "MultiPolygon":
            # Take the largest polygon
            polygon = max(polygon.geoms, key=lambda p: p.area)

    return polygon


def polygon_with_holes_to_shapely(
    outer: List[dict],
    holes: List[List[dict]]
) -> Polygon:
    """
    Convert outer boundary and holes to Shapely Polygon.

    Args:
        outer: List of {"x": float, "y": float} for outer boundary
        holes: List of hole boundaries (each is list of points)

    Returns:
        Shapely Polygon with holes
    """
    # Convert outer boundary
    outer_coords = [(p["x"], p["y"]) for p in outer]
    if outer_coords[0] != outer_coords[-1]:
        outer_coords.append(outer_coords[0])

    # Convert holes
    hole_coords_list = []
    for hole in holes:
        if len(hole) >= 3:
            hole_coords = [(p["x"], p["y"]) for p in hole]
            if hole_coords[0] != hole_coords[-1]:
                hole_coords.append(hole_coords[0])
            hole_coords_list.append(hole_coords)

    polygon = Polygon(outer_coords, holes=hole_coords_list)

    # Handle invalid polygons
    if not polygon.is_valid:
        polygon = make_valid(polygon)
        if polygon.geom_type == "GeometryCollection":
            for geom in polygon.geoms:
                if geom.geom_type == "Polygon" and geom.area > 0:
                    polygon = geom
                    break
        elif polygon.geom_type == "MultiPolygon":
            polygon = max(polygon.geoms, key=lambda p: p.area)

    return polygon


def offset_polygon(polygon: Polygon, distance: float):
    """
    Offset polygon inward (shrink) by the given distance.

    Args:
        polygon: Shapely Polygon to offset
        distance: Distance to offset inward (positive = shrink)

    Returns:
        Offset Polygon, MultiPolygon, or empty Polygon
        NOTE: Can return MultiPolygon when polygon splits into pieces!
    """
    if distance <= 0:
        return polygon

    # Shapely buffer uses negative distance for inward offset
    result = polygon.buffer(-distance, join_style="mitre", mitre_limit=2.0)

    if result.is_empty:
        return Polygon()  # Return empty polygon

    # Return result as-is (can be Polygon or MultiPolygon)
    # Don't discard smaller pieces!
    return result


def clip_line_to_polygon(
    line_start: Point2D,
    line_end: Point2D,
    polygon: Polygon
) -> List[LineSegment]:
    """
    Clip line segment to polygon boundary.

    Args:
        line_start: Start point (x, y)
        line_end: End point (x, y)
        polygon: Shapely Polygon to clip to

    Returns:
        List of line segments that fall within the polygon
    """
    line = LineString([line_start, line_end])

    if polygon.is_empty:
        return []

    clipped = polygon.intersection(line)

    if clipped.is_empty:
        return []

    segments = []

    if clipped.geom_type == "LineString":
        coords = list(clipped.coords)
        for i in range(len(coords) - 1):
            segments.append((
                (coords[i][0], coords[i][1]),
                (coords[i + 1][0], coords[i + 1][1])
            ))
    elif clipped.geom_type == "MultiLineString":
        for line_seg in clipped.geoms:
            coords = list(line_seg.coords)
            for i in range(len(coords) - 1):
                segments.append((
                    (coords[i][0], coords[i][1]),
                    (coords[i + 1][0], coords[i + 1][1])
                ))
    elif clipped.geom_type == "Point":
        # Single point intersection - skip
        pass
    elif clipped.geom_type == "GeometryCollection":
        # Mixed geometry types
        for geom in clipped.geoms:
            if geom.geom_type == "LineString":
                coords = list(geom.coords)
                for i in range(len(coords) - 1):
                    segments.append((
                        (coords[i][0], coords[i][1]),
                        (coords[i + 1][0], coords[i + 1][1])
                    ))

    return segments


def get_polygon_bounds(polygon: Polygon) -> Tuple[float, float, float, float]:
    """
    Get bounding box of polygon.

    Returns:
        (minx, miny, maxx, maxy)
    """
    return polygon.bounds


def calculate_line_length(segments: List[LineSegment]) -> float:
    """
    Calculate total length of line segments.

    Args:
        segments: List of ((x1, y1), (x2, y2)) tuples

    Returns:
        Total length in same units as input
    """
    total = 0.0
    for (x1, y1), (x2, y2) in segments:
        total += np.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
    return total
