"""Infill service wrapper for dependency injection."""

from services.geometry import LineSegment, Polyline

from .utils import (
    generate_infill_for_polygons,
    generate_infill_for_polygons_with_polylines,
)


class InfillService:
    """
    Service wrapper for infill generation.

    Provides a clean interface for infill pattern generation,
    suitable for dependency injection in FastAPI endpoints.
    """

    def generate(
        self,
        polygons: list[dict],
        pattern_type: str,
        density: float,
        angle: float,
        outline_offset: float,
    ) -> list[LineSegment]:
        """
        Generate infill line segments for polygons.

        Args:
            polygons: List of polygon dicts with 'outer' and 'holes'
            pattern_type: Pattern name ('lines', 'grid', etc.)
            density: Line spacing in mm
            angle: Angle in degrees
            outline_offset: Inward offset from polygon edge

        Returns:
            List of line segments
        """
        return generate_infill_for_polygons(polygons, pattern_type, density, angle, outline_offset)

    def generate_with_polylines(
        self,
        polygons: list[dict],
        pattern_type: str,
        density: float,
        angle: float,
        outline_offset: float,
    ) -> tuple[list[LineSegment], list[Polyline]]:
        """
        Generate infill with both line segments and polylines.

        For patterns like 'concentric' and 'zigzag', polylines are preferred
        as they represent continuous paths.

        Args:
            polygons: List of polygon dicts with 'outer' and 'holes'
            pattern_type: Pattern name
            density: Line spacing in mm
            angle: Angle in degrees
            outline_offset: Inward offset from polygon edge

        Returns:
            Tuple of (line_segments, polylines)
        """
        return generate_infill_for_polygons_with_polylines(
            polygons, pattern_type, density, angle, outline_offset
        )


def get_infill_service() -> InfillService:
    """Dependency provider for InfillService."""
    return InfillService()


__all__ = ["InfillService", "get_infill_service"]
