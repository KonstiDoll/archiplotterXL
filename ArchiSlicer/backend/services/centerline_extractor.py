"""
Centerline extraction service.

Extracts centerlines (medial axes) from closed polygons using either:
- Skeleton method: OpenCV's Zhang-Suen thinning algorithm
- Offset method: Iterative polygon offsetting (better for fonts)

This is useful for text and narrow shapes where drawing the centerline
is preferable to tracing the outline twice.
"""

import time
from typing import List, Tuple, Dict, Any, Set, Literal
import numpy as np
import cv2
from shapely.geometry import Polygon, LineString, MultiLineString, Point
from shapely.ops import linemerge

# Optional: centerline library for Voronoi-based extraction
try:
    from centerline.geometry import Centerline as VoronoiCenterline
    CENTERLINE_AVAILABLE = True
except ImportError:
    CENTERLINE_AVAILABLE = False
    print("[CENTERLINE] Warning: 'centerline' package not installed. Voronoi method unavailable.")


def extract_centerlines(
    polygons: List[Dict[str, Any]],
    resolution: float = 0.02,  # 50 pixels per mm for high quality
    min_length: float = 1.0,
    simplify_tolerance: float = 0.02,  # Very small - preserve curves!
    merge_tolerance: float = 0.2,  # Tolerance for merging nearby endpoints
    loop_threshold: float = 5.0,  # Max gap to close as loop
    chaikin_iterations: int = 2,  # Smoothing passes
    min_angle: float = 120.0,  # Angles below this are smoothed
    max_extend: float = 3.0,  # Max endpoint extension distance
    method: str = "skeleton",  # "skeleton", "voronoi" or "offset"
    spoke_filter: float = 0,  # Filter corner spokes shorter than this (mm), 0 = disabled
) -> Tuple[List[List[List[Tuple[float, float]]]], Dict[str, Any]]:
    """
    Extract centerlines from polygons.

    Args:
        polygons: List of polygons with 'outer' boundary and optional 'holes'.
                  Each polygon: {'outer': [{'x': float, 'y': float}, ...], 'holes': [[...], ...]}
        resolution: mm per pixel for bitmap rendering (lower = higher quality)
        min_length: Minimum centerline length in mm (shorter lines are filtered out)
        simplify_tolerance: Douglas-Peucker simplification tolerance in mm
        merge_tolerance: Tolerance for merging nearby polyline endpoints in mm
        loop_threshold: Maximum gap distance to close as a loop in mm
        chaikin_iterations: Number of Chaikin corner-cutting smoothing passes
        min_angle: Angles below this threshold (degrees) are smoothed
        max_extend: Maximum distance to extend endpoints (mm)
        method: Extraction method - "skeleton" (morphological thinning) or "offset" (polygon offsetting)

    Returns:
        Tuple of (centerlines, stats) where:
        - centerlines: List of polylines per polygon, each polyline is list of (x, y) tuples
        - stats: Dictionary with extraction statistics
    """
    total_start = time.perf_counter()

    all_centerlines: List[List[List[Tuple[float, float]]]] = []
    total_polylines = 0
    total_length_mm = 0.0

    for poly_data in polygons:
        # Convert to Shapely polygon
        outer_coords = [(p['x'], p['y']) for p in poly_data['outer']]
        holes = []
        for hole in poly_data.get('holes', []):
            hole_coords = [(p['x'], p['y']) for p in hole]
            if len(hole_coords) >= 3:
                holes.append(hole_coords)

        if len(outer_coords) < 3:
            all_centerlines.append([])
            continue

        try:
            polygon = Polygon(outer_coords, holes)
            if not polygon.is_valid:
                polygon = polygon.buffer(0)  # Fix invalid polygons
        except Exception as e:
            print(f"[CENTERLINE] Invalid polygon: {e}")
            all_centerlines.append([])
            continue

        # Extract centerlines for this polygon using selected method
        if method == "voronoi" and CENTERLINE_AVAILABLE:
            polylines = _extract_centerlines_voronoi(
                polygon, min_length, simplify_tolerance,
                chaikin_iterations, min_angle, resolution,
                spoke_filter_threshold=spoke_filter
            )
        elif method == "offset":
            polylines = _extract_centerlines_offset(
                polygon, min_length, simplify_tolerance,
                chaikin_iterations, min_angle
            )
        else:  # skeleton (default)
            polylines = _extract_single_polygon_centerlines(
                polygon, resolution, min_length, simplify_tolerance,
                merge_tolerance, loop_threshold, chaikin_iterations,
                min_angle, max_extend
            )

        all_centerlines.append(polylines)
        total_polylines += len(polylines)

        for pl in polylines:
            if len(pl) >= 2:
                line = LineString(pl)
                total_length_mm += line.length

    elapsed_ms = (time.perf_counter() - total_start) * 1000

    stats = {
        'num_polygons': len(polygons),
        'num_polylines': total_polylines,
        'total_length_mm': round(total_length_mm, 2),
        'processing_time_ms': round(elapsed_ms, 2),
        'resolution': resolution,
        'min_length': min_length,
    }

    print(f"[CENTERLINE] Extracted {total_polylines} polylines from {len(polygons)} polygons in {elapsed_ms:.1f}ms")

    return all_centerlines, stats


def _extract_single_polygon_centerlines(
    polygon: Polygon,
    resolution: float,
    min_length: float,
    simplify_tolerance: float,
    merge_tolerance: float,
    loop_threshold: float,
    chaikin_iterations: int,
    min_angle: float,
    max_extend: float,
) -> List[List[Tuple[float, float]]]:
    """
    Extract centerlines from a single polygon.

    Process:
    1. Render polygon to bitmap at given resolution
    2. Apply morphological thinning (Zhang-Suen)
    3. Trace skeleton pixels directly (NOT using findContours!)
    4. Filter short stubs and simplify
    """
    # Get bounding box
    minx, miny, maxx, maxy = polygon.bounds
    width = maxx - minx
    height = maxy - miny

    if width < 0.1 or height < 0.1:
        return []

    # Calculate image size (pixels per mm)
    pixels_per_mm = 1.0 / resolution
    img_width = max(3, int(np.ceil(width * pixels_per_mm)) + 2)
    img_height = max(3, int(np.ceil(height * pixels_per_mm)) + 2)

    # Limit image size to prevent memory issues
    max_dimension = 4096
    if img_width > max_dimension or img_height > max_dimension:
        scale = max_dimension / max(img_width, img_height)
        img_width = int(img_width * scale)
        img_height = int(img_height * scale)
        pixels_per_mm = min(img_width / width, img_height / height)

    # Create binary image
    img = np.zeros((img_height, img_width), dtype=np.uint8)

    # Rasterize polygon
    def world_to_pixel(x: float, y: float) -> Tuple[int, int]:
        px = int((x - minx) * pixels_per_mm) + 1
        py = int((maxy - y) * pixels_per_mm) + 1  # Flip Y for image coordinates
        return (px, py)

    def pixel_to_world(px: int, py: int) -> Tuple[float, float]:
        x = minx + (px - 1) / pixels_per_mm
        y = maxy - (py - 1) / pixels_per_mm
        return (x, y)

    # Draw outer boundary
    outer_pts = np.array([world_to_pixel(x, y) for x, y in polygon.exterior.coords], dtype=np.int32)
    cv2.fillPoly(img, [outer_pts], 255)

    # Cut out holes
    for hole in polygon.interiors:
        hole_pts = np.array([world_to_pixel(x, y) for x, y in hole.coords], dtype=np.int32)
        cv2.fillPoly(img, [hole_pts], 0)

    # Apply morphological thinning (Zhang-Suen algorithm)
    try:
        skeleton = cv2.ximgproc.thinning(img, thinningType=cv2.ximgproc.THINNING_ZHANGSUEN)
    except AttributeError:
        # Fallback: use basic morphological skeleton if ximgproc not available
        skeleton = _morphological_skeleton(img)

    # Trace skeleton directly (NOT using findContours which creates double lines!)
    polylines = _trace_skeleton_directly(skeleton, pixel_to_world, min_length, pixels_per_mm, merge_tolerance)

    # Debug logging
    print(f"[CENTERLINE DEBUG] Image size: {img_width}x{img_height} px, pixels_per_mm: {pixels_per_mm:.1f}")
    print(f"[CENTERLINE DEBUG] Skeleton pixels: {np.count_nonzero(skeleton)}")
    print(f"[CENTERLINE DEBUG] Raw polylines: {len(polylines)}")
    for i, pl in enumerate(polylines[:5]):  # Log first 5
        print(f"[CENTERLINE DEBUG]   Polyline {i}: {len(pl)} points, length: {LineString(pl).length:.2f}mm")

    # Simplify polylines
    simplified = []
    for pl in polylines:
        if len(pl) >= 2:
            line = LineString(pl)
            if line.length >= min_length:
                # Apply Douglas-Peucker simplification
                simplified_line = line.simplify(simplify_tolerance, preserve_topology=True)
                if simplified_line.length >= min_length:
                    if isinstance(simplified_line, LineString):
                        simplified.append(list(simplified_line.coords))
                    elif isinstance(simplified_line, MultiLineString):
                        for part in simplified_line.geoms:
                            if part.length >= min_length:
                                simplified.append(list(part.coords))

    # Apply Chaikin smoothing to remove pixel staircase effect
    smoothed = []
    for pl in simplified:
        if len(pl) >= 3 and chaikin_iterations > 0:
            smooth_pl = _chaikin_smooth(pl, iterations=chaikin_iterations)
            smoothed.append(smooth_pl)
        else:
            smoothed.append(pl)

    # Smooth out sharp angles (from skeleton junctions)
    angle_smoothed = []
    for pl in smoothed:
        if len(pl) >= 3 and min_angle > 0:
            smooth_pl = _smooth_sharp_angles(pl, min_angle_degrees=min_angle)
            angle_smoothed.append(smooth_pl)
        else:
            angle_smoothed.append(pl)

    # Extend endpoints to polygon boundary (but stop at other centerlines)
    extended = []
    for i, pl in enumerate(angle_smoothed):
        if len(pl) >= 2:
            # Pass other centerlines to avoid extending past them
            other_centerlines = [angle_smoothed[j] for j in range(len(angle_smoothed)) if j != i]
            ext_pl = _extend_endpoints_to_boundary(pl, polygon, other_centerlines, loop_threshold=loop_threshold, max_extend=max_extend)
            extended.append(ext_pl)
        else:
            extended.append(pl)

    # Debug: compare before/after simplification
    print(f"[CENTERLINE DEBUG] After simplification: {len(simplified)} polylines")
    for i, pl in enumerate(extended[:5]):
        orig = polylines[i] if i < len(polylines) else []
        simp = simplified[i] if i < len(simplified) else []
        smooth = smoothed[i] if i < len(smoothed) else []
        print(f"[CENTERLINE DEBUG]   Final {i}: {len(pl)} points (raw {len(orig)} → simp {len(simp)} → smooth {len(smooth)} → ext {len(pl)})")

    return extended


def _extract_centerlines_offset(
    polygon: Polygon,
    min_length: float,
    simplify_tolerance: float,
    chaikin_iterations: int,
    min_angle: float,
) -> List[List[Tuple[float, float]]]:
    """
    Extract centerlines using iterative polygon offsetting.

    This method works by progressively shrinking the polygon inward
    and tracking the collapse points. Better for shapes with uniform
    stroke width like fonts.

    Process:
    1. Calculate polygon width by finding max inscribed circle radius
    2. Offset polygon inward by small steps
    3. Track centroid/spine as polygon shrinks
    4. When polygon collapses, that path is the centerline
    """
    from shapely.geometry import MultiPolygon, GeometryCollection
    from shapely.ops import unary_union

    if not polygon.is_valid:
        polygon = polygon.buffer(0)

    if polygon.is_empty or polygon.area < 0.01:
        return []

    polylines: List[List[Tuple[float, float]]] = []

    # Estimate the "width" of the shape using negative buffer
    # The shape disappears when offset by half its width
    test_offset = 0.1
    max_offset = 50.0  # Safety limit

    # Binary search to find collapse distance
    low, high = 0.0, max_offset
    while high - low > 0.05:
        mid = (low + high) / 2
        shrunk = polygon.buffer(-mid)
        if shrunk.is_empty or shrunk.area < 0.01:
            high = mid
        else:
            low = mid

    half_width = high
    print(f"[CENTERLINE OFFSET] Estimated half-width: {half_width:.2f}mm")

    if half_width < 0.1:
        # Very thin shape - just return the centroid line
        return []

    # Generate centerline by tracking centroids at different offset levels
    centerline_points: List[Tuple[float, float]] = []
    num_steps = max(10, int(half_width / 0.2))  # At least 10 steps, or one per 0.2mm

    # For shapes with holes (like 'O', 'A', etc.), extract ring centerlines
    if polygon.interiors:
        # For each hole, create a centerline between outer and hole
        for interior in polygon.interiors:
            ring_centerline = _extract_ring_centerline(polygon.exterior, interior, half_width)
            if ring_centerline and len(ring_centerline) >= 2:
                polylines.append(ring_centerline)
    else:
        # Simple polygon without holes - use spine extraction
        spine = _extract_polygon_spine(polygon, half_width, num_steps)
        if spine and len(spine) >= 2:
            polylines.append(spine)

    # Apply simplification and smoothing
    result = []
    for pl in polylines:
        if len(pl) >= 2:
            line = LineString(pl)
            if line.length >= min_length:
                # Simplify
                simplified = line.simplify(simplify_tolerance, preserve_topology=True)
                coords = list(simplified.coords)

                # Chaikin smoothing
                if len(coords) >= 3 and chaikin_iterations > 0:
                    coords = _chaikin_smooth(coords, iterations=chaikin_iterations)

                # Angle smoothing
                if len(coords) >= 3 and min_angle > 0:
                    coords = _smooth_sharp_angles(coords, min_angle_degrees=min_angle)

                if len(coords) >= 2:
                    result.append(coords)

    print(f"[CENTERLINE OFFSET] Generated {len(result)} polylines")
    return result


def _extract_centerlines_voronoi(
    polygon: Polygon,
    min_length: float,
    simplify_tolerance: float,
    chaikin_iterations: int,
    min_angle: float,
    interpolation_distance: float = 0.5,
    spoke_filter_threshold: float = 1.5,
) -> List[List[Tuple[float, float]]]:
    """
    Extract centerlines using Voronoi-based medial axis.

    This method uses the 'centerline' library which computes the
    mathematically correct medial axis using Voronoi diagrams.
    More robust than skeleton for complex shapes.

    Args:
        polygon: Shapely Polygon object
        min_length: Minimum line length in mm
        simplify_tolerance: Douglas-Peucker tolerance in mm
        chaikin_iterations: Smoothing passes
        min_angle: Angles below this are smoothed (degrees)
        interpolation_distance: Sampling distance for Voronoi (mm)
    """
    if not CENTERLINE_AVAILABLE:
        print("[CENTERLINE VORONOI] Library not available, falling back to skeleton")
        return []

    if not polygon.is_valid:
        polygon = polygon.buffer(0)

    if polygon.is_empty or polygon.area < 0.01:
        return []

    try:
        # Calculate appropriate interpolation distance based on polygon size
        minx, miny, maxx, maxy = polygon.bounds
        diag = np.sqrt((maxx - minx) ** 2 + (maxy - miny) ** 2)

        # If interpolation_distance is very small (skeleton default), use 0.5 as fallback
        if interpolation_distance < 0.1:
            interpolation_distance = 0.5

        # Use smaller interpolation for smaller shapes (more detail)
        interp_dist = max(0.1, min(interpolation_distance, diag / 50))

        print(f"[CENTERLINE VORONOI] Processing polygon, area={polygon.area:.2f}, interp_dist={interp_dist:.2f}")

        # Generate Voronoi-based centerline
        cl = VoronoiCenterline(polygon, interpolation_distance=interp_dist)
        geom = cl.geometry

        if geom.is_empty:
            print("[CENTERLINE VORONOI] Empty result")
            return []

        # Merge connected segments
        merged = linemerge(geom)

        # Convert to list of polylines (no min_length filter yet)
        polylines: List[List[Tuple[float, float]]] = []

        if merged.geom_type == 'LineString':
            polylines.append(list(merged.coords))
        elif merged.geom_type == 'MultiLineString':
            for line in merged.geoms:
                polylines.append(list(line.coords))

        print(f"[CENTERLINE VORONOI] Raw polylines: {len(polylines)}")

        # === STEP 1: Apply simplification and smoothing FIRST ===
        # This helps clean up geometry before spoke detection
        smoothed_polylines = []
        for pl in polylines:
            if len(pl) >= 2:
                line = LineString(pl)
                # Simplify
                simplified = line.simplify(simplify_tolerance, preserve_topology=True)
                coords = list(simplified.coords)

                # Chaikin smoothing
                if len(coords) >= 3 and chaikin_iterations > 0:
                    coords = _chaikin_smooth(coords, iterations=chaikin_iterations)

                # Angle smoothing
                if len(coords) >= 3 and min_angle > 0:
                    coords = _smooth_sharp_angles(coords, min_angle_degrees=min_angle)

                if len(coords) >= 2:
                    smoothed_polylines.append(coords)

        print(f"[CENTERLINE VORONOI] After smoothing: {len(smoothed_polylines)} polylines")

        # === STEP 2: Filter spokes (single pass, after smoothing) ===
        # Spokes are Voronoi artifacts - short lines going to polygon corners
        spoke_threshold = spoke_filter_threshold
        connection_tolerance = 0.15  # Distance to consider endpoints "connected"

        # Find convex corners of the polygon (where spokes typically go)
        def get_convex_corners(poly):
            """Find convex (outward-pointing) corners of the polygon."""
            corners = []
            coords = list(poly.exterior.coords)[:-1]  # Remove duplicate last point
            n = len(coords)
            for i in range(n):
                p0 = coords[(i - 1) % n]
                p1 = coords[i]
                p2 = coords[(i + 1) % n]
                # Cross product to determine turn direction
                cross = (p1[0] - p0[0]) * (p2[1] - p1[1]) - (p1[1] - p0[1]) * (p2[0] - p1[0])
                # For CCW polygon, negative cross = convex corner
                # For CW polygon, positive cross = convex corner
                # Check both to be safe
                corners.append((Point(p1), abs(cross) > 0.01))  # Store point and if it's a sharp corner
            return [c[0] for c in corners if c[1]]

        convex_corners = get_convex_corners(polygon)
        corner_tolerance = 0.5  # Distance to consider "at a corner"

        def is_near_corner(pt):
            """Check if point is near any convex corner."""
            for corner in convex_corners:
                if pt.distance(corner) < corner_tolerance:
                    return True
            return False

        def is_endpoint_connected(pt, all_lines, exclude_idx):
            """Check if a point connects to other lines (not just the excluded one)."""
            for i, other_pl in enumerate(all_lines):
                if i == exclude_idx:
                    continue
                other_start = Point(other_pl[0])
                other_end = Point(other_pl[-1])
                if pt.distance(other_start) < connection_tolerance or pt.distance(other_end) < connection_tolerance:
                    return True
            return False

        def filter_spokes(lines):
            """Single pass of spoke filtering."""
            kept = []
            removed = 0
            for i, pl in enumerate(lines):
                if len(pl) < 2:
                    continue

                line = LineString(pl)
                start_pt = Point(pl[0])
                end_pt = Point(pl[-1])

                # Check if endpoints are near convex corners
                start_at_corner = is_near_corner(start_pt)
                end_at_corner = is_near_corner(end_pt)

                # Check if endpoints are connected to other lines
                start_connected = is_endpoint_connected(start_pt, lines, i)
                end_connected = is_endpoint_connected(end_pt, lines, i)

                # A spoke is a short line where:
                # - One end is at a convex corner AND that end is not connected to other lines
                # - It's short enough to be an artifact
                is_corner_spoke = (
                    line.length < spoke_threshold and
                    ((start_at_corner and not start_connected) or
                     (end_at_corner and not end_connected))
                )

                if is_corner_spoke:
                    print(f"[CENTERLINE VORONOI]   Removing spoke: length={line.length:.2f}mm, start_corner={start_at_corner}, end_corner={end_at_corner}")
                    removed += 1
                    continue

                kept.append(pl)

            return kept, removed

        # Apply spoke filter (single pass only)
        filtered_polylines = smoothed_polylines
        total_removed = 0

        if spoke_filter_threshold > 0:
            filtered_polylines, total_removed = filter_spokes(filtered_polylines)
            print(f"[CENTERLINE VORONOI] Filtered {total_removed} spokes (from {len(convex_corners)} corners)")
        else:
            print(f"[CENTERLINE VORONOI] Spoke filter disabled")

        # === STEP 3: Apply min_length filter ===
        result = []
        for pl in filtered_polylines:
            if len(pl) >= 2:
                line = LineString(pl)
                if line.length >= min_length:
                    result.append(pl)

        print(f"[CENTERLINE VORONOI] Generated {len(result)} polylines (min_length={min_length}mm)")
        return result

    except Exception as e:
        print(f"[CENTERLINE VORONOI] Error: {e}")
        import traceback
        traceback.print_exc()
        return []


def _extract_polygon_spine(
    polygon: Polygon,
    half_width: float,
    num_steps: int
) -> List[Tuple[float, float]]:
    """
    Extract spine of a simple polygon by tracking centroids during shrinking.
    """
    from shapely.geometry import MultiPolygon

    spine_points = []

    # Start from small offset to avoid boundary noise
    for i in range(num_steps):
        offset = (i / num_steps) * half_width * 0.95  # Don't go all the way to collapse
        shrunk = polygon.buffer(-offset)

        if shrunk.is_empty:
            break

        # Handle MultiPolygon (shape splits during shrinking)
        if isinstance(shrunk, MultiPolygon):
            # Take the largest piece
            shrunk = max(shrunk.geoms, key=lambda g: g.area)

        if shrunk.area < 0.01:
            break

        centroid = shrunk.centroid
        if not centroid.is_empty:
            spine_points.append((centroid.x, centroid.y))

    # Also sample along the length of the shape
    # Use the medial points from progressive offsets
    if len(spine_points) < 3:
        # Fallback: sample boundary midpoints
        coords = list(polygon.exterior.coords)
        if len(coords) > 4:
            mid_idx = len(coords) // 2
            start = coords[0]
            mid = coords[mid_idx]
            # Simple line through center
            centroid = polygon.centroid
            spine_points = [start, (centroid.x, centroid.y), mid]

    return spine_points


def _extract_ring_centerline(
    outer_ring,
    inner_ring,
    half_width: float
) -> List[Tuple[float, float]]:
    """
    Extract centerline between outer boundary and a hole.

    For ring shapes (like 'O'), the centerline follows the middle
    between outer and inner boundaries.
    """
    outer_coords = list(outer_ring.coords)
    inner_coords = list(inner_ring.coords)

    if len(outer_coords) < 4 or len(inner_coords) < 4:
        return []

    # Sample points along both rings and find midpoints
    num_samples = max(len(outer_coords), len(inner_coords), 50)

    outer_line = LineString(outer_coords)
    inner_line = LineString(inner_coords)

    centerline_points = []

    for i in range(num_samples):
        t = i / num_samples

        # Point on outer ring
        outer_pt = outer_line.interpolate(t, normalized=True)

        # Find closest point on inner ring
        inner_pt = inner_line.interpolate(inner_line.project(outer_pt))

        # Midpoint
        mid_x = (outer_pt.x + inner_pt.x) / 2
        mid_y = (outer_pt.y + inner_pt.y) / 2
        centerline_points.append((mid_x, mid_y))

    # Close the loop
    if centerline_points:
        centerline_points.append(centerline_points[0])

    return centerline_points


def _morphological_skeleton(img: np.ndarray) -> np.ndarray:
    """
    Fallback morphological skeleton using basic OpenCV operations.
    Less accurate than Zhang-Suen but doesn't require opencv-contrib.
    """
    skeleton = np.zeros_like(img)
    element = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))

    working = img.copy()
    while True:
        eroded = cv2.erode(working, element)
        temp = cv2.dilate(eroded, element)
        temp = cv2.subtract(working, temp)
        skeleton = cv2.bitwise_or(skeleton, temp)
        working = eroded.copy()

        if cv2.countNonZero(working) == 0:
            break

    return skeleton


def _trace_skeleton_directly(
    skeleton: np.ndarray,
    pixel_to_world,
    min_length: float,
    pixels_per_mm: float,
    merge_tolerance: float,
) -> List[List[Tuple[float, float]]]:
    """
    Directly trace skeleton by following connected pixels.
    This is the correct method for skeletons - NOT findContours!
    """
    # Find all skeleton pixels as a set for O(1) lookup
    skeleton_points = set(map(tuple, np.column_stack(np.where(skeleton > 0))))
    if not skeleton_points:
        return []

    polylines = []
    visited: Set[Tuple[int, int]] = set()

    # 8-connected neighbors (ordered for smoother tracing)
    neighbors = [(-1, 0), (0, 1), (1, 0), (0, -1), (-1, -1), (-1, 1), (1, 1), (1, -1)]

    def get_unvisited_neighbors(pt: Tuple[int, int]) -> List[Tuple[int, int]]:
        """Get unvisited neighbors that are skeleton pixels."""
        result = []
        for dy, dx in neighbors:
            neighbor = (pt[0] + dy, pt[1] + dx)
            if neighbor in skeleton_points and neighbor not in visited:
                result.append(neighbor)
        return result

    def count_neighbors(pt: Tuple[int, int]) -> int:
        """Count total neighbors (for endpoint/junction detection)."""
        return sum(1 for dy, dx in neighbors if (pt[0] + dy, pt[1] + dx) in skeleton_points)

    # Classify points
    endpoints = []  # 1 neighbor
    junctions = []  # 3+ neighbors

    for pt in skeleton_points:
        n = count_neighbors(pt)
        if n == 1:
            endpoints.append(pt)
        elif n >= 3:
            junctions.append(pt)

    # Start tracing from endpoints first, then junctions, then any remaining
    start_points = endpoints + junctions
    if not start_points:
        start_points = [next(iter(skeleton_points))]

    def trace_path(start: Tuple[int, int]) -> List[Tuple[int, int]]:
        """Trace a path from a starting point."""
        path = [start]
        visited.add(start)
        current = start

        while True:
            unvisited = get_unvisited_neighbors(current)
            if not unvisited:
                break

            # Choose the best next point (prefer continuing straight)
            if len(path) >= 2:
                # Calculate direction
                prev = path[-2]
                dx = current[1] - prev[1]
                dy = current[0] - prev[0]

                # Score neighbors by how well they continue the direction
                def direction_score(neighbor):
                    ndx = neighbor[1] - current[1]
                    ndy = neighbor[0] - current[0]
                    # Dot product (higher = more aligned)
                    return dx * ndx + dy * ndy

                unvisited.sort(key=direction_score, reverse=True)

            next_pt = unvisited[0]
            path.append(next_pt)
            visited.add(next_pt)
            current = next_pt

        return path

    # Trace all paths
    for start in start_points:
        if start in visited:
            continue

        path = trace_path(start)

        # For endpoints, also try tracing in the other direction
        if start in endpoints and len(path) > 1:
            # Remove start from visited to allow re-visiting from other direction
            # Actually, trace from the other end if it's also an endpoint
            other_end = path[-1]
            if other_end in endpoints and other_end not in visited:
                # Already traced the full path
                pass

        if len(path) >= 2:
            # Convert to world coordinates
            world_path = [pixel_to_world(pt[1], pt[0]) for pt in path]

            # Check minimum length in world coordinates
            line = LineString(world_path)
            min_pixel_length = min_length * pixels_per_mm * 0.3  # Use 30% threshold, filter later
            if len(path) >= min_pixel_length or line.length >= min_length * 0.3:
                polylines.append(world_path)

    # Handle remaining unvisited points (isolated loops, etc.)
    remaining = skeleton_points - visited
    while remaining:
        start = next(iter(remaining))
        path = trace_path(start)
        remaining = skeleton_points - visited

        if len(path) >= 2:
            world_path = [pixel_to_world(pt[1], pt[0]) for pt in path]
            line = LineString(world_path)
            if line.length >= min_length * 0.3:
                polylines.append(world_path)

    # Try to merge connected polylines with tolerance for near-connections
    if len(polylines) > 1:
        polylines = _merge_nearby_polylines(polylines, tolerance=merge_tolerance)

    return polylines


def _merge_nearby_polylines(
    polylines: List[List[Tuple[float, float]]],
    tolerance: float = 0.5
) -> List[List[Tuple[float, float]]]:
    """
    Merge polylines that have endpoints within tolerance distance.

    This handles cases where skeleton tracing creates segments that
    don't exactly touch but should be connected.
    """
    if len(polylines) <= 1:
        return polylines

    # Work with a copy
    segments = [list(pl) for pl in polylines if len(pl) >= 2]
    if not segments:
        return polylines

    merged = True
    while merged:
        merged = False
        i = 0
        while i < len(segments):
            j = i + 1
            while j < len(segments):
                seg_i = segments[i]
                seg_j = segments[j]

                # Check all endpoint combinations
                i_start, i_end = seg_i[0], seg_i[-1]
                j_start, j_end = seg_j[0], seg_j[-1]

                def dist(p1, p2):
                    return np.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2)

                # Try to connect
                new_seg = None
                if dist(i_end, j_start) < tolerance:
                    # i_end connects to j_start
                    new_seg = seg_i + seg_j[1:]
                elif dist(i_end, j_end) < tolerance:
                    # i_end connects to j_end (reverse j)
                    new_seg = seg_i + seg_j[-2::-1]
                elif dist(i_start, j_start) < tolerance:
                    # i_start connects to j_start (reverse i)
                    new_seg = seg_i[::-1] + seg_j[1:]
                elif dist(i_start, j_end) < tolerance:
                    # i_start connects to j_end
                    new_seg = seg_j + seg_i[1:]

                if new_seg:
                    segments[i] = new_seg
                    segments.pop(j)
                    merged = True
                else:
                    j += 1
            i += 1

    return segments


def _smooth_sharp_angles(
    coords: List[Tuple[float, float]],
    min_angle_degrees: float = 120.0
) -> List[Tuple[float, float]]:
    """
    Smooth out sharp angles in a polyline by averaging with neighbors.

    Sharp angles (< min_angle_degrees) often occur at skeleton junctions
    and look unnatural. This smooths them by moving the point towards
    the midpoint of its neighbors.
    """
    import math

    if len(coords) < 3:
        return coords

    result = list(coords)

    def angle_at_point(p0, p1, p2):
        """Calculate angle at p1 in degrees (0-180)."""
        v1 = (p0[0] - p1[0], p0[1] - p1[1])
        v2 = (p2[0] - p1[0], p2[1] - p1[1])

        len1 = math.sqrt(v1[0]**2 + v1[1]**2)
        len2 = math.sqrt(v2[0]**2 + v2[1]**2)

        if len1 < 1e-6 or len2 < 1e-6:
            return 180.0

        dot = v1[0]*v2[0] + v1[1]*v2[1]
        cos_angle = max(-1, min(1, dot / (len1 * len2)))
        return math.degrees(math.acos(cos_angle))

    # Multiple passes to smooth progressively
    for _ in range(3):
        changed = False
        new_result = [result[0]]  # Keep first point

        for i in range(1, len(result) - 1):
            p0, p1, p2 = result[i-1], result[i], result[i+1]
            angle = angle_at_point(p0, p1, p2)

            if angle < min_angle_degrees:
                # Sharp angle - move point towards midpoint of neighbors
                mid = ((p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2)
                # Blend: 70% towards midpoint
                smoothed = (
                    p1[0] * 0.3 + mid[0] * 0.7,
                    p1[1] * 0.3 + mid[1] * 0.7
                )
                new_result.append(smoothed)
                changed = True
            else:
                new_result.append(p1)

        new_result.append(result[-1])  # Keep last point
        result = new_result

        if not changed:
            break

    return result


def _chaikin_smooth(
    coords: List[Tuple[float, float]],
    iterations: int = 2
) -> List[Tuple[float, float]]:
    """
    Apply Chaikin's corner cutting algorithm to smooth a polyline.

    This removes the staircase effect from pixel-traced paths by
    iteratively cutting corners with 1/4 and 3/4 interpolation points.
    """
    result = list(coords)

    for _ in range(iterations):
        if len(result) < 3:
            return result

        new_coords = [result[0]]  # Keep first point

        for i in range(len(result) - 1):
            p0, p1 = result[i], result[i + 1]
            # Q = 3/4 * P0 + 1/4 * P1
            q = (0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1])
            # R = 1/4 * P0 + 3/4 * P1
            r = (0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1])
            new_coords.extend([q, r])

        new_coords.append(result[-1])  # Keep last point
        result = new_coords

    return result


def _extend_endpoints_to_boundary(
    coords: List[Tuple[float, float]],
    polygon: Polygon,
    other_centerlines: List[List[Tuple[float, float]]] = None,
    max_extension: float = 50.0,  # Maximum ray length for searching
    loop_threshold: float = 5.0,  # Max gap to close as loop
    max_extend: float = 3.0,  # Actual max extension distance
) -> List[Tuple[float, float]]:
    """
    Extend centerline endpoints to reach the polygon boundary or another centerline.

    Skeleton/thinning algorithms stop before reaching the boundary.
    This extends the line in its direction until it hits:
    - Another centerline (preferred - creates T-junction)
    - The polygon boundary (fallback)
    """
    from shapely.geometry import Point, LineString as ShapelyLine

    if len(coords) < 2:
        return coords

    result = list(coords)
    boundary = polygon.boundary

    # Check if this is a nearly-closed loop (start and end points close together)
    start_pt = result[0]
    end_pt = result[-1]
    dist_start_end = np.sqrt((end_pt[0] - start_pt[0])**2 + (end_pt[1] - start_pt[1])**2)

    # Calculate total polyline length
    total_length = 0.0
    for i in range(len(result) - 1):
        dx = result[i+1][0] - result[i][0]
        dy = result[i+1][1] - result[i][1]
        total_length += np.sqrt(dx*dx + dy*dy)

    # Dynamic threshold: close loop if gap is small relative to total length
    # - Absolute max: 5mm gap
    # - Relative: gap < 15% of total length
    # - Minimum points: 4 (to form a valid loop)
    gap_ratio = dist_start_end / total_length if total_length > 0 else 1.0
    is_nearly_closed = (
        len(result) >= 4 and
        dist_start_end < loop_threshold and  # Max gap from parameter
        gap_ratio < 0.15  # Gap is less than 15% of total length
    )

    if is_nearly_closed:
        # Close the loop by averaging the endpoints
        midpoint = ((start_pt[0] + end_pt[0]) / 2, (start_pt[1] + end_pt[1]) / 2)
        result[0] = midpoint
        result[-1] = midpoint
        print(f"[CENTERLINE DEBUG] Closed loop detected (gap={dist_start_end:.2f}mm, {gap_ratio*100:.1f}% of {total_length:.1f}mm)")
        return result

    # Convert other centerlines to Shapely LineStrings
    other_lines = []
    if other_centerlines:
        for cl in other_centerlines:
            if len(cl) >= 2:
                other_lines.append(ShapelyLine(cl))

    def get_closest_intersection_point(
        extension_line: ShapelyLine,
        endpoint: Tuple[float, float],
        geometry
    ) -> Tuple[float, float] | None:
        """Extract closest intersection point from any geometry type."""
        intersection = extension_line.intersection(geometry)

        if intersection.is_empty:
            return None

        endpoint_pt = Point(endpoint)

        if intersection.geom_type == 'Point':
            return (intersection.x, intersection.y)
        elif intersection.geom_type == 'MultiPoint':
            closest = min(intersection.geoms, key=lambda p: endpoint_pt.distance(p))
            return (closest.x, closest.y)
        elif intersection.geom_type == 'LineString':
            # Take closest point on the line
            closest_pt = intersection.interpolate(intersection.project(endpoint_pt))
            return (closest_pt.x, closest_pt.y)
        elif intersection.geom_type == 'MultiLineString':
            all_points = []
            for geom in intersection.geoms:
                closest_pt = geom.interpolate(geom.project(endpoint_pt))
                all_points.append((closest_pt.x, closest_pt.y))
            if all_points:
                return min(all_points, key=lambda p: endpoint_pt.distance(Point(p)))
        elif intersection.geom_type == 'GeometryCollection':
            all_points = []
            for geom in intersection.geoms:
                if geom.geom_type == 'Point':
                    all_points.append((geom.x, geom.y))
                elif geom.geom_type == 'LineString':
                    closest_pt = geom.interpolate(geom.project(endpoint_pt))
                    all_points.append((closest_pt.x, closest_pt.y))
            if all_points:
                return min(all_points, key=lambda p: endpoint_pt.distance(Point(p)))

        return None

    def extend_point(endpoint: Tuple[float, float],
                     direction_point: Tuple[float, float]) -> Tuple[float, float]:
        """Extend a single endpoint towards boundary or other centerline."""
        endpoint_pt = Point(endpoint)

        # Calculate direction vector (from direction_point towards endpoint)
        dx = endpoint[0] - direction_point[0]
        dy = endpoint[1] - direction_point[1]
        length = np.sqrt(dx * dx + dy * dy)

        if length < 1e-6:
            return endpoint

        # Normalize direction
        dx /= length
        dy /= length

        # Create extension ray
        far_point = (
            endpoint[0] + dx * max_extension,
            endpoint[1] + dy * max_extension
        )

        extension_line = ShapelyLine([endpoint, far_point])

        # Collect all possible intersection points
        candidates = []

        # Check intersections with other centerlines first (preferred)
        for other_line in other_lines:
            pt = get_closest_intersection_point(extension_line, endpoint, other_line)
            if pt:
                dist = endpoint_pt.distance(Point(pt))
                if dist > 0.01:  # Avoid self-intersection at shared points
                    candidates.append((pt, dist, 'centerline'))

        # Check intersection with polygon boundary
        pt = get_closest_intersection_point(extension_line, endpoint, boundary)
        if pt:
            dist = endpoint_pt.distance(Point(pt))
            if dist > 0.01:
                candidates.append((pt, dist, 'boundary'))

        if not candidates:
            return endpoint

        # Return the closest intersection point, but ONLY if it's within reasonable distance
        closest = min(candidates, key=lambda c: c[1])

        if closest[1] > max_extend:
            # Intersection too far away - don't extend
            print(f"[CENTERLINE DEBUG] Skipping extension, closest intersection too far ({closest[1]:.1f}mm > {max_extend}mm)")
            return endpoint

        return closest[0]

    # Extend start point (use first two points for direction)
    new_start = extend_point(result[0], result[1])
    result[0] = new_start

    # Extend end point (use last two points for direction)
    new_end = extend_point(result[-1], result[-2])
    result[-1] = new_end

    return result
