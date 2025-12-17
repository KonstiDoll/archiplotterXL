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

interface InfillMetadata {
  total_length_mm: number;
  num_segments: number;
  pattern_type: string;
  optimization_applied: boolean;
  travel_length_mm?: number;
  num_pen_lifts?: number;
}

interface InfillResponse {
  lines: LineSegment[];
  metadata: InfillMetadata;
}

interface PathOptimizationResponse {
  ordered_lines: LineSegment[];
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
  color: number = 0x00ff00
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
    };

    const response = await fetch(`${API_BASE_URL}/api/infill/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      console.error('Backend infill error:', error);
      return null;
    }

    const data: InfillResponse = await response.json();

    // Convert to THREE.Line objects
    const lines = segmentsToThreeLines(data.lines, color);

    console.log(`Backend infill: ${data.lines.length} lines, ${data.metadata.total_length_mm}mm total`);
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
 * Optimize path order for existing line segments.
 *
 * @param lines Array of THREE.Line objects to optimize
 * @param startPoint Optional starting position
 * @returns Optimized lines and statistics, or null if failed
 */
export async function optimizePathBackend(
  lines: THREE.Line[],
  startPoint?: THREE.Vector2
): Promise<{ lines: THREE.Line[]; stats: PathOptimizationResponse } | null> {
  try {
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

    const request: { lines: LineSegment[]; start_point?: Point2D } = {
      lines: segments,
    };

    if (startPoint) {
      request.start_point = { x: startPoint.x, y: startPoint.y };
    }

    const response = await fetch(`${API_BASE_URL}/api/infill/optimize-path`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(60000), // 60 second timeout for large infills
    });

    if (!response.ok) {
      console.error('Path optimization error:', response.statusText);
      return null;
    }

    const data: PathOptimizationResponse = await response.json();

    // Get colors from original lines
    const colors = lines.map(line => {
      const material = line.material as THREE.LineBasicMaterial;
      return material.color.getHex();
    });
    const defaultColor = colors[0] || 0x00ff00;

    // Convert back to THREE.Line objects
    const optimizedLines = segmentsToThreeLines(data.ordered_lines, defaultColor);

    console.log(`Path optimized: ${data.total_travel_length_mm}mm travel, ${data.num_pen_lifts} pen lifts`);

    return { lines: optimizedLines, stats: data };

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
