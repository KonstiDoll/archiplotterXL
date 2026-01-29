/**
 * Simulator Store (Pinia)
 *
 * Manages the state for the G-Code simulator, including:
 * - Parsed G-Code instructions
 * - Playback state (playing, paused, current time)
 * - Machine state (position, tool, pen state)
 * - Display options
 */

import { defineStore } from 'pinia';
import type {
  GCodeInstruction,
  ParsedGCode,
  MachineState,
  SimulatorToolConfig,
} from '../types/simulator';
import {
  createDefaultMachineState,
  PEN_LINE_WIDTHS,
} from '../types/simulator';
import {
  parseGCode,
  findInstructionAtTime,
  formatTime,
} from '../utils/gcode_parser';
import type { ToolConfig } from '../utils/gcode_services';

export interface SimulatorStoreState {
  // G-Code data
  rawGCode: string;
  parsedGCode: ParsedGCode | null;

  // Playback state
  isPlaying: boolean;
  currentTime: number;          // ms
  playbackSpeed: number;        // 0.5, 1, 2, 5, 10

  // Machine state
  machineState: MachineState;

  // Tool configurations (from main app)
  toolConfigs: ToolConfig[];

  // Display options
  showTravelPaths: boolean;
  showPumpIndicators: boolean;

  // UI state
  isOpen: boolean;
}

export const useSimulatorStore = defineStore('simulator', {
  state: (): SimulatorStoreState => ({
    rawGCode: '',
    parsedGCode: null,
    isPlaying: false,
    currentTime: 0,
    playbackSpeed: 1,
    machineState: createDefaultMachineState(),
    toolConfigs: [],
    showTravelPaths: true,
    showPumpIndicators: true,
    isOpen: false,
  }),

  getters: {
    /**
     * Get all instructions
     */
    instructions(state): GCodeInstruction[] {
      return state.parsedGCode?.instructions ?? [];
    },

    /**
     * Get total duration in milliseconds
     */
    totalDuration(state): number {
      return state.parsedGCode?.totalDuration ?? 0;
    },

    /**
     * Get formatted current time
     */
    currentTimeFormatted(state): string {
      return formatTime(state.currentTime);
    },

    /**
     * Get formatted total duration
     */
    totalDurationFormatted(state): string {
      return formatTime(state.parsedGCode?.totalDuration ?? 0);
    },

    /**
     * Get playback progress (0-1)
     */
    progress(state): number {
      const total = state.parsedGCode?.totalDuration ?? 0;
      if (total === 0) return 0;
      return Math.min(state.currentTime / total, 1);
    },

    /**
     * Get current instruction info
     */
    currentInstruction(state): { instruction: GCodeInstruction; index: number; progress: number } | null {
      if (!state.parsedGCode) return null;
      return findInstructionAtTime(state.parsedGCode.instructions, state.currentTime);
    },

    /**
     * Get current tool configuration
     */
    currentToolConfig(state): SimulatorToolConfig | null {
      const toolNum = state.machineState.currentTool;
      if (toolNum === null || toolNum < 1 || toolNum > state.toolConfigs.length) {
        return null;
      }

      const config = state.toolConfigs[toolNum - 1];
      return {
        toolNumber: toolNum,
        penType: config.penType,
        color: config.color,
        lineWidth: PEN_LINE_WIDTHS[config.penType] ?? 0.4,
      };
    },

    /**
     * Get statistics
     */
    statistics(state) {
      return state.parsedGCode?.statistics ?? {
        totalMoves: 0,
        drawingMoves: 0,
        travelMoves: 0,
        totalDrawingLength: 0,
        totalTravelLength: 0,
        pumpCount: 0,
      };
    },

    /**
     * Get tools used
     */
    toolsUsed(state): number[] {
      return state.parsedGCode?.toolChanges ?? [];
    },

    /**
     * Check if simulation is complete
     */
    isComplete(state): boolean {
      const total = state.parsedGCode?.totalDuration ?? 0;
      return state.currentTime >= total;
    },
  },

  actions: {
    /**
     * Open the simulator with G-Code
     */
    open(gcode: string, toolConfigs: ToolConfig[]) {
      this.rawGCode = gcode;
      this.toolConfigs = [...toolConfigs];
      this.parsedGCode = parseGCode(gcode);
      this.isOpen = true;
      this.reset();

      console.log('Simulator opened:', {
        instructions: this.parsedGCode.instructions.length,
        duration: formatTime(this.parsedGCode.totalDuration),
        tools: this.parsedGCode.toolChanges,
        stats: this.parsedGCode.statistics,
      });
    },

    /**
     * Close the simulator
     */
    close() {
      this.isOpen = false;
      this.pause();
      this.rawGCode = '';
      this.parsedGCode = null;
      this.currentTime = 0;
    },

    /**
     * Start playback
     */
    play() {
      if (!this.parsedGCode) return;

      // If at the end, restart
      if (this.currentTime >= this.parsedGCode.totalDuration) {
        this.currentTime = 0;
      }

      this.isPlaying = true;
    },

    /**
     * Pause playback
     */
    pause() {
      this.isPlaying = false;
    },

    /**
     * Toggle play/pause
     */
    togglePlayPause() {
      if (this.isPlaying) {
        this.pause();
      } else {
        this.play();
      }
    },

    /**
     * Reset to beginning
     */
    reset() {
      this.currentTime = 0;
      this.isPlaying = false;
      this.machineState = createDefaultMachineState();
    },

    /**
     * Seek to a specific time
     */
    seekTo(time: number) {
      const total = this.parsedGCode?.totalDuration ?? 0;
      this.currentTime = Math.max(0, Math.min(time, total));
    },

    /**
     * Seek to a specific progress (0-1)
     */
    seekToProgress(progress: number) {
      const total = this.parsedGCode?.totalDuration ?? 0;
      this.seekTo(progress * total);
    },

    /**
     * Skip forward by a specified amount of time
     */
    skipForward(ms: number = 5000) {
      this.seekTo(this.currentTime + ms);
    },

    /**
     * Skip backward by a specified amount of time
     */
    skipBackward(ms: number = 5000) {
      this.seekTo(this.currentTime - ms);
    },

    /**
     * Jump to the next instruction
     */
    nextInstruction() {
      if (!this.parsedGCode) return;

      const current = findInstructionAtTime(this.parsedGCode.instructions, this.currentTime);
      if (current && current.index < this.parsedGCode.instructions.length - 1) {
        const nextInstr = this.parsedGCode.instructions[current.index + 1];
        this.seekTo(nextInstr.cumulativeTime);
      }
    },

    /**
     * Jump to the previous instruction
     */
    previousInstruction() {
      if (!this.parsedGCode) return;

      const current = findInstructionAtTime(this.parsedGCode.instructions, this.currentTime);
      if (current && current.index > 0) {
        const prevInstr = this.parsedGCode.instructions[current.index - 1];
        this.seekTo(prevInstr.cumulativeTime);
      }
    },

    /**
     * Set playback speed
     */
    setSpeed(speed: number) {
      this.playbackSpeed = speed;
    },

    /**
     * Update current time (called from animation loop)
     */
    updateTime(deltaMs: number) {
      if (!this.isPlaying || !this.parsedGCode) return;

      const newTime = this.currentTime + deltaMs * this.playbackSpeed;
      const total = this.parsedGCode.totalDuration;

      if (newTime >= total) {
        this.currentTime = total;
        this.isPlaying = false;
      } else {
        this.currentTime = newTime;
      }
    },

    /**
     * Update machine state to match current time
     */
    updateMachineState() {
      if (!this.parsedGCode) return;

      // Reset machine state
      const state = createDefaultMachineState();

      // Process all instructions up to current time
      for (const instruction of this.parsedGCode.instructions) {
        if (instruction.cumulativeTime > this.currentTime) break;

        // Update based on instruction type
        switch (instruction.type) {
          case 'move':
            if (instruction.endPosition) {
              state.position.x = instruction.endPosition.x;
              state.position.y = instruction.endPosition.y;
            }
            if (instruction.feedrate) {
              state.feedrate = instruction.feedrate;
            }
            break;

          case 'pen_up':
            state.isPenDown = false;
            if (instruction.u !== undefined) {
              state.position.u = instruction.u;
            }
            break;

          case 'pen_down':
            state.isPenDown = true;
            if (instruction.u !== undefined) {
              state.position.u = instruction.u;
            }
            break;

          case 'tool_change':
            if (instruction.isGrab && instruction.toolNumber !== undefined) {
              state.currentTool = instruction.toolNumber;
            } else if (!instruction.isGrab) {
              state.currentTool = null;
            }
            break;

          case 'set_mode':
            state.absoluteMode = instruction.rawLine.includes('G90');
            break;
        }
      }

      this.machineState = state;
    },

    /**
     * Toggle travel path visibility
     */
    toggleTravelPaths() {
      this.showTravelPaths = !this.showTravelPaths;
    },

    /**
     * Toggle pump indicator visibility
     */
    togglePumpIndicators() {
      this.showPumpIndicators = !this.showPumpIndicators;
    },
  },
});
