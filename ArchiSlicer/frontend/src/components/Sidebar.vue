<template>
    <aside :style="{ width: sidebarWidth + 'px' }" class="flex flex-col h-full bg-slate-900 overflow-hidden shrink-0 relative">
        <!-- Scrollable Content -->
        <div class="flex-grow overflow-y-auto p-3 space-y-4">

            <!-- File Upload -->
            <div class="relative flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-500 rounded-lg bg-slate-800 hover:border-slate-400 hover:bg-slate-700 transition-colors cursor-pointer"
                @dragover.prevent="dragOver = true"
                @dragleave="dragOver = false"
                @drop.prevent="handleDrop"
                :class="{ 'border-blue-500 bg-blue-900/50': dragOver }">
                <div class="text-white font-medium">Datei hochladen</div>
                <div class="text-xs text-slate-400 mt-1">oder hier ablegen</div>
                <input type="file" accept=".svg" @change="handleFileSelect"
                    class="absolute inset-0 opacity-0 cursor-pointer" />
            </div>

            <!-- SVG Items List -->
            <div v-if="store.svgItems.length > 0" class="space-y-2">
                <div class="flex items-center justify-between">
                    <h3 class="font-semibold text-sm text-white">
                        Dateien ({{ store.svgItems.length }})
                    </h3>
                    <button @click="store.clearSVGItems()"
                        class="text-xs text-red-400 hover:text-red-300">
                        Alle löschen
                    </button>
                </div>
                <div class="space-y-2">
                    <SVGItemPanel
                        v-for="(item, index) in store.svgItems"
                        :key="index"
                        :item="item"
                        :item-index="index"
                        :tool-configs="toolConfigs"
                        :is-first="index === 0"
                        :is-last="index === store.svgItems.length - 1"
                        @move-up="store.moveItemUp(index)"
                        @move-down="store.moveItemDown(index)"
                        @remove="store.removeSVGItem(index)"
                        @update-tool="(v) => store.updateSVGItemTool(index, v)"
                        @update-feedrate="(v) => store.updateSVGItemFeedrate(index, v)"
                        @update-pattern="(v) => updatePattern(index, v)"
                        @update-infill-tool="(v) => store.updateSVGItemInfillTool(index, v)"
                        @update-density="(v) => updateDensity(index, v)"
                        @update-angle="(v) => updateAngle(index, v)"
                        @update-offset="(v) => updateOffset(index, v)"
                        @remove-infill="removeInfill(index)"
                        @generate-preview="generatePreview(index)"
                        @optimize-infill="store.optimizeFileInfill(index)"
                        @analyze="store.analyzeColors(index)"
                        @set-path-role="(pathId, role) => store.setPathRole(index, pathId, role)"
                        @update-workpiece-start="(v) => store.setSVGItemWorkpieceStart(index, v)"
                        @update-dpi="(v) => store.updateSVGItemDpi(index, v)"
                        @apply-to-all-colors="store.applyFileSettingsToAllColors(index)"
                        @toggle-file-visibility="store.toggleFileVisibility(index)"
                    />
                </div>
            </div>

            <!-- ColorAssignmentPanel removed - functionality merged into SVGItemPanel -->

            <!-- Workpiece Starts Panel -->
            <WorkpieceStartPanel />

            <!-- Tool Panel -->
            <ToolPanel
                :active-tool-index="activeToolIndex"
                :tool-configs="toolConfigs"
                @select-tool="(v) => $emit('select-tool', v)"
                @update-tool-config="(i, c) => $emit('update-tool-config', i, c)"
                @load-preset="(configs) => $emit('load-preset', configs)"
            />

            <!-- Pen Type Admin (collapsible) -->
            <details class="group">
                <summary class="cursor-pointer text-slate-400 text-xs hover:text-white py-2 px-3 bg-slate-800 rounded-lg">
                    Stifttypen verwalten
                    <span class="ml-1 group-open:hidden">+</span>
                    <span class="ml-1 hidden group-open:inline">-</span>
                </summary>
                <div class="mt-2">
                    <PenTypeAdmin />
                </div>
            </details>

            <!-- Global Settings -->
            <div class="bg-slate-800 p-3 rounded-lg">
                <h3 class="text-white text-sm font-semibold mb-3 text-center">Globale Einstellungen</h3>

                <!-- Materialstärke -->
                <div class="p-2 bg-slate-700 rounded">
                    <div class="flex items-center">
                        <span class="text-white text-xs mr-2">Materialstärke:</span>
                        <input type="number" :value="globalDrawingHeight"
                            @change="$emit('update-drawing-height', Number(($event.target as HTMLInputElement).value))"
                            class="p-1 w-16 border rounded text-sm bg-white" min="0" max="50" step="0.5" />
                        <span class="text-white text-xs ml-1">mm</span>
                    </div>
                    <div class="mt-1 text-xs text-slate-400">
                        Hebt Z um diesen Wert an (für dickeres Material)
                    </div>
                </div>

                <!-- Default DPI -->
                <div class="flex items-center p-2 bg-slate-700 rounded mt-2">
                    <span class="text-white text-xs mr-2">Default DPI:</span>
                    <input type="number" :value="store.defaultDpi"
                        @change="store.setDefaultDpi(Number(($event.target as HTMLInputElement).value))"
                        class="p-1 w-16 border rounded text-sm bg-white" min="72" max="600" step="1" />
                    <span class="text-slate-400 text-xs ml-2">(für neue Imports)</span>
                </div>

                <!-- Kamera-Kippen -->
                <div class="flex items-center justify-between p-2 bg-slate-700 rounded mt-2">
                    <span class="text-white text-xs">Kamera kippen erlauben</span>
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" :checked="store.cameraTiltEnabled"
                            @change="store.setCameraTiltEnabled(($event.target as HTMLInputElement).checked)"
                            class="sr-only peer" />
                        <div class="w-9 h-5 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                <!-- Hintergrund-Preset -->
                <div class="p-2 bg-slate-700 rounded mt-2">
                    <div class="flex items-center mb-2">
                        <span class="text-white text-xs mr-2">Hintergrund:</span>
                        <select :value="backgroundPreset"
                            @change="$emit('update-background-preset', ($event.target as HTMLSelectElement).value)"
                            class="flex-grow p-1 text-xs border border-slate-500 rounded bg-slate-600 text-white">
                            <option v-for="(preset, key) in gradientPresets" :key="key" :value="key">
                                {{ preset.name }}
                            </option>
                        </select>
                    </div>
                    <!-- Custom Color Picker (nur wenn 'custom' ausgewählt) -->
                    <div v-if="backgroundPreset === 'custom'" class="flex items-center">
                        <input type="color" :value="customBackgroundColor"
                            @input="$emit('update-custom-color', ($event.target as HTMLInputElement).value)"
                            class="w-8 h-8 rounded border border-slate-500 cursor-pointer bg-transparent" />
                        <span class="text-slate-400 text-xs ml-2">{{ customBackgroundColor }}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Resize Handle -->
        <div
            @mousedown="startResize"
            class="absolute top-0 right-0 w-1 h-full cursor-ew-resize hover:bg-blue-500 bg-slate-700 transition-colors z-10"
            title="Drag to resize">
        </div>
    </aside>
</template>

<script setup lang="ts">
import { ref, markRaw, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';
import { useMainStore } from '../store';
import { getThreejsObjectFromSvg, generateInfillForGroup, generateInfillWithHolesAsync, InfillPatternType, defaultInfillOptions } from '../utils/threejs_services';
import { type ToolConfig } from '../utils/gcode_services';
import ToolPanel from './ToolPanel.vue';
import SVGItemPanel from './SVGItemPanel.vue';
// ColorAssignmentPanel removed - functionality merged into SVGItemPanel
import WorkpieceStartPanel from './WorkpieceStartPanel.vue';
import PenTypeAdmin from './PenTypeAdmin.vue';

const props = defineProps<{
    activeToolIndex: number;
    toolConfigs: ToolConfig[];
    globalDrawingHeight: number;
    backgroundPreset: string;
    customBackgroundColor: string;
}>();

const emit = defineEmits<{
    (e: 'select-tool', index: number): void;
    (e: 'update-tool-config', index: number, config: ToolConfig): void;
    (e: 'update-drawing-height', value: number): void;
    (e: 'update-background-preset', preset: string): void;
    (e: 'update-custom-color', color: string): void;
    (e: 'load-preset', configs: ToolConfig[]): void;
}>();

// Gradient-Presets importieren
import { gradientPresets } from '../utils/background_presets';

const store = useMainStore();
const dragOver = ref(false);

// Sidebar resize
const sidebarWidth = ref(320); // Default 320px (was w-80)
const MIN_WIDTH = 280;
const MAX_WIDTH = 600;
const STORAGE_KEY = 'archiplotterXL_sidebarWidth';
const isResizing = ref(false);
const startX = ref(0);
const startWidth = ref(0);

// Load saved width from localStorage on mount
onMounted(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        const parsed = parseInt(saved, 10);
        if (parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
            sidebarWidth.value = parsed;
        }
    }
});

// Cleanup on unmount
onUnmounted(() => {
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
});

// Start resize
function startResize(event: MouseEvent) {
    isResizing.value = true;
    startX.value = event.clientX;
    startWidth.value = sidebarWidth.value;

    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);

    // Prevent text selection during drag
    event.preventDefault();
    document.body.classList.add('resizing');
}

// Handle resize
function handleResize(event: MouseEvent) {
    if (!isResizing.value) return;

    const delta = event.clientX - startX.value;
    const newWidth = startWidth.value + delta;

    // Clamp between min and max
    sidebarWidth.value = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
}

// Stop resize
function stopResize() {
    isResizing.value = false;
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, sidebarWidth.value.toString());
    document.body.classList.remove('resizing');
}

// File handling
const handleFileSelect = (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
        loadSVGFile(target.files[0]);
    }
};

const handleDrop = (e: DragEvent) => {
    dragOver.value = false;
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        loadSVGFile(e.dataTransfer.files[0]);
    }
};

const loadSVGFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
        if (event.target) {
            const contents = event.target.result as string;
            const lineGeoGroup = await getThreejsObjectFromSvg(contents, 0, store.defaultDpi);
            const currentToolConfig = props.toolConfigs[props.activeToolIndex - 1];

            store.addSVGItem(
                markRaw(lineGeoGroup),
                props.activeToolIndex,
                file.name,
                currentToolConfig.penType, // Nur penType für Kompatibilität
                { ...defaultInfillOptions },
                3000,
                props.activeToolIndex,
                0,
                store.defaultDpi,  // Default DPI aus Store
                contents  // SVG-Inhalt für Neuberechnung bei DPI-Änderung speichern
            );
            console.log(`SVG "${file.name}" geladen mit Tool #${props.activeToolIndex}`);
        }
    };
    reader.readAsText(file);
};

// Infill updates
const updatePattern = (index: number, patternType: string) => {
    const item = store.svgItems[index];
    item.infillOptions.patternType = patternType as InfillPatternType;
    store.updateSVGItemInfill(index, item.infillOptions);
};

const updateDensity = (index: number, density: number) => {
    const item = store.svgItems[index];
    item.infillOptions.density = density;
    store.updateSVGItemInfill(index, item.infillOptions);
};

const updateAngle = (index: number, angle: number) => {
    const item = store.svgItems[index];
    item.infillOptions.angle = angle;
    store.updateSVGItemInfill(index, item.infillOptions);
};

const updateOffset = (index: number, offset: number) => {
    const item = store.svgItems[index];
    item.infillOptions.outlineOffset = offset;
    store.updateSVGItemInfill(index, item.infillOptions);
};

const removeInfill = (index: number) => {
    const item = store.svgItems[index];

    if (item.infillGroup) {
        while (item.infillGroup.children.length > 0) {
            const child = item.infillGroup.children[0];
            if (child instanceof THREE.Line) {
                (child.material as THREE.Material).dispose();
                child.geometry.dispose();
            }
            item.infillGroup.remove(child);
        }
        item.geometry.remove(item.infillGroup);
        store.setSVGItemInfillGroup(index, null);
    }

    // Stats zurücksetzen, aber patternType behalten (damit erneutes Generieren möglich ist)
    item.infillStats = undefined;
};

const generatePreview = async (index: number) => {
    const item = store.svgItems[index];

    // Set loading state (colorIndex: null = file-level infill)
    store.infillGenerating = { svgIndex: index, colorIndex: null };

    try {
        // Remove old infill and reset stats
        if (item.infillGroup) {
            while (item.infillGroup.children.length > 0) {
                const child = item.infillGroup.children[0];
                if (child instanceof THREE.Line) {
                    (child.material as THREE.Material).dispose();
                    child.geometry.dispose();
                }
                item.infillGroup.remove(child);
            }
            item.geometry.remove(item.infillGroup);
        }
        item.infillStats = undefined;

        // Generate new infill - use hole-aware version if path analysis is available
        let infillGroup: THREE.Group;
        if (item.isPathAnalyzed && item.pathAnalysis) {
            // Use async backend-enabled version for path-analyzed SVGs
            infillGroup = await generateInfillWithHolesAsync(item.geometry, item.infillOptions, item.pathAnalysis);
            console.log(`Infill mit Hole-Clipping generiert für SVG #${index}: ${item.fileName}`);
        } else {
            infillGroup = generateInfillForGroup(item.geometry, item.infillOptions);
            console.log(`Infill-Vorschau generiert für SVG #${index}: ${item.fileName}`);
        }

        store.setSVGItemInfillGroup(index, infillGroup);
        item.geometry.add(infillGroup);

        // Calculate stats (without optimization)
        const lines = infillGroup.children.filter(c => c instanceof THREE.Line) as THREE.Line[];
        let totalLength = 0;
        let travelLength = 0;
        let lastEnd: THREE.Vector3 | null = null;

        for (const line of lines) {
            const pos = line.geometry.getAttribute('position');
            if (pos && pos.count >= 2) {
                const start = new THREE.Vector3(pos.getX(0), pos.getY(0), pos.getZ(0));
                const end = new THREE.Vector3(pos.getX(1), pos.getY(1), pos.getZ(1));
                totalLength += start.distanceTo(end);
                if (lastEnd) {
                    travelLength += lastEnd.distanceTo(start);
                }
                lastEnd = end;
            }
        }

        item.infillStats = {
            totalLengthMm: Math.round(totalLength * 10) / 10,
            travelLengthMm: Math.round(travelLength * 10) / 10,
            numSegments: lines.length,
            numPenLifts: lines.length > 0 ? lines.length - 1 : 0,
            isOptimized: false
        };

        console.log(`Infill Stats: ${lines.length} Linien, ${item.infillStats.travelLengthMm}mm Travel`);
    } finally {
        // Clear loading state
        store.infillGenerating = null;
    }
};
</script>
