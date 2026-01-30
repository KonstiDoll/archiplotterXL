"""Utility functions for infill generation."""

import time

from shapely.geometry import Polygon

from services.geometry import (
    LineSegment,
    Polyline,
    polygon_with_holes_to_shapely,
)

from .patterns import (
    ConcentricInfill,
    CrosshatchInfill,
    GridInfill,
    InfillGenerator,
    LineInfill,
    ZigZagInfill,
)


def get_infill_generator(
    pattern_type: str, polygon: Polygon, density: float, angle: float, outline_offset: float
) -> InfillGenerator:
    """
    Factory function to get the appropriate infill generator.

    Args:
        pattern_type: One of 'lines', 'grid', 'concentric', 'crosshatch'
        polygon: Shapely Polygon
        density: Line spacing in mm
        angle: Angle in degrees
        outline_offset: Inward offset from polygon edge

    Returns:
        Appropriate InfillGenerator subclass instance
    """
    generators = {
        "lines": LineInfill,
        "grid": GridInfill,
        "concentric": ConcentricInfill,
        "crosshatch": CrosshatchInfill,
        "zigzag": ZigZagInfill,
    }

    generator_class = generators.get(pattern_type.lower())
    if generator_class is None:
        # Default to lines for unknown patterns
        generator_class = LineInfill

    return generator_class(polygon, density, angle, outline_offset)


def generate_infill_for_polygons(
    polygons: list[dict], pattern_type: str, density: float, angle: float, outline_offset: float
) -> list[LineSegment]:
    """
    Generate infill for multiple polygons.

    Args:
        polygons: List of {"outer": [...], "holes": [[...]]} dicts
        pattern_type: Pattern name
        density: Line spacing
        angle: Angle in degrees
        outline_offset: Inward offset

    Returns:
        List of all line segments
    """
    all_segments: list[LineSegment] = []

    # Timing accumulators
    time_shapely_conversion = 0.0
    time_pattern_generation = 0.0
    total_points = 0

    for poly_data in polygons:
        outer = poly_data.get("outer", [])
        holes = poly_data.get("holes", [])

        if len(outer) < 3:
            continue

        try:
            # Time: Shapely polygon conversion
            t0 = time.perf_counter()
            shapely_polygon = polygon_with_holes_to_shapely(outer, holes)
            time_shapely_conversion += time.perf_counter() - t0

            total_points += len(outer) + sum(len(h) for h in holes)

            if shapely_polygon.is_empty or shapely_polygon.area < 0.01:
                continue

            # Time: Pattern generation
            t0 = time.perf_counter()
            generator = get_infill_generator(
                pattern_type, shapely_polygon, density, angle, outline_offset
            )
            segments = generator.generate()
            time_pattern_generation += time.perf_counter() - t0

            all_segments.extend(segments)

        except Exception as e:
            # Log but continue with other polygons
            print(f"Warning: Failed to generate infill for polygon: {e}")
            continue

    # Print detailed timing
    print(
        f"  [PATTERN DETAIL] shapely_conversion: {time_shapely_conversion * 1000:7.2f} ms ({total_points} points)"
    )
    print(
        f"  [PATTERN DETAIL] pattern_generation: {time_pattern_generation * 1000:7.2f} ms ({len(all_segments)} segments)"
    )

    return all_segments


def generate_infill_for_polygons_with_polylines(
    polygons: list[dict], pattern_type: str, density: float, angle: float, outline_offset: float
) -> tuple[list[LineSegment], list[Polyline]]:
    """
    Generate infill for multiple polygons, returning both line segments and polylines.

    For patterns like 'concentric', polylines are preferred (continuous paths).
    For patterns like 'lines', 'grid', 'crosshatch', only line segments are returned.

    Args:
        polygons: List of {"outer": [...], "holes": [[...]]} dicts
        pattern_type: Pattern name
        density: Line spacing
        angle: Angle in degrees
        outline_offset: Inward offset

    Returns:
        Tuple of (line_segments, polylines)
    """
    all_segments: list[LineSegment] = []
    all_polylines: list[Polyline] = []

    # Timing accumulators
    time_shapely_conversion = 0.0
    time_pattern_generation = 0.0
    total_points = 0

    # Check if pattern supports polylines
    use_polylines = pattern_type.lower() in ["concentric", "zigzag"]

    for poly_data in polygons:
        outer = poly_data.get("outer", [])
        holes = poly_data.get("holes", [])

        if len(outer) < 3:
            continue

        try:
            # Time: Shapely polygon conversion
            t0 = time.perf_counter()
            shapely_polygon = polygon_with_holes_to_shapely(outer, holes)
            time_shapely_conversion += time.perf_counter() - t0

            total_points += len(outer) + sum(len(h) for h in holes)

            if shapely_polygon.is_empty or shapely_polygon.area < 0.01:
                continue

            # Time: Pattern generation
            t0 = time.perf_counter()
            generator = get_infill_generator(
                pattern_type, shapely_polygon, density, angle, outline_offset
            )

            if use_polylines and hasattr(generator, "generate_polylines"):
                # Use polyline generation for concentric pattern
                polylines = generator.generate_polylines()
                all_polylines.extend(polylines)
            else:
                # Use line segment generation for other patterns
                segments = generator.generate()
                all_segments.extend(segments)

            time_pattern_generation += time.perf_counter() - t0

        except Exception as e:
            # Log but continue with other polygons
            print(f"Warning: Failed to generate infill for polygon: {e}")
            continue

    # Print detailed timing
    if use_polylines:
        print(
            f"  [PATTERN DETAIL] shapely_conversion: {time_shapely_conversion * 1000:7.2f} ms ({total_points} points)"
        )
        print(
            f"  [PATTERN DETAIL] pattern_generation: {time_pattern_generation * 1000:7.2f} ms ({len(all_polylines)} polylines)"
        )
    else:
        print(
            f"  [PATTERN DETAIL] shapely_conversion: {time_shapely_conversion * 1000:7.2f} ms ({total_points} points)"
        )
        print(
            f"  [PATTERN DETAIL] pattern_generation: {time_pattern_generation * 1000:7.2f} ms ({len(all_segments)} segments)"
        )

    return all_segments, all_polylines


__all__ = [
    "get_infill_generator",
    "generate_infill_for_polygons",
    "generate_infill_for_polygons_with_polylines",
]
