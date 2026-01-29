/**
 * G-Code Simulator Types
 *
 * Types for parsing, rendering, and playing back G-Code in the simulator.
 */

// Instruction types that the simulator understands
export type InstructionType =
  | 'move'        // G1 linear move
  | 'pen_up'      // U-axis move to raise pen
  | 'pen_down'    // U-axis move to lower pen
  | 'tool_change' // M98 macro for grabbing/placing tools
  | 'pump'        // G91 + Z moves for ink pumping
  | 'set_mode'    // G90/G91 absolute/relative mode
  | 'comment'     // Comment line
  | 'unknown';    // Unparsed command

// A single parsed G-Code instruction
export interface GCodeInstruction {
  type: InstructionType;
  lineNumber: number;           // Original line number in G-Code
  rawLine: string;              // Original G-Code line

  // Movement data (for 'move' type)
  x?: number;                   // Target X position (machine coords)
  y?: number;                   // Target Y position (machine coords)
  z?: number;                   // Target Z position
  u?: number;                   // U-axis (pen) position
  feedrate?: number;            // Movement speed (mm/min)

  // Derived data
  isTravel?: boolean;           // True if pen is up during this move
  isMacroMove?: boolean;        // True if this move was expanded from a macro

  // Tool change data
  toolNumber?: number;          // Tool number (1-9)
  isGrab?: boolean;             // True for grab, false for place

  // Pump data
  pumpHeight?: number;          // Z travel for pump action

  // Timing
  estimatedDuration: number;    // Estimated time for this instruction (ms)
  cumulativeTime: number;       // Cumulative time from start (ms)

  // Position tracking (filled during parsing)
  startPosition?: { x: number; y: number };
  endPosition?: { x: number; y: number };
}

// Parsed G-Code with metadata
export interface ParsedGCode {
  instructions: GCodeInstruction[];
  totalDuration: number;        // Total estimated duration (ms)
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  toolChanges: number[];        // List of tool numbers used
  statistics: {
    totalMoves: number;
    drawingMoves: number;
    travelMoves: number;
    totalDrawingLength: number; // mm
    totalTravelLength: number;  // mm
    pumpCount: number;
  };
}

// Machine state during simulation
export interface MachineState {
  position: { x: number; y: number; z: number; u: number };
  isPenDown: boolean;
  currentTool: number | null;
  absoluteMode: boolean;        // G90=true, G91=false
  feedrate: number;
}

// Simulator playback state
export interface SimulatorState {
  // Parsed data
  instructions: GCodeInstruction[];
  parsedGCode: ParsedGCode | null;

  // Playback control
  isPlaying: boolean;
  currentTime: number;          // Current playback time (ms)
  playbackSpeed: number;        // Multiplier (0.5, 1, 2, 10, etc.)

  // Machine state
  machineState: MachineState;

  // Display options
  showTravelPaths: boolean;
  showPumpIndicators: boolean;

  // Current instruction tracking
  currentInstructionIndex: number;
}

// Tool configuration for rendering
export interface SimulatorToolConfig {
  toolNumber: number;
  penType: string;
  color: string;
  lineWidth: number;            // Stroke width in mm
}

// Pen type to line width mapping (in mm)
export const PEN_LINE_WIDTHS: Record<string, number> = {
  'stabilo': 0.4,
  'fineliner': 0.3,
  'posca': 1.0,
  'marker': 2.0,
  'brushpen': 1.5,
};

// Default simulator state
export function createDefaultSimulatorState(): SimulatorState {
  return {
    instructions: [],
    parsedGCode: null,
    isPlaying: false,
    currentTime: 0,
    playbackSpeed: 1,
    machineState: {
      position: { x: 0, y: 0, z: 0, u: 33 },
      isPenDown: false,
      currentTool: null,
      absoluteMode: true,
      feedrate: 3000,
    },
    showTravelPaths: true,
    showPumpIndicators: true,
    currentInstructionIndex: 0,
  };
}

// Default machine state
export function createDefaultMachineState(): MachineState {
  return {
    position: { x: 0, y: 0, z: 0, u: 33 },
    isPenDown: false,
    currentTool: null,
    absoluteMode: true,
    feedrate: 3000,
  };
}

/**
 * Convert machine coordinates to canvas coordinates
 * Machine: X vertical (up), Y horizontal (right)
 * Canvas: X horizontal (right), Y vertical (up)
 */
export function machineToCanvas(machineX: number, machineY: number): { x: number; y: number } {
  return {
    x: machineY,  // Machine Y → Canvas X
    y: machineX,  // Machine X → Canvas Y
  };
}
