"""Infill pattern generators using Shapely."""

import math
import time
from abc import ABC, abstractmethod

import numpy as np
from shapely.geometry import Polygon

from services.geometry import (
    LineSegment,
    Polyline,
    clip_line_to_polygon,
    offset_polygon,
)


class InfillGenerator(ABC):
    """Base class for infill pattern generation."""

    def __init__(self, polygon: Polygon, density: float, angle: float, outline_offset: float = 0.0):
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
    def generate(self) -> list[LineSegment]:
        """Generate line segments. Override in subclasses."""
        pass


class LineInfill(InfillGenerator):
    """
    Parallel lines at specified angle.

    This is the most common infill pattern - straight lines
    across the polygon at a given angle and spacing.
    """

    def generate(self) -> list[LineSegment]:
        """Generate parallel line infill."""
        if self.polygon.is_empty:
            return []

        minx, miny, maxx, maxy = self.bounds
        width = maxx - minx
        height = maxy - miny

        if width <= 0 or height <= 0:
            return []

        # Diagonal length for line extension
        diagonal = math.sqrt(width**2 + height**2)

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

        line_segments: list[LineSegment] = []

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
            print(
                f"    [LINE INFILL] {num_lines} lines, clip_time: {clip_time * 1000:.2f} ms ({clip_time * 1000 / num_lines:.3f} ms/line)"
            )

        return line_segments


class GridInfill(InfillGenerator):
    """
    Grid pattern (perpendicular lines).

    Two sets of parallel lines at 90 degrees to each other.
    """

    def generate(self) -> list[LineSegment]:
        """Generate grid infill (two perpendicular line sets)."""
        if self.polygon.is_empty:
            return []

        # Generate first set of lines at the specified angle
        line_gen1 = LineInfill(self.original_polygon, self.density, self.angle, self.outline_offset)
        lines1 = line_gen1.generate()

        # Generate second set at 90 degrees offset
        line_gen2 = LineInfill(
            self.original_polygon, self.density, self.angle + 90, self.outline_offset
        )
        lines2 = line_gen2.generate()

        return lines1 + lines2


class ConcentricInfill(InfillGenerator):
    """
    Concentric rings from polygon outline.

    Creates parallel offset rings from the polygon boundary
    moving inward.
    """

    def generate(self) -> list[LineSegment]:
        """Generate concentric ring infill as line segments (legacy compatibility)."""
        # Convert polylines to line segments for backward compatibility
        polylines = self.generate_polylines()
        line_segments: list[LineSegment] = []

        for polyline in polylines:
            for i in range(len(polyline) - 1):
                line_segments.append((polyline[i], polyline[i + 1]))

        return line_segments

    def generate_polylines(self) -> list[Polyline]:
        """Generate concentric ring infill as polylines (continuous paths)."""
        if self.polygon.is_empty:
            return []

        polylines: list[Polyline] = []

        # Track all active polygon parts (can split during offsetting)
        active_polygons = [(self.polygon, 0.0)]  # (polygon, cumulative_offset)

        max_iterations = 1000  # Safety limit
        iteration = 0

        while active_polygons and iteration < max_iterations:
            iteration += 1
            next_polygons = []

            for current_polygon, current_offset in active_polygons:
                if current_polygon.is_empty:
                    continue

                # Extract boundary as polylines (each ring is one continuous path)
                if current_polygon.geom_type == "Polygon":
                    # Outer boundary
                    coords = list(current_polygon.exterior.coords)
                    if len(coords) >= 2:
                        polyline: Polyline = [(c[0], c[1]) for c in coords]
                        polylines.append(polyline)

                    # Inner boundaries (holes become filled)
                    for interior in current_polygon.interiors:
                        coords = list(interior.coords)
                        if len(coords) >= 2:
                            polyline: Polyline = [(c[0], c[1]) for c in coords]
                            polylines.append(polyline)

                elif current_polygon.geom_type == "MultiPolygon":
                    for poly in current_polygon.geoms:
                        coords = list(poly.exterior.coords)
                        if len(coords) >= 2:
                            polyline: Polyline = [(c[0], c[1]) for c in coords]
                            polylines.append(polyline)

                # Offset current polygon inward by one density step
                next_polygon = offset_polygon(current_polygon, self.density)

                if not next_polygon.is_empty:
                    # Handle both Polygon and MultiPolygon results
                    if next_polygon.geom_type == "MultiPolygon":
                        # Add all pieces separately (polygon may have split)
                        for piece in next_polygon.geoms:
                            if not piece.is_empty and piece.area > 0.01:  # Filter tiny pieces
                                next_polygons.append((piece, current_offset + self.density))
                    else:
                        next_polygons.append((next_polygon, current_offset + self.density))

            active_polygons = next_polygons

        return polylines


class CrosshatchInfill(InfillGenerator):
    """
    Crosshatch pattern (diagonal lines).

    Similar to grid but at +45 and -45 degree angles.
    """

    def generate(self) -> list[LineSegment]:
        """Generate crosshatch infill."""
        if self.polygon.is_empty:
            return []

        # Generate lines at +45 and -45 from base angle
        line_gen1 = LineInfill(
            self.original_polygon, self.density, self.angle + 45, self.outline_offset
        )
        lines1 = line_gen1.generate()

        line_gen2 = LineInfill(
            self.original_polygon, self.density, self.angle - 45, self.outline_offset
        )
        lines2 = line_gen2.generate()

        return lines1 + lines2


class ZigZagInfill(InfillGenerator):
    """
    Zigzag pattern - continuous lines with minimal pen lifts.
    Similar to line infill but connects scan lines in alternating directions.
    """

    def generate(self) -> list[LineSegment]:
        """Convert polylines to segments for backward compatibility."""
        polylines = self.generate_polylines()
        segments: list[LineSegment] = []
        for polyline in polylines:
            for i in range(len(polyline) - 1):
                segments.append((polyline[i], polyline[i + 1]))
        return segments

    def generate_polylines(self) -> list[Polyline]:
        """Generate zigzag as continuous polylines."""
        if self.polygon.is_empty:
            return []

        minx, miny, maxx, maxy = self.bounds
        width, height = maxx - minx, maxy - miny
        if width <= 0 or height <= 0:
            return []

        diagonal = math.sqrt(width**2 + height**2)
        angle_rad = math.radians(self.angle)
        direction = np.array([math.cos(angle_rad), math.sin(angle_rad)])
        normal = np.array([-direction[1], direction[0]])
        center = np.array([(minx + maxx) / 2, (miny + maxy) / 2])

        # Project polygon to find range
        all_coords = list(self.polygon.exterior.coords)
        for interior in self.polygon.interiors:
            all_coords.extend(list(interior.coords))
        coords = np.array(all_coords)
        projections = np.dot(coords - center, normal)
        proj_min, proj_max = projections.min(), projections.max()

        num_lines = int(math.ceil((proj_max - proj_min) / self.density))
        if num_lines <= 0 or num_lines > 10000:
            return []

        # Generate scan lines and clip to polygon
        scan_lines: list[list[LineSegment]] = []
        for i in range(num_lines + 1):
            t = i / num_lines if num_lines > 0 else 0
            offset = proj_min + t * (proj_max - proj_min)
            line_center = center + normal * offset
            line_start = tuple(line_center - direction * diagonal)
            line_end = tuple(line_center + direction * diagonal)
            segments = clip_line_to_polygon(line_start, line_end, self.polygon)
            if segments:
                scan_lines.append(segments)

        if not scan_lines:
            return []

        # Connect in zigzag order
        polylines: list[Polyline] = []
        current: Polyline = []
        forward = True
        threshold = self.density * 2.0

        for segments in scan_lines:
            if not forward:
                segments = [(s[1], s[0]) for s in reversed(segments)]

            for start, end in segments:
                if not current:
                    current = [start, end]
                else:
                    dist = math.sqrt(
                        (start[0] - current[-1][0]) ** 2 + (start[1] - current[-1][1]) ** 2
                    )
                    if dist <= threshold:
                        current.append(end)
                    else:
                        if len(current) >= 2:
                            polylines.append(current)
                        current = [start, end]
            forward = not forward

        if len(current) >= 2:
            polylines.append(current)

        return polylines


__all__ = [
    "InfillGenerator",
    "LineInfill",
    "GridInfill",
    "ConcentricInfill",
    "CrosshatchInfill",
    "ZigZagInfill",
]
