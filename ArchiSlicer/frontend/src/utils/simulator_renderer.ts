/**
 * Simulator Renderer
 *
 * Renders G-Code execution to a 2D canvas, which is then used as a
 * Three.js CanvasTexture for display in the 3D scene.
 *
 * This approach allows variable stroke widths (which WebGL lines don't support)
 * while maintaining the ability to display the result in a Three.js scene.
 */

import * as THREE from 'three';
import type { SimulatorToolConfig } from '../types/simulator';
import { PEN_LINE_WIDTHS, machineToCanvas } from '../types/simulator';

// Canvas dimensions (matching the workpiece area in mm)
// We use a scale factor to convert mm to pixels for good resolution
const CANVAS_SCALE = 4; // 4 pixels per mm (higher = sharper)
const WORKPIECE_WIDTH = 1864;  // mm (Machine Y range)
const WORKPIECE_HEIGHT = 1210; // mm (Machine X range)

export class SimulatorRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;

  // Current tool configuration
  private currentTool: SimulatorToolConfig | null = null;

  // Pump indicator animations
  private pumpIndicators: Array<{
    x: number;
    y: number;
    startTime: number;
    duration: number;
  }> = [];

  constructor() {
    // Create offscreen canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = WORKPIECE_WIDTH * CANVAS_SCALE;
    this.canvas.height = WORKPIECE_HEIGHT * CANVAS_SCALE;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    this.ctx = ctx;

    // Create Three.js texture BEFORE clear() which calls updateTexture()
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    // Initialize with white background
    this.clear();
  }

  /**
   * Clear the canvas to white
   */
  clear(): void {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.pumpIndicators = [];
    this.updateTexture();
  }

  /**
   * Set the current tool for drawing
   */
  setTool(tool: SimulatorToolConfig): void {
    this.currentTool = tool;
  }

  /**
   * Draw a line segment from one position to another
   *
   * @param fromMachine Start position in machine coordinates
   * @param toMachine End position in machine coordinates
   * @param color Optional color override (uses tool color if not specified)
   * @param lineWidth Optional line width override in mm (uses pen type default if not specified)
   */
  drawSegment(
    fromMachine: { x: number; y: number },
    toMachine: { x: number; y: number },
    color?: string,
    lineWidth?: number
  ): void {
    // Convert to canvas coordinates
    const from = machineToCanvas(fromMachine.x, fromMachine.y);
    const to = machineToCanvas(toMachine.x, toMachine.y);

    // Scale to pixel coordinates
    const fromX = from.x * CANVAS_SCALE;
    const fromY = (WORKPIECE_HEIGHT - from.y) * CANVAS_SCALE; // Flip Y for canvas
    const toX = to.x * CANVAS_SCALE;
    const toY = (WORKPIECE_HEIGHT - to.y) * CANVAS_SCALE;

    // Determine stroke style
    const strokeColor = color ?? this.currentTool?.color ?? '#000000';

    // Determine line width
    let strokeWidth: number;
    if (lineWidth !== undefined) {
      strokeWidth = lineWidth * CANVAS_SCALE;
    } else if (this.currentTool) {
      const penWidth = PEN_LINE_WIDTHS[this.currentTool.penType] ?? 0.4;
      strokeWidth = penWidth * CANVAS_SCALE;
    } else {
      strokeWidth = 0.4 * CANVAS_SCALE;
    }

    // Draw the line
    this.ctx.beginPath();
    this.ctx.moveTo(fromX, fromY);
    this.ctx.lineTo(toX, toY);
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = strokeWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.stroke();

    this.updateTexture();
  }

  /**
   * Draw a travel path (pen-up movement) as a dashed, semi-transparent line
   */
  drawTravelPath(
    fromMachine: { x: number; y: number },
    toMachine: { x: number; y: number }
  ): void {
    // Convert to canvas coordinates
    const from = machineToCanvas(fromMachine.x, fromMachine.y);
    const to = machineToCanvas(toMachine.x, toMachine.y);

    // Scale to pixel coordinates
    const fromX = from.x * CANVAS_SCALE;
    const fromY = (WORKPIECE_HEIGHT - from.y) * CANVAS_SCALE;
    const toX = to.x * CANVAS_SCALE;
    const toY = (WORKPIECE_HEIGHT - to.y) * CANVAS_SCALE;

    // Draw dashed gray line for travel paths
    this.ctx.beginPath();
    this.ctx.moveTo(fromX, fromY);
    this.ctx.lineTo(toX, toY);
    this.ctx.strokeStyle = 'rgba(128, 128, 128, 0.5)';
    this.ctx.lineWidth = 0.5 * CANVAS_SCALE;
    this.ctx.setLineDash([5 * CANVAS_SCALE, 5 * CANVAS_SCALE]);
    this.ctx.stroke();
    this.ctx.setLineDash([]); // Reset to solid

    this.updateTexture();
  }

  /**
   * Show a pump indicator at the specified position
   */
  showPumpIndicator(positionMachine: { x: number; y: number }): void {
    const pos = machineToCanvas(positionMachine.x, positionMachine.y);

    this.pumpIndicators.push({
      x: pos.x,
      y: pos.y,
      startTime: Date.now(),
      duration: 500, // Show for 500ms
    });
  }

  /**
   * Draw all active pump indicators
   */
  drawPumpIndicators(): void {
    const now = Date.now();

    // Filter out expired indicators
    this.pumpIndicators = this.pumpIndicators.filter(
      (indicator) => now - indicator.startTime < indicator.duration
    );

    // Draw remaining indicators
    for (const indicator of this.pumpIndicators) {
      const elapsed = now - indicator.startTime;
      const progress = elapsed / indicator.duration;

      // Fade out and expand
      const radius = (10 + progress * 20) * CANVAS_SCALE;
      const alpha = 1 - progress;

      const x = indicator.x * CANVAS_SCALE;
      const y = (WORKPIECE_HEIGHT - indicator.y) * CANVAS_SCALE;

      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(0, 150, 255, ${alpha})`;
      this.ctx.lineWidth = 3 * CANVAS_SCALE;
      this.ctx.stroke();

      // Inner circle
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius * 0.5, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(0, 150, 255, ${alpha * 0.3})`;
      this.ctx.fill();
    }

    if (this.pumpIndicators.length > 0) {
      this.updateTexture();
    }
  }

  /**
   * Draw the current pen position indicator
   */
  drawPenPosition(
    positionMachine: { x: number; y: number },
    isPenDown: boolean
  ): void {
    const pos = machineToCanvas(positionMachine.x, positionMachine.y);

    const x = pos.x * CANVAS_SCALE;
    const y = (WORKPIECE_HEIGHT - pos.y) * CANVAS_SCALE;

    // Draw crosshair
    const size = 15 * CANVAS_SCALE;
    const color = isPenDown ? '#00aa00' : '#ff0000';

    this.ctx.beginPath();
    this.ctx.moveTo(x - size, y);
    this.ctx.lineTo(x + size, y);
    this.ctx.moveTo(x, y - size);
    this.ctx.lineTo(x, y + size);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Draw circle
    this.ctx.beginPath();
    this.ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    this.updateTexture();
  }

  /**
   * Get the Three.js texture
   */
  getTexture(): THREE.CanvasTexture {
    return this.texture;
  }

  /**
   * Get canvas dimensions in mm
   */
  getDimensions(): { width: number; height: number } {
    return {
      width: WORKPIECE_WIDTH,
      height: WORKPIECE_HEIGHT,
    };
  }

  /**
   * Update the texture to reflect canvas changes
   */
  private updateTexture(): void {
    this.texture.needsUpdate = true;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.texture.dispose();
  }
}

/**
 * Create a Three.js plane mesh with the simulator texture
 */
export function createSimulatorPlane(renderer: SimulatorRenderer): THREE.Mesh {
  const dims = renderer.getDimensions();

  // Create plane geometry matching workpiece dimensions
  const geometry = new THREE.PlaneGeometry(dims.width, dims.height);

  // Create material with the canvas texture
  const material = new THREE.MeshBasicMaterial({
    map: renderer.getTexture(),
    side: THREE.DoubleSide,
    transparent: false,
  });

  const mesh = new THREE.Mesh(geometry, material);

  // Position the plane at the center of the workpiece area
  mesh.position.set(dims.width / 2, dims.height / 2, 0.1);

  return mesh;
}
