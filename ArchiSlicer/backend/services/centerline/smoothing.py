"""Smoothing algorithms for centerline polylines."""

import math


def smooth_sharp_angles(
    coords: list[tuple[float, float]], min_angle_degrees: float = 120.0
) -> list[tuple[float, float]]:
    """
    Smooth out sharp angles in a polyline by averaging with neighbors.

    Sharp angles (< min_angle_degrees) often occur at skeleton junctions
    and look unnatural. This smooths them by moving the point towards
    the midpoint of its neighbors.
    """
    if len(coords) < 3:
        return coords

    result = list(coords)

    def angle_at_point(p0, p1, p2):
        """Calculate angle at p1 in degrees (0-180)."""
        v1 = (p0[0] - p1[0], p0[1] - p1[1])
        v2 = (p2[0] - p1[0], p2[1] - p1[1])

        len1 = math.sqrt(v1[0] ** 2 + v1[1] ** 2)
        len2 = math.sqrt(v2[0] ** 2 + v2[1] ** 2)

        if len1 < 1e-6 or len2 < 1e-6:
            return 180.0

        dot = v1[0] * v2[0] + v1[1] * v2[1]
        cos_angle = max(-1, min(1, dot / (len1 * len2)))
        return math.degrees(math.acos(cos_angle))

    # Multiple passes to smooth progressively
    for _ in range(3):
        changed = False
        new_result = [result[0]]  # Keep first point

        for i in range(1, len(result) - 1):
            p0, p1, p2 = result[i - 1], result[i], result[i + 1]
            angle = angle_at_point(p0, p1, p2)

            if angle < min_angle_degrees:
                # Sharp angle - move point towards midpoint of neighbors
                mid = ((p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2)
                # Blend: 70% towards midpoint
                smoothed = (p1[0] * 0.3 + mid[0] * 0.7, p1[1] * 0.3 + mid[1] * 0.7)
                new_result.append(smoothed)
                changed = True
            else:
                new_result.append(p1)

        new_result.append(result[-1])  # Keep last point
        result = new_result

        if not changed:
            break

    return result


def chaikin_smooth(
    coords: list[tuple[float, float]], iterations: int = 2
) -> list[tuple[float, float]]:
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


__all__ = [
    "smooth_sharp_angles",
    "chaikin_smooth",
]
