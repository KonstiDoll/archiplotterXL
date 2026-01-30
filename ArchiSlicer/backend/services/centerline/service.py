"""Centerline service wrapper for dependency injection."""

from typing import Any

from .extractor import extract_centerlines


class CenterlineService:
    """
    Service wrapper for centerline extraction.

    Provides a clean interface for extracting centerlines from polygons,
    suitable for dependency injection in FastAPI endpoints.
    """

    def extract(
        self,
        polygons: list[dict[str, Any]],
        resolution: float = 0.02,
        min_length: float = 1.0,
        simplify_tolerance: float = 0.02,
        merge_tolerance: float = 0.2,
        loop_threshold: float = 5.0,
        chaikin_iterations: int = 2,
        min_angle: float = 120.0,
        max_extend: float = 3.0,
        method: str = "skeleton",
        spoke_filter: float = 0,
    ) -> tuple[list[list[list[tuple[float, float]]]], dict[str, Any]]:
        """
        Extract centerlines from polygons.

        Args:
            polygons: List of polygon dicts with 'outer' and optional 'holes'
            resolution: mm per pixel for bitmap rendering
            min_length: Minimum centerline length in mm
            simplify_tolerance: Douglas-Peucker simplification tolerance
            merge_tolerance: Tolerance for merging nearby endpoints
            loop_threshold: Maximum gap distance to close as loop
            chaikin_iterations: Number of smoothing passes
            min_angle: Angles below this are smoothed (degrees)
            max_extend: Maximum endpoint extension distance
            method: Extraction method ('skeleton', 'voronoi', 'offset')
            spoke_filter: Filter corner spokes shorter than this (mm)

        Returns:
            Tuple of (centerlines, statistics)
        """
        return extract_centerlines(
            polygons=polygons,
            resolution=resolution,
            min_length=min_length,
            simplify_tolerance=simplify_tolerance,
            merge_tolerance=merge_tolerance,
            loop_threshold=loop_threshold,
            chaikin_iterations=chaikin_iterations,
            min_angle=min_angle,
            max_extend=max_extend,
            method=method,
            spoke_filter=spoke_filter,
        )


def get_centerline_service() -> CenterlineService:
    """Dependency provider for CenterlineService."""
    return CenterlineService()


__all__ = ["CenterlineService", "get_centerline_service"]
