/**
 * Clipper-Utils: Wrapper für js-clipper mit Three.js Integration
 *
 * Bietet robuste Polygon-Operationen:
 * - Polygon Offsetting (Inward/Outward)
 * - Boolean Operations (Difference, Union, Intersection)
 * - Line Clipping
 */

import * as THREE from 'three';
// @ts-ignore - js-clipper has no types
import * as ClipperLib from 'js-clipper';

// Scale factor for integer conversion (Clipper uses integers internally)
const SCALE = 1000;

// ============================================================================
// Type Definitions
// ============================================================================

export interface ClipperPoint {
  X: number;
  Y: number;
}

export type ClipperPath = ClipperPoint[];
export type ClipperPaths = ClipperPath[];

export type JoinType = 'miter' | 'round' | 'square';
export type EndType = 'closedPolygon' | 'closedLine' | 'openRound' | 'openSquare' | 'openButt';

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert THREE.Vector2 to Clipper IntPoint
 */
export function vector2ToClipperPoint(v: THREE.Vector2): ClipperPoint {
  return {
    X: Math.round(v.x * SCALE),
    Y: Math.round(v.y * SCALE)
  };
}

/**
 * Convert Clipper IntPoint to THREE.Vector2
 */
export function clipperPointToVector2(p: ClipperPoint): THREE.Vector2 {
  return new THREE.Vector2(p.X / SCALE, p.Y / SCALE);
}

/**
 * Convert array of THREE.Vector2 to Clipper Path
 */
export function polygonToClipperPath(polygon: THREE.Vector2[]): ClipperPath {
  return polygon.map(vector2ToClipperPoint);
}

/**
 * Convert Clipper Path to array of THREE.Vector2
 */
export function clipperPathToPolygon(path: ClipperPath): THREE.Vector2[] {
  return path.map(clipperPointToVector2);
}

/**
 * Convert multiple polygons to Clipper Paths
 */
export function polygonsToClipperPaths(polygons: THREE.Vector2[][]): ClipperPaths {
  return polygons.map(polygonToClipperPath);
}

/**
 * Convert Clipper Paths to multiple polygons
 */
export function clipperPathsToPolygons(paths: ClipperPaths): THREE.Vector2[][] {
  return paths.map(clipperPathToPolygon);
}

// ============================================================================
// Polygon Operations
// ============================================================================

/**
 * Offset a polygon inward or outward
 *
 * @param polygon - The polygon to offset
 * @param delta - Offset distance (negative = inward, positive = outward)
 * @param joinType - How to handle corners: 'miter', 'round', 'square'
 * @returns Array of resulting polygons (may be multiple if polygon splits)
 */
export function offsetPolygon(
  polygon: THREE.Vector2[],
  delta: number,
  joinType: JoinType = 'miter'
): THREE.Vector2[][] {
  const co = new ClipperLib.ClipperOffset();
  const solution: ClipperPaths = [];

  // Map join type
  const jt = joinType === 'miter' ? ClipperLib.JoinType.jtMiter :
             joinType === 'round' ? ClipperLib.JoinType.jtRound :
             ClipperLib.JoinType.jtSquare;

  // Add path
  co.AddPath(
    polygonToClipperPath(polygon),
    jt,
    ClipperLib.EndType.etClosedPolygon
  );

  // Execute offset
  co.Execute(solution, delta * SCALE);

  return clipperPathsToPolygons(solution);
}

/**
 * Offset multiple polygons together (useful for polygon with holes)
 */
export function offsetPolygons(
  polygons: THREE.Vector2[][],
  delta: number,
  joinType: JoinType = 'miter'
): THREE.Vector2[][] {
  const co = new ClipperLib.ClipperOffset();
  const solution: ClipperPaths = [];

  const jt = joinType === 'miter' ? ClipperLib.JoinType.jtMiter :
             joinType === 'round' ? ClipperLib.JoinType.jtRound :
             ClipperLib.JoinType.jtSquare;

  polygons.forEach(polygon => {
    co.AddPath(
      polygonToClipperPath(polygon),
      jt,
      ClipperLib.EndType.etClosedPolygon
    );
  });

  co.Execute(solution, delta * SCALE);

  return clipperPathsToPolygons(solution);
}

/**
 * Boolean difference: subject - clip
 * Useful for cutting holes out of polygons
 */
export function differencePolygon(
  subject: THREE.Vector2[],
  clip: THREE.Vector2[]
): THREE.Vector2[][] {
  const clipper = new ClipperLib.Clipper();
  const solution: ClipperPaths = [];

  clipper.AddPath(polygonToClipperPath(subject), ClipperLib.PolyType.ptSubject, true);
  clipper.AddPath(polygonToClipperPath(clip), ClipperLib.PolyType.ptClip, true);

  clipper.Execute(
    ClipperLib.ClipType.ctDifference,
    solution,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero
  );

  return clipperPathsToPolygons(solution);
}

/**
 * Boolean difference with multiple holes
 */
export function differencePolygonWithHoles(
  subject: THREE.Vector2[],
  holes: THREE.Vector2[][]
): THREE.Vector2[][] {
  const clipper = new ClipperLib.Clipper();
  const solution: ClipperPaths = [];

  clipper.AddPath(polygonToClipperPath(subject), ClipperLib.PolyType.ptSubject, true);

  holes.forEach(hole => {
    clipper.AddPath(polygonToClipperPath(hole), ClipperLib.PolyType.ptClip, true);
  });

  clipper.Execute(
    ClipperLib.ClipType.ctDifference,
    solution,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero
  );

  return clipperPathsToPolygons(solution);
}

/**
 * Boolean union: combine multiple polygons
 */
export function unionPolygons(
  polygons: THREE.Vector2[][]
): THREE.Vector2[][] {
  const clipper = new ClipperLib.Clipper();
  const solution: ClipperPaths = [];

  polygons.forEach(polygon => {
    clipper.AddPath(polygonToClipperPath(polygon), ClipperLib.PolyType.ptSubject, true);
  });

  clipper.Execute(
    ClipperLib.ClipType.ctUnion,
    solution,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero
  );

  return clipperPathsToPolygons(solution);
}

/**
 * Boolean intersection: get overlapping area
 */
export function intersectPolygons(
  subject: THREE.Vector2[],
  clip: THREE.Vector2[]
): THREE.Vector2[][] {
  const clipper = new ClipperLib.Clipper();
  const solution: ClipperPaths = [];

  clipper.AddPath(polygonToClipperPath(subject), ClipperLib.PolyType.ptSubject, true);
  clipper.AddPath(polygonToClipperPath(clip), ClipperLib.PolyType.ptClip, true);

  clipper.Execute(
    ClipperLib.ClipType.ctIntersection,
    solution,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero
  );

  return clipperPathsToPolygons(solution);
}

// ============================================================================
// Geometry Helpers
// ============================================================================

/**
 * Calculate signed area of a polygon
 * Positive = Counter-Clockwise (CCW) = Outer path
 * Negative = Clockwise (CW) = Hole
 */
export function calculateSignedArea(polygon: THREE.Vector2[]): number {
  let area = 0;
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i].x * polygon[j].y;
    area -= polygon[j].x * polygon[i].y;
  }

  return area / 2;
}

/**
 * Get winding direction of a polygon
 */
export function getWindingDirection(polygon: THREE.Vector2[]): 'cw' | 'ccw' {
  return calculateSignedArea(polygon) >= 0 ? 'ccw' : 'cw';
}

/**
 * Calculate absolute area of a polygon
 */
export function calculateArea(polygon: THREE.Vector2[]): number {
  return Math.abs(calculateSignedArea(polygon));
}

/**
 * Check if polygon is valid (has area and enough points)
 */
export function isValidPolygon(polygon: THREE.Vector2[], minArea: number = 0.1): boolean {
  return polygon.length >= 3 && calculateArea(polygon) >= minArea;
}

/**
 * Calculate centroid of a polygon
 */
export function calculateCentroid(polygon: THREE.Vector2[]): THREE.Vector2 {
  let cx = 0;
  let cy = 0;
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    cx += polygon[i].x;
    cy += polygon[i].y;
  }

  return new THREE.Vector2(cx / n, cy / n);
}

/**
 * Calculate bounding box of a polygon
 */
export function calculateBounds(polygon: THREE.Vector2[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of polygon) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Check if a point is inside a polygon (ray-casting algorithm)
 */
export function isPointInPolygon(point: THREE.Vector2, polygon: THREE.Vector2[]): boolean {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    const intersect = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Check if polygon A is completely inside polygon B
 */
export function isPolygonInsidePolygon(inner: THREE.Vector2[], outer: THREE.Vector2[]): boolean {
  // Check if all points of inner are inside outer
  for (const point of inner) {
    if (!isPointInPolygon(point, outer)) {
      return false;
    }
  }
  return true;
}

/**
 * Get the maximum inscribed radius (approximate) - useful for spiral patterns
 */
export function getMaxInscribedRadius(polygon: THREE.Vector2[], center: THREE.Vector2): number {
  let minDist = Infinity;
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dist = distancePointToSegment(center, polygon[i], polygon[j]);
    minDist = Math.min(minDist, dist);
  }

  return minDist;
}

/**
 * Calculate distance from point to line segment
 */
function distancePointToSegment(
  point: THREE.Vector2,
  segStart: THREE.Vector2,
  segEnd: THREE.Vector2
): number {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    // Segment is a point
    return point.distanceTo(segStart);
  }

  // Project point onto line
  let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const projection = new THREE.Vector2(
    segStart.x + t * dx,
    segStart.y + t * dy
  );

  return point.distanceTo(projection);
}

// ============================================================================
// Line Operations
// ============================================================================

/**
 * Find intersections of a line with polygon edges
 */
export function findLinePolygonIntersections(
  lineStart: THREE.Vector2,
  lineEnd: THREE.Vector2,
  polygon: THREE.Vector2[]
): THREE.Vector2[] {
  const intersections: THREE.Vector2[] = [];
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const intersection = lineSegmentIntersection(
      lineStart, lineEnd,
      polygon[i], polygon[j]
    );

    if (intersection) {
      intersections.push(intersection);
    }
  }

  // Sort by distance from lineStart
  intersections.sort((a, b) => {
    const da = a.distanceToSquared(lineStart);
    const db = b.distanceToSquared(lineStart);
    return da - db;
  });

  return intersections;
}

/**
 * Calculate intersection point of two line segments
 */
export function lineSegmentIntersection(
  p1: THREE.Vector2,
  p2: THREE.Vector2,
  p3: THREE.Vector2,
  p4: THREE.Vector2
): THREE.Vector2 | null {
  const dx1 = p2.x - p1.x;
  const dy1 = p2.y - p1.y;
  const dx2 = p4.x - p3.x;
  const dy2 = p4.y - p3.y;

  const det = dx1 * dy2 - dy1 * dx2;

  // Parallel lines
  if (Math.abs(det) < 1e-10) {
    return null;
  }

  const t1 = ((p3.x - p1.x) * dy2 - (p3.y - p1.y) * dx2) / det;
  const t2 = ((p3.x - p1.x) * dy1 - (p3.y - p1.y) * dx1) / det;

  // Check if intersection is within both segments
  if (t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1) {
    return new THREE.Vector2(
      p1.x + t1 * dx1,
      p1.y + t1 * dy1
    );
  }

  return null;
}

/**
 * Clip a line segment to a polygon boundary
 * Returns segments that are inside the polygon
 */
export function clipLineToPolygon(
  lineStart: THREE.Vector2,
  lineEnd: THREE.Vector2,
  polygon: THREE.Vector2[]
): { start: THREE.Vector2; end: THREE.Vector2 }[] {
  const segments: { start: THREE.Vector2; end: THREE.Vector2 }[] = [];

  const startInside = isPointInPolygon(lineStart, polygon);
  const endInside = isPointInPolygon(lineEnd, polygon);

  // Both inside - return full line
  if (startInside && endInside) {
    return [{ start: lineStart.clone(), end: lineEnd.clone() }];
  }

  // Find all intersections
  const intersections = findLinePolygonIntersections(lineStart, lineEnd, polygon);

  if (intersections.length === 0) {
    // No intersections and not both inside = line is outside
    return [];
  }

  // Build segments by walking along the line
  const allPoints: THREE.Vector2[] = [];

  if (startInside) {
    allPoints.push(lineStart.clone());
  }

  allPoints.push(...intersections);

  if (endInside) {
    allPoints.push(lineEnd.clone());
  }

  // Create segments between pairs of points
  for (let i = 0; i < allPoints.length - 1; i += 2) {
    if (i + 1 < allPoints.length) {
      const midpoint = new THREE.Vector2(
        (allPoints[i].x + allPoints[i + 1].x) / 2,
        (allPoints[i].y + allPoints[i + 1].y) / 2
      );

      // Only include if midpoint is inside
      if (isPointInPolygon(midpoint, polygon)) {
        segments.push({
          start: allPoints[i],
          end: allPoints[i + 1]
        });
      }
    }
  }

  return segments;
}
