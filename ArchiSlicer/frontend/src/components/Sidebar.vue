<template>
    <aside class="flex flex-col w-80 h-full bg-slate-900 overflow-hidden shrink-0">
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
                        @analyze="store.analyzeColors(index)"
                        @set-path-role="(pathId, role) => store.setPathRole(index, pathId, role)"
                        @update-workpiece-start="(v) => store.setSVGItemWorkpieceStart(index, v)"
                        @update-dpi="(v) => store.updateSVGItemDpi(index, v)"
                    />
                </div>
            </div>

            <!-- Color Assignment Panel -->
            <ColorAssignmentPanel v-if="store.svgItems.length > 0" :tool-configs="toolConfigs" />

            <!-- Workpiece Starts Panel -->
            <WorkpieceStartPanel />

            <!-- Tool Panel -->
            <ToolPanel
                :active-tool-index="activeToolIndex"
                :tool-configs="toolConfigs"
                @select-tool="(v) => $emit('select-tool', v)"
                @update-tool-config="(i, c) => $emit('update-tool-config', i, c)"
            />

            <!-- Global Settings -->
            <div class="bg-slate-800 p-3 rounded-lg">
                <h3 class="text-white text-sm font-semibold mb-3 text-center">Globale Einstellungen</h3>

                <!-- Z-Höhe -->
                <div class="flex items-center p-2 bg-slate-700 rounded">
                    <span class="text-white text-xs mr-2">Z-Höhe:</span>
                    <input type="number" :value="globalDrawingHeight"
                        @change="$emit('update-drawing-height', Number(($event.target as HTMLInputElement).value))"
                        class="p-1 w-16 border rounded text-sm bg-white" min="0" max="50" step="0.5" />
                    <span class="text-white text-xs ml-1">mm</span>
                </div>

                <!-- Default DPI -->
                <div class="flex items-center p-2 bg-slate-700 rounded mt-2">
                    <span class="text-white text-xs mr-2">Default DPI:</span>
                    <input type="number" :value="store.defaultDpi"
                        @change="store.setDefaultDpi(Number(($event.target as HTMLInputElement).value))"
                        class="p-1 w-16 border rounded text-sm bg-white" min="72" max="600" step="1" />
                    <span class="text-slate-400 text-xs ml-2">(für neue Imports)</span>
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

                <div class="mt-2 text-xs text-slate-400 p-2 bg-slate-700/50 rounded">
                    Z-Höhe = Materialstärke
                </div>
            </div>
        </div>
    </aside>
</template>

<script setup lang="ts">
import { ref, markRaw } from 'vue';
import * as THREE from 'three';
import { useMainStore } from '../store';
import { getThreejsObjectFromSvg, generateInfillForGroup, generateInfillWithHoles, InfillPatternType, defaultInfillOptions } from '../utils/threejs_services';
import { type ToolConfig } from '../utils/gcode_services';
import ToolPanel from './ToolPanel.vue';
import SVGItemPanel from './SVGItemPanel.vue';
import ColorAssignmentPanel from './ColorAssignmentPanel.vue';
import WorkpieceStartPanel from './WorkpieceStartPanel.vue';

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
}>();

// Gradient-Presets importieren
import { gradientPresets } from '../utils/background_presets';

const store = useMainStore();
const dragOver = ref(false);

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

    item.infillOptions.patternType = InfillPatternType.NONE;
    store.updateSVGItemInfill(index, item.infillOptions);
};

const generatePreview = (index: number) => {
    const item = store.svgItems[index];

    // Remove old infill
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

    // Generate new infill - use hole-aware version if path analysis is available
    let infillGroup: THREE.Group;
    if (item.isPathAnalyzed && item.pathAnalysis) {
        infillGroup = generateInfillWithHoles(item.geometry, item.infillOptions, item.pathAnalysis);
        console.log(`Infill mit Hole-Clipping generiert für SVG #${index}: ${item.fileName}`);
    } else {
        infillGroup = generateInfillForGroup(item.geometry, item.infillOptions);
        console.log(`Infill-Vorschau generiert für SVG #${index}: ${item.fileName}`);
    }

    store.setSVGItemInfillGroup(index, infillGroup);
    item.geometry.add(infillGroup);
};
</script>
