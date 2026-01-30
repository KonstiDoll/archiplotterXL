"""
Services for ArchiSlicer backend.

This module provides backward-compatible re-exports from the reorganized
service submodules.
"""

# Geometry utilities
# Centerline extraction
from .centerline import (
    CenterlineService,
    chaikin_smooth,
    extract_centerlines,
    get_centerline_service,
    smooth_sharp_angles,
)
from .geometry import (
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

# Infill pattern generation
from .infill import (
    ConcentricInfill,
    CrosshatchInfill,
    GridInfill,
    InfillGenerator,
    InfillService,
    LineInfill,
    ZigZagInfill,
    generate_infill_for_polygons,
    generate_infill_for_polygons_with_polylines,
    get_infill_generator,
    get_infill_service,
)

# Path optimization
from .optimization import (
    PathOptimizerService,
    calculate_distance,
    calculate_path_statistics,
    get_path_optimizer_service,
    optimize_drawing_path,
    optimize_polyline_path,
)

__all__ = [
    # Geometry
    "Point2D",
    "LineSegment",
    "Polyline",
    "points_to_shapely_polygon",
    "polygon_with_holes_to_shapely",
    "offset_polygon",
    "clip_line_to_polygon",
    "get_polygon_bounds",
    "calculate_line_length",
    # Infill
    "InfillGenerator",
    "LineInfill",
    "GridInfill",
    "ConcentricInfill",
    "CrosshatchInfill",
    "ZigZagInfill",
    "get_infill_generator",
    "generate_infill_for_polygons",
    "generate_infill_for_polygons_with_polylines",
    "InfillService",
    "get_infill_service",
    # Optimization
    "calculate_distance",
    "optimize_drawing_path",
    "optimize_polyline_path",
    "calculate_path_statistics",
    "PathOptimizerService",
    "get_path_optimizer_service",
    # Centerline
    "extract_centerlines",
    "chaikin_smooth",
    "smooth_sharp_angles",
    "CenterlineService",
    "get_centerline_service",
]
