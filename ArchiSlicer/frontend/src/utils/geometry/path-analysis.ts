/**
 * Path Analysis: Hole Detection und Path Relationship Analysis
 *
 * Erkennt automatisch:
 * - Outer Paths (äußere Konturen)
 * - Holes (innere Löcher, z.B. das Loch in einem "O")
 * - Nested Objects (eingeschlossene separate Objekte)
 */

import * as THREE from 'three';
import {
  calculateSignedArea,
  getWindingDirection,
  calculateBounds,
  isPointInPolygon,
  calculateArea
} from './clipper-utils';

// ============================================================================
// Type Definitions
// ============================================================================

export type PathRole = 'outer' | 'hole' | 'nested-object';

export interface PathInfo {
  id: string;
  polygon: THREE.Vector2[];
  windingDirection: 'cw' | 'ccw';
  signedArea: number;
  containmentDepth: number;          // 0 = top-level, 1 = inside one path, etc.
  parentPathId: string | null;       // ID of containing path
  childPathIds: string[];            // IDs of paths inside this one
  autoDetectedRole: PathRole;        // Automatically detected role
  userOverriddenRole: PathRole | null; // User can override
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  color?: string;                    // Optional: Farbe des Pfads (für globale Analyse)
}

/**
 * Input für analyzePathRelationshipsWithColors
 */
export interface PolygonWithColor {
  polygon: THREE.Vector2[];
  color: string;
}

export interface PathAnalysisResult {
  paths: PathInfo[];
  outerPaths: PathInfo[];
  holes: PathInfo[];
  nestedObjects: PathInfo[];
}

// ============================================================================
// Path Analysis Functions
// ============================================================================

/**
 * Generate unique ID for a path
 */
function generatePathId(): string {
  return `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if path A is completely inside path B using bounding box + point test
 */
function isPathInsidePath(inner: PathInfo, outer: PathInfo): boolean {
  // Quick bounding box rejection
  if (inner.bounds.minX < outer.bounds.minX ||
      inner.bounds.maxX > outer.bounds.maxX ||
      inner.bounds.minY < outer.bounds.minY ||
      inner.bounds.maxY > outer.bounds.maxY) {
    return false;
  }

  // Check if first point of inner is inside outer polygon
  if (inner.polygon.length === 0) return false;
  return isPointInPolygon(inner.polygon[0], outer.polygon);
}

/**
 * Determine the role of a path based on winding direction and containment
 *
 * Rules:
 * - Depth 0 (top-level): Always "outer"
 * - Depth 1: If CW → "hole", if CCW → "nested-object"
 * - Depth 2+: If different winding than parent → "hole", else → "nested-object"
 */
function determineRole(path: PathInfo, parentPath: PathInfo | null): PathRole {
  // Top-level paths are always outer
  if (path.containmentDepth === 0) {
    return 'outer';
  }

  // Depth 1: Check winding direction (SVG convention)
  if (path.containmentDepth === 1) {
    // CW inside CCW = hole (standard convention)
    // CCW inside CCW = nested object
    if (parentPath && parentPath.windingDirection === 'ccw') {
      return path.windingDirection === 'cw' ? 'hole' : 'nested-object';
    }
    // Inside CW parent - opposite logic
    return path.windingDirection === 'ccw' ? 'hole' : 'nested-object';
  }

  // Depth 2+: Alternate based on parent
  if (parentPath) {
    // Different winding than parent suggests it's a hole in the parent
    return path.windingDirection !== parentPath.windingDirection ? 'hole' : 'nested-object';
  }

  return 'nested-object';
}

/**
 * Analyze relationships between paths
 *
 * @param polygons Array of polygons (as THREE.Vector2 arrays)
 * @returns PathAnalysisResult with all path info and categorization
 */
export function analyzePathRelationships(polygons: THREE.Vector2[][]): PathAnalysisResult {
  // Create PathInfo for each polygon
  const paths: PathInfo[] = polygons.map(polygon => {
    const bounds = calculateBounds(polygon);
    return {
      id: generatePathId(),
      polygon,
      windingDirection: getWindingDirection(polygon),
      signedArea: calculateSignedArea(polygon),
      containmentDepth: 0,
      parentPathId: null,
      childPathIds: [],
      autoDetectedRole: 'outer' as PathRole,
      userOverriddenRole: null,
      bounds
    };
  });

  // Sort by area (largest first) - larger shapes are more likely to be parents
  paths.sort((a, b) => Math.abs(b.signedArea) - Math.abs(a.signedArea));

  // Build containment tree
  for (let i = 0; i < paths.length; i++) {
    const innerPath = paths[i];

    // Find the smallest containing path (most immediate parent)
    let smallestParent: PathInfo | null = null;
    let smallestParentArea = Infinity;

    for (let j = 0; j < paths.length; j++) {
      if (i === j) continue;

      const outerPath = paths[j];
      const outerArea = Math.abs(outerPath.signedArea);

      // Can't be contained by something smaller
      if (outerArea <= Math.abs(innerPath.signedArea)) continue;

      if (isPathInsidePath(innerPath, outerPath)) {
        if (outerArea < smallestParentArea) {
          smallestParent = outerPath;
          smallestParentArea = outerArea;
        }
      }
    }

    if (smallestParent) {
      innerPath.parentPathId = smallestParent.id;
      smallestParent.childPathIds.push(innerPath.id);
    }
  }

  // Calculate containment depths
  function calculateDepth(path: PathInfo): number {
    if (!path.parentPathId) return 0;
    const parent = paths.find(p => p.id === path.parentPathId);
    if (!parent) return 0;
    return 1 + calculateDepth(parent);
  }

  for (const path of paths) {
    path.containmentDepth = calculateDepth(path);
  }

  // Determine roles
  for (const path of paths) {
    const parent = path.parentPathId
      ? paths.find(p => p.id === path.parentPathId) || null
      : null;
    path.autoDetectedRole = determineRole(path, parent);
  }

  // Categorize
  const outerPaths = paths.filter(p => getEffectiveRole(p) === 'outer');
  const holes = paths.filter(p => getEffectiveRole(p) === 'hole');
  const nestedObjects = paths.filter(p => getEffectiveRole(p) === 'nested-object');

  return {
    paths,
    outerPaths,
    holes,
    nestedObjects
  };
}

/**
 * Analyze relationships between paths WITH COLOR INFORMATION
 *
 * Diese Funktion analysiert Pfade aller Farben gemeinsam, damit Holes korrekt
 * erkannt werden auch wenn sie eine andere Farbe haben als ihr Parent-Pfad.
 *
 * @param polygonsWithColors Array von Polygonen mit Farbinformation
 * @returns PathAnalysisResult mit Farb-Info in jedem PathInfo
 */
export function analyzePathRelationshipsWithColors(
  polygonsWithColors: PolygonWithColor[]
): PathAnalysisResult {
  // Create PathInfo for each polygon WITH color
  const paths: PathInfo[] = polygonsWithColors.map(({ polygon, color }) => {
    const bounds = calculateBounds(polygon);
    return {
      id: generatePathId(),
      polygon,
      color, // NEU: Farbe speichern
      windingDirection: getWindingDirection(polygon),
      signedArea: calculateSignedArea(polygon),
      containmentDepth: 0,
      parentPathId: null,
      childPathIds: [],
      autoDetectedRole: 'outer' as PathRole,
      userOverriddenRole: null,
      bounds
    };
  });

  // Sort by area (largest first) - larger shapes are more likely to be parents
  paths.sort((a, b) => Math.abs(b.signedArea) - Math.abs(a.signedArea));

  // Build containment tree (identical to analyzePathRelationships)
  for (let i = 0; i < paths.length; i++) {
    const innerPath = paths[i];

    // Find the smallest containing path (most immediate parent)
    let smallestParent: PathInfo | null = null;
    let smallestParentArea = Infinity;

    for (let j = 0; j < paths.length; j++) {
      if (i === j) continue;

      const outerPath = paths[j];
      const outerArea = Math.abs(outerPath.signedArea);

      // Can't be contained by something smaller
      if (outerArea <= Math.abs(innerPath.signedArea)) continue;

      if (isPathInsidePath(innerPath, outerPath)) {
        if (outerArea < smallestParentArea) {
          smallestParent = outerPath;
          smallestParentArea = outerArea;
        }
      }
    }

    if (smallestParent) {
      innerPath.parentPathId = smallestParent.id;
      smallestParent.childPathIds.push(innerPath.id);
    }
  }

  // Calculate containment depths
  function calculateDepth(path: PathInfo): number {
    if (!path.parentPathId) return 0;
    const parent = paths.find(p => p.id === path.parentPathId);
    if (!parent) return 0;
    return 1 + calculateDepth(parent);
  }

  for (const path of paths) {
    path.containmentDepth = calculateDepth(path);
  }

  // Determine roles
  for (const path of paths) {
    const parent = path.parentPathId
      ? paths.find(p => p.id === path.parentPathId) || null
      : null;
    path.autoDetectedRole = determineRole(path, parent);
  }

  // Categorize
  const outerPaths = paths.filter(p => getEffectiveRole(p) === 'outer');
  const holes = paths.filter(p => getEffectiveRole(p) === 'hole');
  const nestedObjects = paths.filter(p => getEffectiveRole(p) === 'nested-object');

  return {
    paths,
    outerPaths,
    holes,
    nestedObjects
  };
}

/**
 * Get effective role (user override takes precedence)
 */
export function getEffectiveRole(path: PathInfo): PathRole {
  return path.userOverriddenRole ?? path.autoDetectedRole;
}

/**
 * Check if a path is closed (first point == last point or has isClosed flag)
 */
function isPathClosed(positions: THREE.BufferAttribute, userData: Record<string, unknown>): boolean {
  // Check userData flag first (set by SVG loader)
  if (userData && userData.isClosed === true) {
    return true;
  }

  // Check if first and last points are the same (within tolerance)
  if (positions.count < 3) return false;

  const firstX = positions.getX(0);
  const firstY = positions.getY(0);
  const lastX = positions.getX(positions.count - 1);
  const lastY = positions.getY(positions.count - 1);

  const tolerance = 0.01; // 0.01mm tolerance
  const dx = Math.abs(firstX - lastX);
  const dy = Math.abs(firstY - lastY);

  return dx < tolerance && dy < tolerance;
}

/**
 * Extract polygons from a THREE.Group (from SVG)
 * Converts ONLY CLOSED Line geometries to Vector2 arrays
 */
export function extractPolygonsFromGroup(group: THREE.Group): THREE.Vector2[][] {
  const polygons: THREE.Vector2[][] = [];

  group.traverse((child) => {
    if (child instanceof THREE.Line) {
      const geometry = child.geometry as THREE.BufferGeometry;
      const positions = geometry.getAttribute('position');

      if (positions && positions.count >= 3) {
        // ONLY process closed paths
        if (!isPathClosed(positions as THREE.BufferAttribute, child.userData)) {
          return; // Skip open paths
        }

        const polygon: THREE.Vector2[] = [];

        for (let i = 0; i < positions.count; i++) {
          polygon.push(new THREE.Vector2(
            positions.getX(i),
            positions.getY(i)
          ));
        }

        // Only add if it has significant area (not just a line)
        if (calculateArea(polygon) > 0.1) {
          polygons.push(polygon);
        }
      }
    }
  });

  return polygons;
}

/**
 * Get the outer polygon and its holes for infill generation
 * Groups paths by their parent relationships
 */
export function getPolygonsWithHoles(
  analysisResult: PathAnalysisResult
): { outer: THREE.Vector2[]; holes: THREE.Vector2[][] }[] {
  const result: { outer: THREE.Vector2[]; holes: THREE.Vector2[][] }[] = [];

  // Find all outer paths
  for (const outerPath of analysisResult.outerPaths) {
    const holes: THREE.Vector2[][] = [];

    // Find direct children that are holes
    for (const childId of outerPath.childPathIds) {
      const childPath = analysisResult.paths.find(p => p.id === childId);
      if (childPath && getEffectiveRole(childPath) === 'hole') {
        holes.push(childPath.polygon);
      }
    }

    result.push({
      outer: outerPath.polygon,
      holes
    });
  }

  // Also include nested objects as separate entries (they need their own infill)
  for (const nestedPath of analysisResult.nestedObjects) {
    const holes: THREE.Vector2[][] = [];

    // Find direct children that are holes
    for (const childId of nestedPath.childPathIds) {
      const childPath = analysisResult.paths.find(p => p.id === childId);
      if (childPath && getEffectiveRole(childPath) === 'hole') {
        holes.push(childPath.polygon);
      }
    }

    result.push({
      outer: nestedPath.polygon,
      holes
    });
  }

  return result;
}

/**
 * Get outer polygons of a specific color with ALL their holes (any color)
 *
 * Diese Funktion ist speziell für die Infill-Generierung gedacht:
 * - Filtert Outer-Pfade nach der angegebenen Farbe
 * - Sammelt ALLE Holes die geometrisch innerhalb liegen (unabhängig von deren Farbe)
 *
 * @param analysisResult Ergebnis von analyzePathRelationshipsWithColors
 * @param targetColor Die Farbe für die Infill generiert werden soll
 * @returns Array von {outer, holes} wobei holes alle Farben enthalten kann
 */
export function getPolygonsWithHolesForColor(
  analysisResult: PathAnalysisResult,
  targetColor: string
): { outer: THREE.Vector2[]; holes: THREE.Vector2[][] }[] {
  const result: { outer: THREE.Vector2[]; holes: THREE.Vector2[][] }[] = [];
  const normalizedTargetColor = targetColor.toLowerCase();

  // Sammle alle Pfade dieser Farbe die "outer" oder "nested-object" sind
  // (diese können Infill bekommen)
  const fillablePaths = [...analysisResult.outerPaths, ...analysisResult.nestedObjects]
    .filter(p => p.color?.toLowerCase() === normalizedTargetColor);

  for (const outerPath of fillablePaths) {
    const holes: THREE.Vector2[][] = [];

    // Sammle ALLE direkten Kind-Holes (unabhängig von deren Farbe!)
    for (const childId of outerPath.childPathIds) {
      const childPath = analysisResult.paths.find(p => p.id === childId);
      if (childPath && getEffectiveRole(childPath) === 'hole') {
        holes.push(childPath.polygon);
      }
    }

    result.push({
      outer: outerPath.polygon,
      holes
    });
  }

  return result;
}

/**
 * Debug helper: Print path analysis
 */
export function printPathAnalysis(result: PathAnalysisResult): void {
  console.group('Path Analysis Result');
  console.log(`Total paths: ${result.paths.length}`);
  console.log(`Outer: ${result.outerPaths.length}`);
  console.log(`Holes: ${result.holes.length}`);
  console.log(`Nested Objects: ${result.nestedObjects.length}`);

  for (const path of result.paths) {
    const role = getEffectiveRole(path);
    const indent = '  '.repeat(path.containmentDepth);
    console.log(
      `${indent}[${path.id.slice(-6)}] ${role} ` +
      `(${path.windingDirection}, depth=${path.containmentDepth}, ` +
      `area=${Math.abs(path.signedArea).toFixed(1)})`
    );
  }

  console.groupEnd();
}
