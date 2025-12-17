"""Infill pattern generators using Shapely."""

import time
from typing import List, Tuple
from abc import ABC, abstractmethod
import math
import numpy as np
from shapely.geometry import Polygon, LineString

from .geometry_utils import (
    polygon_with_holes_to_shapely,
    offset_polygon,
    clip_line_to_polygon,
    Point2D,
    LineSegment,
)


class InfillGenerator(ABC):
    """Base class for infill pattern generation."""

    def __init__(
        self,
        polygon: Polygon,
        density: float,
        angle: float,
        outline_offset: float = 0.0
    ):
        """
        Initialize infill generator.

        Args:
            polygon: Shapely Polygon (may include holes)
            density: Spacing between lines in mm
            angle: Angle in degrees (0-180)
            outline_offset: Distance to shrink polygon from edges
        """
        self.original_polygon = polygon
        self.density = max(0.1, density)  # Minimum density to prevent infinite loops
        self.angle = angle
        self.outline_offset = outline_offset

        # Apply outline offset
        if outline_offset > 0:
            self.polygon = offset_polygon(polygon, outline_offset)
        else:
            self.polygon = polygon

        if not self.polygon.is_empty:
            self.bounds = self.polygon.bounds  # (minx, miny, maxx, maxy)
        else:
            self.bounds = (0, 0, 0, 0)

    @abstractmethod
    def generate(self) -> List[LineSegment]:
        """Generate line segments. Override in subclasses."""
        pass


class LineInfill(InfillGenerator):
    """
    Parallel lines at specified angle.

    This is the most common infill pattern - straight lines
    across the polygon at a given angle and spacing.
    """

    def generate(self) -> List[LineSegment]:
        """Generate parallel line infill."""
        if self.polygon.is_empty:
            return []

        minx, miny, maxx, maxy = self.bounds
        width = maxx - minx
        height = maxy - miny

        if width <= 0 or height <= 0:
            return []

        # Diagonal length for line extension
        diagonal = math.sqrt(width ** 2 + height ** 2)

        # Convert angle to radians
        angle_rad = math.radians(self.angle)

        # Direction vector (along the line)
        direction = np.array([math.cos(angle_rad), math.sin(angle_rad)])

        # Normal vector (perpendicular to line direction)
        normal = np.array([-direction[1], direction[0]])

        # Center of the bounding box
        center = np.array([(minx + maxx) / 2, (miny + maxy) / 2])

        # Project polygon points onto normal to find coverage range
        # We need to get points from both outer boundary and holes
        all_coords = list(self.polygon.exterior.coords)
        for interior in self.polygon.interiors:
            all_coords.extend(list(interior.coords))

        coords = np.array(all_coords)
        relative_coords = coords - center
        projections = np.dot(relative_coords, normal)
        proj_min = projections.min()
        proj_max = projections.max()

        # Calculate number of lines
        proj_length = proj_max - proj_min
        num_lines = int(math.ceil(proj_length / self.density))

        # Safety check
        if num_lines <= 0 or num_lines > 10000:
            return []

        line_segments: List[LineSegment] = []

        # Timing for clipping
        clip_time = 0.0

        # Generate lines
        for i in range(num_lines + 1):
            # Calculate offset from center
            t = i / num_lines if num_lines > 0 else 0
            offset = proj_min + t * proj_length

            # Calculate center point of this line
            line_center = center + normal * offset

            # Create line extending across the entire polygon
            line_start = tuple(line_center - direction * diagonal)
            line_end = tuple(line_center + direction * diagonal)

            # Clip line to polygon (handles holes automatically)
            t0 = time.perf_counter()
            segments = clip_line_to_polygon(line_start, line_end, self.polygon)
            clip_time += time.perf_counter() - t0
            line_segments.extend(segments)

        if num_lines > 0:
            print(f"    [LINE INFILL] {num_lines} lines, clip_time: {clip_time*1000:.2f} ms ({clip_time*1000/num_lines:.3f} ms/line)")

        return line_segments


class GridInfill(InfillGenerator):
    """
    Grid pattern (perpendicular lines).

    Two sets of parallel lines at 90 degrees to each other.
    """

    def generate(self) -> List[LineSegment]:
        """Generate grid infill (two perpendicular line sets)."""
        if self.polygon.is_empty:
            return []

        # Generate first set of lines at the specified angle
        line_gen1 = LineInfill(
            self.original_polygon,
            self.density,
            self.angle,
            self.outline_offset
        )
        lines1 = line_gen1.generate()

        # Generate second set at 90 degrees offset
        line_gen2 = LineInfill(
            self.original_polygon,
            self.density,
            self.angle + 90,
            self.outline_offset
        )
        lines2 = line_gen2.generate()

        return lines1 + lines2


class ConcentricInfill(InfillGenerator):
    """
    Concentric rings from polygon outline.

    Creates parallel offset rings from the polygon boundary
    moving inward.
    """

    def generate(self) -> List[LineSegment]:
        """Generate concentric ring infill."""
        if self.polygon.is_empty:
            return []

        line_segments: List[LineSegment] = []
        current_polygon = self.polygon
        offset_distance = 0.0

        max_iterations = 1000  # Safety limit
        iteration = 0

        while not current_polygon.is_empty and iteration < max_iterations:
            iteration += 1

            # Extract boundary as line segments
            if current_polygon.geom_type == "Polygon":
                # Outer boundary
                coords = list(current_polygon.exterior.coords)
                for i in range(len(coords) - 1):
                    line_segments.append((
                        (coords[i][0], coords[i][1]),
                        (coords[i + 1][0], coords[i + 1][1])
                    ))

                # Inner boundaries (holes become filled)
                for interior in current_polygon.interiors:
                    coords = list(interior.coords)
                    for i in range(len(coords) - 1):
                        line_segments.append((
                            (coords[i][0], coords[i][1]),
                            (coords[i + 1][0], coords[i + 1][1])
                        ))

            elif current_polygon.geom_type == "MultiPolygon":
                for poly in current_polygon.geoms:
                    coords = list(poly.exterior.coords)
                    for i in range(len(coords) - 1):
                        line_segments.append((
                            (coords[i][0], coords[i][1]),
                            (coords[i + 1][0], coords[i + 1][1])
                        ))

            # Offset inward for next ring
            offset_distance += self.density
            current_polygon = offset_polygon(self.polygon, offset_distance)

            if current_polygon.is_empty:
                break

        return line_segments


class CrosshatchInfill(InfillGenerator):
    """
    Crosshatch pattern (diagonal lines).

    Similar to grid but at +45 and -45 degree angles.
    """

    def generate(self) -> List[LineSegment]:
        """Generate crosshatch infill."""
        if self.polygon.is_empty:
            return []

        # Generate lines at +45 and -45 from base angle
        line_gen1 = LineInfill(
            self.original_polygon,
            self.density,
            self.angle + 45,
            self.outline_offset
        )
        lines1 = line_gen1.generate()

        line_gen2 = LineInfill(
            self.original_polygon,
            self.density,
            self.angle - 45,
            self.outline_offset
        )
        lines2 = line_gen2.generate()

        return lines1 + lines2


def get_infill_generator(
    pattern_type: str,
    polygon: Polygon,
    density: float,
    angle: float,
    outline_offset: float
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
    }

    generator_class = generators.get(pattern_type.lower())
    if generator_class is None:
        # Default to lines for unknown patterns
        generator_class = LineInfill

    return generator_class(polygon, density, angle, outline_offset)


def generate_infill_for_polygons(
    polygons: List[dict],
    pattern_type: str,
    density: float,
    angle: float,
    outline_offset: float
) -> List[LineSegment]:
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
    all_segments: List[LineSegment] = []

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
                pattern_type,
                shapely_polygon,
                density,
                angle,
                outline_offset
            )
            segments = generator.generate()
            time_pattern_generation += time.perf_counter() - t0

            all_segments.extend(segments)

        except Exception as e:
            # Log but continue with other polygons
            print(f"Warning: Failed to generate infill for polygon: {e}")
            continue

    # Print detailed timing
    print(f"  [PATTERN DETAIL] shapely_conversion: {time_shapely_conversion*1000:7.2f} ms ({total_points} points)")
    print(f"  [PATTERN DETAIL] pattern_generation: {time_pattern_generation*1000:7.2f} ms ({len(all_segments)} segments)")

    return all_segments
