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

      <!-- Warnings Panel -->
      <div
        v-if="simulatorStore.warnings.length > 0"
        class="absolute bottom-20 right-4 max-w-md max-h-48 overflow-y-auto bg-slate-800/95 backdrop-blur rounded-lg px-4 py-3 text-sm border"
        :class="hasErrors ? 'border-red-500' : 'border-yellow-500'"
      >
        <div class="flex items-center gap-2 mb-2">
          <svg v-if="hasErrors" class="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
          <svg v-else class="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          <span class="font-medium" :class="hasErrors ? 'text-red-400' : 'text-yellow-400'">
            {{ errorCount }} Fehler, {{ warningCount }} Warnungen
          </span>
        </div>
        <div class="space-y-1">
          <div
            v-for="(warning, index) in simulatorStore.warnings"
            :key="index"
            class="text-xs"
            :class="warning.type === 'error' ? 'text-red-300' : 'text-yellow-300'"
          >
            <span class="text-slate-500">Zeile {{ warning.lineNumber }}:</span>
            {{ warning.message }}
            <span v-if="warning.details" class="text-slate-400 block pl-4">{{ warning.details }}</span>
          </div>
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
import { penTypes } from '../utils/gcode_services';
import SimulatorControls from './SimulatorControls.vue';

// Helper to get pen width from pen type
function getPenWidth(penTypeId: string): number {
  return penTypes[penTypeId]?.width ?? 0.4;
}

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
let penMesh: THREE.Group;
let penBodyMesh: THREE.Mesh;
let penTipMesh: THREE.Mesh;
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

const errorCount = computed(() =>
  simulatorStore.warnings.filter(w => w.type === 'error').length
);

const warningCount = computed(() =>
  simulatorStore.warnings.filter(w => w.type === 'warning').length
);

const hasErrors = computed(() => errorCount.value > 0);

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
    5000
  );
  // Position camera directly above the workpiece center, looking down
  camera.position.set(932, 605, 1000);
  camera.up.set(0, 1, 0); // Y is up

  // Renderer
  threeRenderer = new THREE.WebGLRenderer({ antialias: true });
  threeRenderer.setSize(width, height);
  threeRenderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(threeRenderer.domElement);

  // Controls
  controls = new OrbitControls(camera, threeRenderer.domElement);
  controls.target.set(932, 605, 0); // Look at center of workpiece
  controls.enableRotate = true; // Allow rotation/tilting
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.minZoom = 0.1;
  controls.maxZoom = 10;
  controls.update();

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

  // Create 3D pen visualizer (thin like pen tip)
  penMesh = new THREE.Group();

  // Pen body (thin cylinder)
  const bodyGeometry = new THREE.CylinderGeometry(2, 2, 40, 12);
  const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x404040 });
  penBodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
  penBodyMesh.position.z = 25; // Offset up from tip
  penBodyMesh.rotation.x = Math.PI / 2; // Point down
  penMesh.add(penBodyMesh);

  // Pen tip (thin cone)
  const tipGeometry = new THREE.ConeGeometry(1.5, 8, 12);
  const tipMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
  penTipMesh = new THREE.Mesh(tipGeometry, tipMaterial);
  penTipMesh.position.z = 2;
  penTipMesh.rotation.x = -Math.PI / 2; // Point down
  penMesh.add(penTipMesh);

  // Initial position
  penMesh.position.set(0, 0, 10);
  scene.add(penMesh);

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

function updatePenPosition() {
  if (!penMesh || !simulatorStore.parsedGCode) return;

  const parsed = simulatorStore.parsedGCode;
  const currentTime = simulatorStore.currentTime;

  // Find current instruction and interpolate position
  const current = findInstructionAtTime(parsed.instructions, currentTime);

  let penX = 0, penY = 0;
  let isPenDown = false;
  let currentToolNum: number | null = null;
  let isPumping = false;
  let pumpProgress = 0;

  if (current && current.instruction.startPosition && current.instruction.endPosition) {
    // Interpolate position within current instruction
    const pos = lerp(current.instruction.startPosition, current.instruction.endPosition, current.progress);
    // Convert machine coords to canvas coords (machine X→canvas Y, machine Y→canvas X)
    penX = pos.y;
    penY = pos.x;

    // Check if we're in a pump instruction
    if (current.instruction.type === 'pump' && simulatorStore.showPumpIndicators) {
      isPumping = true;
      pumpProgress = current.progress;
    }
  } else {
    // Use machine state position
    const machinePos = simulatorStore.machineState.position;
    penX = machinePos.y;
    penY = machinePos.x;
  }

  isPenDown = simulatorStore.machineState.isPenDown;
  currentToolNum = simulatorStore.machineState.currentTool;

  // Update pen mesh position
  penMesh.position.x = penX;
  penMesh.position.y = penY;

  // Animate pen height based on pen state and pump action
  let targetZ: number;
  if (isPumping) {
    // Pump animation: down in first half (0-50%), up in second half (50-100%)
    // Goes from 40 (up) -> -5 (below surface for pump) -> 40 (up)
    const pumpDepth = -5; // Below surface for pumping
    const upHeight = 40;
    if (pumpProgress < 0.5) {
      // Going down: 0->0.5 maps to upHeight->pumpDepth
      const downProgress = pumpProgress * 2; // 0->1
      targetZ = upHeight + (pumpDepth - upHeight) * downProgress;
    } else {
      // Going up: 0.5->1 maps to pumpDepth->upHeight
      const upProgress = (pumpProgress - 0.5) * 2; // 0->1
      targetZ = pumpDepth + (upHeight - pumpDepth) * upProgress;
    }
    // Direct position for pump (no smoothing for accurate animation)
    penMesh.position.z = targetZ;
  } else {
    targetZ = isPenDown ? 5 : 40;
    penMesh.position.z += (targetZ - penMesh.position.z) * 0.3; // Smooth interpolation
  }

  // Update pen color based on current tool (both body and tip)
  if (currentToolNum !== null && simulatorStore.toolConfigs[currentToolNum - 1]) {
    const toolConfig = simulatorStore.toolConfigs[currentToolNum - 1];
    const color = new THREE.Color(toolConfig.color);
    (penBodyMesh.material as THREE.MeshBasicMaterial).color = color;
    (penTipMesh.material as THREE.MeshBasicMaterial).color = color;
  } else {
    // No tool - show gray pen
    (penBodyMesh.material as THREE.MeshBasicMaterial).color = new THREE.Color(0x404040);
    (penTipMesh.material as THREE.MeshBasicMaterial).color = new THREE.Color(0x404040);
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

  // Update 3D pen position with interpolation
  updatePenPosition();

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

  // Process all instructions up to current time
  for (const instruction of parsed.instructions) {
    // Stop if we've passed current time
    if (instruction.cumulativeTime > simulatorStore.currentTime) {
      // Handle partial progress on current instruction (animate the current move)
      const current = findInstructionAtTime(parsed.instructions, simulatorStore.currentTime);
      if (current && current.instruction.type === 'move' && current.instruction.startPosition && current.instruction.endPosition) {
        const pos = lerp(current.instruction.startPosition, current.instruction.endPosition, current.progress);

        // Drawing move (pen down)
        if (!current.instruction.isTravel) {
          // Get tool config for drawing
          if (currentTool !== null) {
            const toolConfig = simulatorStore.toolConfigs[currentTool - 1];
            if (toolConfig) {
              simulatorRenderer.setTool({
                toolNumber: currentTool,
                penType: toolConfig.penType,
                color: toolConfig.color,
                lineWidth: getPenWidth(toolConfig.penType),
              });
            }
          }
          simulatorRenderer.drawSegment(current.instruction.startPosition, pos);
        }
        // Travel move (pen up) - always animate if showTravelPaths is on
        else if (simulatorStore.showTravelPaths) {
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
              lineWidth: getPenWidth(toolConfig.penType),
            });
          }
        } else if (!instruction.isGrab) {
          currentTool = null;
        }
        break;

      case 'move':
        if (instruction.startPosition && instruction.endPosition) {
          if (instruction.isTravel) {
            // Travel move (pen up)
            if (simulatorStore.showTravelPaths) {
              simulatorRenderer.drawTravelPath(instruction.startPosition, instruction.endPosition);
            }
          } else {
            // Drawing move (pen down) - ensure tool is set
            if (currentTool !== null) {
              const toolConfig = simulatorStore.toolConfigs[currentTool - 1];
              if (toolConfig) {
                simulatorRenderer.setTool({
                  toolNumber: currentTool,
                  penType: toolConfig.penType,
                  color: toolConfig.color,
                  lineWidth: getPenWidth(toolConfig.penType),
                });
              }
            }
            simulatorRenderer.drawSegment(instruction.startPosition, instruction.endPosition);
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

  // Note: Pen position is now shown as 3D mesh, updated in updatePenPosition()
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
