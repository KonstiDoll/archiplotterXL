<template>
  <div class="bg-slate-800 border-t border-slate-700 px-4 py-4">
    <!-- Timeline -->
    <div class="mb-4">
      <div class="flex items-center space-x-3">
        <!-- Current Time -->
        <span class="text-sm text-slate-400 font-mono w-16">
          {{ simulatorStore.currentTimeFormatted }}
        </span>

        <!-- Progress Bar -->
        <div
          class="flex-grow h-2 bg-slate-700 rounded-full cursor-pointer relative group"
          @click="onSeek"
          @mousedown="startDrag"
          ref="progressBar"
        >
          <!-- Progress Fill -->
          <div
            class="absolute inset-y-0 left-0 bg-blue-500 rounded-full transition-all duration-75"
            :style="{ width: `${simulatorStore.progress * 100}%` }"
          ></div>

          <!-- Hover indicator -->
          <div
            v-if="hoverTime !== null"
            class="absolute top-full mt-2 px-2 py-1 bg-slate-900 text-white text-xs rounded transform -translate-x-1/2 pointer-events-none"
            :style="{ left: `${hoverProgress * 100}%` }"
          >
            {{ formatTime(hoverTime) }}
          </div>

          <!-- Drag handle -->
          <div
            class="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
            :style="{ left: `calc(${simulatorStore.progress * 100}% - 8px)` }"
          ></div>
        </div>

        <!-- Total Time -->
        <span class="text-sm text-slate-400 font-mono w-16 text-right">
          {{ simulatorStore.totalDurationFormatted }}
        </span>
      </div>
    </div>

    <!-- Controls Row -->
    <div class="flex items-center justify-between">
      <!-- Left: Playback Controls -->
      <div class="flex items-center space-x-2">
        <!-- Skip Back -->
        <button
          @click="simulatorStore.skipBackward(5000)"
          class="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          title="5 Sekunden zurück (←)"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/>
          </svg>
        </button>

        <!-- Play/Pause -->
        <button
          @click="simulatorStore.togglePlayPause()"
          class="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors"
          :title="simulatorStore.isPlaying ? 'Pause (Leertaste)' : 'Play (Leertaste)'"
        >
          <!-- Play Icon -->
          <svg v-if="!simulatorStore.isPlaying" class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
          <!-- Pause Icon -->
          <svg v-else class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        </button>

        <!-- Skip Forward -->
        <button
          @click="simulatorStore.skipForward(5000)"
          class="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          title="5 Sekunden vorwärts (→)"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/>
          </svg>
        </button>
      </div>

      <!-- Center: Speed Controls -->
      <div class="flex items-center space-x-2">
        <span class="text-sm text-slate-400 mr-2">Geschwindigkeit:</span>
        <div class="flex bg-slate-700 rounded-lg p-0.5">
          <button
            v-for="speed in speeds"
            :key="speed"
            @click="simulatorStore.setSpeed(speed)"
            :class="[
              'px-3 py-1 text-sm rounded-md transition-colors',
              simulatorStore.playbackSpeed === speed
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-600'
            ]"
          >
            {{ speed }}x
          </button>
        </div>
      </div>

      <!-- Right: Display Options -->
      <div class="flex items-center space-x-4">
        <!-- Travel Paths Toggle -->
        <label class="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            :checked="simulatorStore.showTravelPaths"
            @change="simulatorStore.toggleTravelPaths()"
            class="w-4 h-4 rounded border-slate-500 bg-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
          />
          <span class="text-sm text-slate-300">Fahrwege</span>
        </label>

        <!-- Pump Indicators Toggle -->
        <label class="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            :checked="simulatorStore.showPumpIndicators"
            @change="simulatorStore.togglePumpIndicators()"
            class="w-4 h-4 rounded border-slate-500 bg-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
          />
          <span class="text-sm text-slate-300">Pumpen</span>
        </label>

        <!-- Reset Button -->
        <button
          @click="onReset"
          class="px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          title="Zurücksetzen (R)"
        >
          Zurücksetzen
        </button>

        <!-- Close Button -->
        <button
          @click="simulatorStore.close()"
          class="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          title="Schließen (Esc)"
        >
          Schließen
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useSimulatorStore } from '../stores/simulatorStore';
import { formatTime } from '../utils/gcode_parser';

const simulatorStore = useSimulatorStore();

// Speed presets
const speeds = [0.5, 1, 2, 5, 10];

// Progress bar ref
const progressBar = ref<HTMLElement | null>(null);

// Hover state for showing time tooltip
const hoverTime = ref<number | null>(null);
const hoverProgress = ref(0);

// Drag state
const isDragging = ref(false);

// Calculate progress from mouse position
function getProgressFromEvent(event: MouseEvent): number {
  if (!progressBar.value) return 0;

  const rect = progressBar.value.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const progress = Math.max(0, Math.min(1, x / rect.width));

  return progress;
}

// Seek to position
function onSeek(event: MouseEvent) {
  const progress = getProgressFromEvent(event);
  simulatorStore.seekToProgress(progress);
}

// Start dragging
function startDrag(_event: MouseEvent) {
  isDragging.value = true;

  const onMouseMove = (e: MouseEvent) => {
    if (isDragging.value) {
      const progress = getProgressFromEvent(e);
      simulatorStore.seekToProgress(progress);
    }
  };

  const onMouseUp = () => {
    isDragging.value = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

// Reset
function onReset() {
  simulatorStore.reset();
}
</script>
