"""Path optimizer service wrapper for dependency injection."""

from services.geometry import LineSegment, Point2D, Polyline

from .path_optimizer import (
    calculate_path_statistics,
    optimize_drawing_path,
    optimize_polyline_path,
)


class PathOptimizerService:
    """
    Service wrapper for path optimization.

    Provides a clean interface for TSP-based path optimization,
    suitable for dependency injection in FastAPI endpoints.
    """

    def optimize_segments(
        self,
        segments: list[LineSegment],
        start_point: Point2D | None = None,
        time_limit_seconds: int = 300,
    ) -> tuple[list[LineSegment], dict]:
        """
        Optimize drawing order of line segments.

        Uses TSP solver to minimize pen lifts and travel distance.

        Args:
            segments: List of line segments to optimize
            start_point: Optional starting position
            time_limit_seconds: Maximum solving time

        Returns:
            Tuple of (optimized_segments, statistics)
        """
        return optimize_drawing_path(segments, start_point, time_limit_seconds)

    def optimize_polylines(
        self,
        polylines: list[Polyline],
        start_point: Point2D | None = None,
        time_limit_seconds: int = 300,
    ) -> tuple[list[Polyline], dict]:
        """
        Optimize drawing order of polylines.

        Args:
            polylines: List of polylines to optimize
            start_point: Optional starting position
            time_limit_seconds: Maximum solving time

        Returns:
            Tuple of (optimized_polylines, statistics)
        """
        return optimize_polyline_path(polylines, start_point, time_limit_seconds)

    def calculate_statistics(
        self,
        segments: list[LineSegment],
        start_point: Point2D | None = None,
    ) -> dict:
        """
        Calculate path statistics without optimizing.

        Useful for comparing before/after optimization.

        Args:
            segments: List of line segments
            start_point: Optional starting position

        Returns:
            Statistics dictionary
        """
        return calculate_path_statistics(segments, start_point)


def get_path_optimizer_service() -> PathOptimizerService:
    """Dependency provider for PathOptimizerService."""
    return PathOptimizerService()


__all__ = ["PathOptimizerService", "get_path_optimizer_service"]
