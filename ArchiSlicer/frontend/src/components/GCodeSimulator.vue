<template>
  <div class="fixed inset-0 z-50 bg-slate-900 flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
      <div class="flex items-center space-x-4">
        <h2 class="text-lg font-semibold text-white">G-Code Simulator</h2>
        <div class="text-sm text-slate-400">
          {{ simulatorStore.statistics.drawingMoves }} Zeichenbewegungen |
          {{ simulatorStore.statistics.totalDrawingLength }}mm Zeichenlänge |
          {{ simulatorStore.statistics.pumpCount }} Pumps
        </div>
      </div>
      <button
        @click="close"
        class="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
        title="Schließen (Esc)"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Main Content -->
    <div class="flex-grow relative overflow-hidden">
      <!-- Three.js Canvas Container -->
      <div ref="canvasContainer" class="absolute inset-0"></div>

      <!-- Tool Info Overlay -->
      <div class="absolute top-4 left-4 bg-slate-800/90 backdrop-blur rounded-lg px-4 py-3 text-white">
        <div class="text-sm font-medium mb-1">
          Tool: {{ currentToolDisplay }}
        </div>
        <div class="text-xs text-slate-400">
          Position: X={{ machinePosition.x.toFixed(1) }} Y={{ machinePosition.y.toFixed(1) }}
        </div>
        <div class="text-xs text-slate-400">
          Status: {{ simulatorStore.machineState.isPenDown ? 'Zeichnet' : 'Fährt' }}
        </div>
      </div>

      <!-- Statistics Overlay -->
      <div class="absolute top-4 right-4 bg-slate-800/90 backdrop-blur rounded-lg px-4 py-3 text-white text-sm">
        <div class="grid grid-cols-2 gap-x-4 gap-y-1">
          <span class="text-slate-400">Zeichenlänge:</span>
          <span>{{ simulatorStore.statistics.totalDrawingLength }}mm</span>
          <span class="text-slate-400">Fahrweg:</span>
          <span>{{ simulatorStore.statistics.totalTravelLength }}mm</span>
          <span class="text-slate-400">Werkzeuge:</span>
          <span>{{ simulatorStore.toolsUsed.join(', ') || '-' }}</span>
        </div>
      </div>
    </div>

    <!-- Controls -->
    <SimulatorControls />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useSimulatorStore } from '../stores/simulatorStore';
import { SimulatorRenderer, createSimulatorPlane } from '../utils/simulator_renderer';
import { findInstructionAtTime, lerp } from '../utils/gcode_parser';
import SimulatorControls from './SimulatorControls.vue';

const simulatorStore = useSimulatorStore();

// Refs
const canvasContainer = ref<HTMLElement | null>(null);

// Three.js objects
let scene: THREE.Scene;
let camera: THREE.OrthographicCamera;
let threeRenderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let simulatorRenderer: SimulatorRenderer;
let simulatorPlane: THREE.Mesh;
let animationFrameId: number | null = null;

// Animation state
let lastTimestamp = 0;
let lastRenderedTime = -1;

// Computed
const machinePosition = computed(() => simulatorStore.machineState.position);

const currentToolDisplay = computed(() => {
  const tool = simulatorStore.currentToolConfig;
  if (!tool) return 'Kein Tool';
  return `#${tool.toolNumber} (${tool.penType}, ${tool.color})`;
});

// Methods
function close() {
  simulatorStore.close();
}

function initThree() {
  if (!canvasContainer.value) return;

  const container = canvasContainer.value;
  const width = container.clientWidth;
  const height = container.clientHeight;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1e293b); // slate-800

  // Camera (orthographic for 2D view)
  const aspect = width / height;
  const viewHeight = 1400; // Show full workpiece height plus margin
  const viewWidth = viewHeight * aspect;

  camera = new THREE.OrthographicCamera(
    -viewWidth / 2,
    viewWidth / 2,
    viewHeight / 2,
    -viewHeight / 2,
    0.1,
    2000
  );
  camera.position.set(932, 605, 500); // Center of workpiece
  camera.lookAt(932, 605, 0);

  // Renderer
  threeRenderer = new THREE.WebGLRenderer({ antialias: true });
  threeRenderer.setSize(width, height);
  threeRenderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(threeRenderer.domElement);

  // Controls
  controls = new OrbitControls(camera, threeRenderer.domElement);
  controls.enableRotate = false; // 2D only
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.minZoom = 0.1;
  controls.maxZoom = 10;

  // Simulator renderer (2D canvas)
  simulatorRenderer = new SimulatorRenderer();

  // Create simulator plane
  simulatorPlane = createSimulatorPlane(simulatorRenderer);
  scene.add(simulatorPlane);

  // Add workpiece outline
  const outlineGeometry = new THREE.BufferGeometry();
  const outlineVertices = new Float32Array([
    0, 0, 0.05,
    1864, 0, 0.05,
    1864, 1210, 0.05,
    0, 1210, 0.05,
    0, 0, 0.05,
  ]);
  outlineGeometry.setAttribute('position', new THREE.BufferAttribute(outlineVertices, 3));
  const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x64748b });
  const outline = new THREE.Line(outlineGeometry, outlineMaterial);
  scene.add(outline);

  // Grid helper
  const gridHelper = new THREE.GridHelper(2000, 40, 0x334155, 0x1e293b);
  gridHelper.rotation.x = Math.PI / 2;
  gridHelper.position.set(932, 605, -0.1);
  scene.add(gridHelper);

  // Handle window resize
  window.addEventListener('resize', onResize);

  // Handle keyboard shortcuts
  window.addEventListener('keydown', onKeyDown);
}

function onResize() {
  if (!canvasContainer.value || !camera || !threeRenderer) return;

  const width = canvasContainer.value.clientWidth;
  const height = canvasContainer.value.clientHeight;
  const aspect = width / height;
  const viewHeight = 1400;
  const viewWidth = viewHeight * aspect;

  camera.left = -viewWidth / 2;
  camera.right = viewWidth / 2;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;
  camera.updateProjectionMatrix();

  threeRenderer.setSize(width, height);
}

function onKeyDown(event: KeyboardEvent) {
  switch (event.key) {
    case 'Escape':
      close();
      break;
    case ' ':
      event.preventDefault();
      simulatorStore.togglePlayPause();
      break;
    case 'ArrowLeft':
      simulatorStore.skipBackward(5000);
      break;
    case 'ArrowRight':
      simulatorStore.skipForward(5000);
      break;
    case 'r':
    case 'R':
      simulatorStore.reset();
      renderFullSimulation();
      break;
  }
}

function animate(timestamp: number) {
  animationFrameId = requestAnimationFrame(animate);

  // Calculate delta time
  const deltaMs = lastTimestamp ? timestamp - lastTimestamp : 0;
  lastTimestamp = timestamp;

  // Update playback time if playing
  if (simulatorStore.isPlaying) {
    simulatorStore.updateTime(deltaMs);
  }

  // Update machine state
  simulatorStore.updateMachineState();

  // Render if time changed
  if (simulatorStore.currentTime !== lastRenderedTime) {
    renderSimulation();
    lastRenderedTime = simulatorStore.currentTime;
  }

  // Draw pump indicators (animated)
  if (simulatorStore.showPumpIndicators) {
    simulatorRenderer.drawPumpIndicators();
  }

  // Update controls
  controls.update();

  // Render Three.js scene
  threeRenderer.render(scene, camera);
}

function renderSimulation() {
  const parsed = simulatorStore.parsedGCode;
  if (!parsed) return;

  // Clear canvas
  simulatorRenderer.clear();

  // Track machine state for rendering
  let currentTool: number | null = null;
  let isPenDown = false;

  // Process all instructions up to current time
  for (const instruction of parsed.instructions) {
    // Stop if we've passed current time
    if (instruction.cumulativeTime > simulatorStore.currentTime) {
      // Handle partial progress on current instruction
      const current = findInstructionAtTime(parsed.instructions, simulatorStore.currentTime);
      if (current && current.instruction.type === 'move' && current.instruction.startPosition && current.instruction.endPosition) {
        const pos = lerp(current.instruction.startPosition, current.instruction.endPosition, current.progress);

        if (isPenDown && !current.instruction.isTravel) {
          // Get tool config for drawing
          if (currentTool !== null) {
            const toolConfig = simulatorStore.toolConfigs[currentTool - 1];
            if (toolConfig) {
              simulatorRenderer.setTool({
                toolNumber: currentTool,
                penType: toolConfig.penType,
                color: toolConfig.color,
                lineWidth: 0.4,
              });
            }
          }
          simulatorRenderer.drawSegment(current.instruction.startPosition, pos);
        } else if (simulatorStore.showTravelPaths && current.instruction.isTravel) {
          simulatorRenderer.drawTravelPath(current.instruction.startPosition, pos);
        }
      }
      break;
    }

    // Process completed instructions
    switch (instruction.type) {
      case 'tool_change':
        if (instruction.isGrab && instruction.toolNumber !== undefined) {
          currentTool = instruction.toolNumber;
          const toolConfig = simulatorStore.toolConfigs[currentTool - 1];
          if (toolConfig) {
            simulatorRenderer.setTool({
              toolNumber: currentTool,
              penType: toolConfig.penType,
              color: toolConfig.color,
              lineWidth: 0.4,
            });
          }
        } else if (!instruction.isGrab) {
          currentTool = null;
        }
        break;

      case 'pen_up':
        isPenDown = false;
        break;

      case 'pen_down':
        isPenDown = true;
        break;

      case 'move':
        if (instruction.startPosition && instruction.endPosition) {
          if (isPenDown && !instruction.isTravel) {
            simulatorRenderer.drawSegment(instruction.startPosition, instruction.endPosition);
          } else if (simulatorStore.showTravelPaths && instruction.isTravel) {
            simulatorRenderer.drawTravelPath(instruction.startPosition, instruction.endPosition);
          }
        }
        break;

      case 'pump':
        if (simulatorStore.showPumpIndicators && instruction.startPosition) {
          simulatorRenderer.showPumpIndicator(instruction.startPosition);
        }
        break;
    }
  }

  // Draw current pen position
  const machinePos = simulatorStore.machineState.position;
  simulatorRenderer.drawPenPosition(
    { x: machinePos.x, y: machinePos.y },
    simulatorStore.machineState.isPenDown
  );
}

function renderFullSimulation() {
  // Reset and render from beginning to current time
  lastRenderedTime = -1;
  renderSimulation();
}

function cleanup() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  window.removeEventListener('resize', onResize);
  window.removeEventListener('keydown', onKeyDown);

  if (threeRenderer) {
    threeRenderer.dispose();
    if (canvasContainer.value && threeRenderer.domElement.parentElement === canvasContainer.value) {
      canvasContainer.value.removeChild(threeRenderer.domElement);
    }
  }

  if (simulatorRenderer) {
    simulatorRenderer.dispose();
  }

  if (controls) {
    controls.dispose();
  }
}

// Lifecycle
onMounted(() => {
  initThree();
  animationFrameId = requestAnimationFrame(animate);
});

onUnmounted(() => {
  cleanup();
});

// Watch for time changes that require full re-render (e.g., seeking backwards)
watch(
  () => simulatorStore.currentTime,
  (newTime, oldTime) => {
    if (newTime < oldTime) {
      // Seeking backwards - need full re-render
      renderFullSimulation();
    }
  }
);
</script>
