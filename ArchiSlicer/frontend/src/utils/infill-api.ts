/**
 * Backend API client for infill generation and path optimization.
 *
 * This module provides functions to call the Python backend for:
 * - Infill pattern generation (lines, grid, concentric, crosshatch)
 * - TSP path optimization to minimize pen lifts and travel distance
 */

import * as THREE from 'three';
import type { InfillOptions, InfillPatternType } from './threejs_services';

// API base URL - use env var for dev, empty for production (relative URLs)
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// --- API Types ---

interface Point2D {
  x: number;
  y: number;
}

interface PolygonWithHoles {
  outer: Point2D[];
  holes: Point2D[][];
}

interface LineSegment {
  start: Point2D;
  end: Point2D;
}

interface Polyline {
  points: Point2D[];
}

interface InfillMetadata {
  total_length_mm: number;
  num_segments: number;
  num_polylines: number;
  pattern_type: string;
  optimization_applied: boolean;
  travel_length_mm?: number;
  num_pen_lifts?: number;
}

interface InfillResponse {
  lines: LineSegment[];
  polylines: Polyline[];
  metadata: InfillMetadata;
}

interface PathOptimizationResponse {
  ordered_lines: LineSegment[];
  total_drawing_length_mm: number;
  total_travel_length_mm: number;
  num_pen_lifts: number;
  optimization_method: string;
}

interface PolylineOptimizationResponse {
  ordered_polylines: Polyline[];
  total_drawing_length_mm: number;
  total_travel_length_mm: number;
  num_pen_lifts: number;
  optimization_method: string;
}

// --- Configuration ---

/**
 * Enable/disable backend infill generation.
 * When disabled, falls back to frontend-only generation.
 */
export let USE_BACKEND_INFILL = true;

/**
 * Set whether to use backend infill generation.
 */
export function setUseBackendInfill(enabled: boolean): void {
  USE_BACKEND_INFILL = enabled;
  localStorage.setItem('useBackendInfill', String(enabled));
  console.log(`Backend infill ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Load backend infill preference from localStorage.
 */
export function loadBackendInfillPreference(): void {
  const stored = localStorage.getItem('useBackendInfill');
  if (stored !== null) {
    USE_BACKEND_INFILL = stored === 'true';
  }
}

// Initialize from localStorage on module load
loadBackendInfillPreference();

// --- Conversion Functions ---

/**
 * Convert THREE.Vector2 array to API polygon format.
 */
function vectorsToPolygon(vectors: THREE.Vector2[]): Point2D[] {
  return vectors.map(v => ({ x: v.x, y: v.y }));
}

/**
 * Convert API line segments to THREE.Line objects.
 */
function segmentsToThreeLines(
  segments: LineSegment[],
  color: number = 0x00ff00
): THREE.Line[] {
  const lines: THREE.Line[] = [];
  const material = new THREE.LineBasicMaterial({ color });

  for (const segment of segments) {
    const points = [
      new THREE.Vector3(segment.start.x, segment.start.y, 0),
      new THREE.Vector3(segment.end.x, segment.end.y, 0)
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    lines.push(line);
  }

  return lines;
}

/**
 * Convert API polylines to THREE.Line objects.
 */
function polylinesToThreeLines(
  polylines: Polyline[],
  color: number = 0x00ff00
): THREE.Line[] {
  const lines: THREE.Line[] = [];
  const material = new THREE.LineBasicMaterial({ color });

  for (const polyline of polylines) {
    // Convert polyline points to Vector3
    const points = polyline.points.map(
      pt => new THREE.Vector3(pt.x, pt.y, 0)
    );

    // Create a single continuous line from all points
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    lines.push(line);
  }

  return lines;
}

/**
 * Convert pattern type enum to API string.
 */
function patternTypeToString(patternType: InfillPatternType): string {
  // Handle enum values - they're stored as lowercase strings
  const typeStr = String(patternType).toLowerCase();

  // Map frontend patterns to backend patterns
  const mapping: Record<string, string> = {
    'lines': 'lines',
    'grid': 'grid',
    'concentric': 'concentric',
    'crosshatch': 'crosshatch',
    'honeycomb': 'grid', // Honeycomb uses frontend generation, falls back to grid for backend
  };

  return mapping[typeStr] || 'lines';
}

// --- API Functions ---

/**
 * Check if backend infill API is available.
 */
export async function checkBackendAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/infill/patterns`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Generate infill using the backend API.
 *
 * @param polygons Array of polygons with optional holes
 * @param options Infill options (pattern, density, angle, offset)
 * @param optimizePath Whether to apply TSP optimization
 * @param color Color for the generated lines
 * @returns Array of THREE.Line objects, or null if backend unavailable
 */
export async function generateInfillBackend(
  polygons: { outer: THREE.Vector2[]; holes: THREE.Vector2[][] }[],
  options: InfillOptions,
  optimizePath: boolean = false,
  color: number = 0x00ff00,
  timeoutSeconds: number = 300
): Promise<{ lines: THREE.Line[]; metadata: InfillMetadata } | null> {
  if (!USE_BACKEND_INFILL) {
    return null;
  }

  try {
    // Convert to API format
    const apiPolygons: PolygonWithHoles[] = polygons.map(p => ({
      outer: vectorsToPolygon(p.outer),
      holes: p.holes.map(hole => vectorsToPolygon(hole))
    }));

    const request = {
      polygons: apiPolygons,
      pattern: patternTypeToString(options.patternType),
      density: options.density,
      angle: options.angle,
      outline_offset: options.outlineOffset,
      optimize_path: optimizePath,
      timeout_seconds: timeoutSeconds,
    };

    const response = await fetch(`${API_BASE_URL}/api/infill/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(timeoutSeconds * 1000 + 5000), // Backend timeout + 5s buffer
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      console.error('Backend infill error:', error);
      return null;
    }

    const data: InfillResponse = await response.json();

    // Convert both line segments and polylines to THREE.Line objects
    const segmentLines = segmentsToThreeLines(data.lines, color);
    const polylineLines = polylinesToThreeLines(data.polylines || [], color);
    const lines = [...segmentLines, ...polylineLines];

    console.log(`Backend infill: ${data.lines.length} segments, ${data.polylines?.length || 0} polylines, ${data.metadata.total_length_mm}mm total`);
    if (data.metadata.optimization_applied) {
      console.log(`  Optimized: ${data.metadata.travel_length_mm}mm travel, ${data.metadata.num_pen_lifts} pen lifts`);
    }

    return { lines, metadata: data.metadata };

  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      console.warn('Backend infill timeout - polygon too complex?');
    } else {
      console.warn('Backend infill failed:', error);
    }
    return null;
  }
}

/**
 * Optimize path order for existing line segments or polylines.
 *
 * @param lines Array of THREE.Line objects to optimize
 * @param startPoint Optional starting position
 * @returns Optimized lines and statistics, or null if failed
 */
export async function optimizePathBackend(
  lines: THREE.Line[],
  startPoint?: THREE.Vector2,
  timeoutSeconds: number = 300
): Promise<{ lines: THREE.Line[]; stats: PathOptimizationResponse | PolylineOptimizationResponse } | null> {
  try {
    // Get color from first line
    const material = lines[0]?.material as THREE.LineBasicMaterial;
    const defaultColor = material?.color.getHex() || 0x00ff00;

    // Check if we have polylines (>2 points) or simple segments (2 points)
    const firstLinePositions = lines[0]?.geometry.getAttribute('position');
    const isPolylines = firstLinePositions && firstLinePositions.count > 2;

    if (isPolylines) {
      // Extract polylines from THREE.Line objects
      const polylines: Polyline[] = [];

      for (const line of lines) {
        const positions = line.geometry.getAttribute('position');
        if (positions && positions.count >= 2) {
          const points: Point2D[] = [];
          for (let i = 0; i < positions.count; i++) {
            points.push({ x: positions.getX(i), y: positions.getY(i) });
          }
          polylines.push({ points });
        }
      }

      if (polylines.length === 0) {
        return null;
      }

      const request: { polylines: Polyline[]; start_point?: Point2D; timeout_seconds: number } = {
        polylines,
        timeout_seconds: timeoutSeconds,
      };

      if (startPoint) {
        request.start_point = { x: startPoint.x, y: startPoint.y };
      }

      const response = await fetch(`${API_BASE_URL}/api/infill/optimize-polylines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(timeoutSeconds * 1000 + 5000),
      });

      if (!response.ok) {
        console.error('Polyline optimization error:', response.statusText);
        return null;
      }

      const data: PolylineOptimizationResponse = await response.json();

      // Convert back to THREE.Line objects
      const optimizedLines = polylinesToThreeLines(data.ordered_polylines, defaultColor);

      console.log(`Path optimized: ${data.total_travel_length_mm}mm travel, ${data.num_pen_lifts} pen lifts`);

      return { lines: optimizedLines, stats: data };

    } else {
      // Extract line segments from THREE.Line objects
      const segments: LineSegment[] = [];

      for (const line of lines) {
        const positions = line.geometry.getAttribute('position');
        if (positions && positions.count >= 2) {
          segments.push({
            start: { x: positions.getX(0), y: positions.getY(0) },
            end: { x: positions.getX(1), y: positions.getY(1) }
          });
        }
      }

      if (segments.length === 0) {
        return null;
      }

      const request: { lines: LineSegment[]; start_point?: Point2D; timeout_seconds: number } = {
        lines: segments,
        timeout_seconds: timeoutSeconds,
      };

      if (startPoint) {
        request.start_point = { x: startPoint.x, y: startPoint.y };
      }

      const response = await fetch(`${API_BASE_URL}/api/infill/optimize-path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(timeoutSeconds * 1000 + 5000),
      });

      if (!response.ok) {
        console.error('Path optimization error:', response.statusText);
        return null;
      }

      const data: PathOptimizationResponse = await response.json();

      // Convert back to THREE.Line objects
      const optimizedLines = segmentsToThreeLines(data.ordered_lines, defaultColor);

      console.log(`Path optimized: ${data.total_travel_length_mm}mm travel, ${data.num_pen_lifts} pen lifts`);

      return { lines: optimizedLines, stats: data };
    }

  } catch (error) {
    console.warn('Path optimization failed:', error);
    return null;
  }
}

/**
 * Get available infill patterns from backend.
 */
export async function getAvailablePatterns(): Promise<string[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/infill/patterns`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.patterns.map((p: { id: string }) => p.id);

  } catch {
    return [];
  }
}
