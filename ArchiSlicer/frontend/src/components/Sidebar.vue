<template>
    <aside class="flex flex-col w-80 h-full bg-slate-200 overflow-hidden shrink-0">
        <!-- Scrollable Content -->
        <div class="flex-grow overflow-y-auto p-3 space-y-4">

            <!-- File Upload -->
            <div class="relative flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-400 rounded-lg hover:border-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                @dragover.prevent="dragOver = true"
                @dragleave="dragOver = false"
                @drop.prevent="handleDrop"
                :class="{ 'border-blue-500 bg-blue-50': dragOver }">
                <div class="text-slate-600 font-medium">Datei hochladen</div>
                <div class="text-xs text-slate-500 mt-1">oder hier ablegen</div>
                <input type="file" accept=".svg" @change="handleFileSelect"
                    class="absolute inset-0 opacity-0 cursor-pointer" />
            </div>

            <!-- SVG Items List -->
            <div v-if="store.svgItems.length > 0" class="space-y-2">
                <div class="flex items-center justify-between">
                    <h3 class="font-semibold text-sm text-slate-700">
                        Dateien ({{ store.svgItems.length }})
                    </h3>
                    <button @click="store.clearSVGItems()"
                        class="text-xs text-red-600 hover:text-red-800">
                        Alle löschen
                    </button>
                </div>
                <div class="space-y-2">
                    <SVGItemPanel
                        v-for="(item, index) in store.svgItems"
                        :key="index"
                        :item="item"
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
                    />
                </div>
            </div>

            <!-- Tool Panel -->
            <ToolPanel
                :active-tool-index="activeToolIndex"
                :tool-pen-types="toolPenTypes"
                @select-tool="(v) => $emit('select-tool', v)"
                @update-pen-type="(i, p) => $emit('update-pen-type', i, p)"
            />

            <!-- Global Settings -->
            <div class="bg-slate-800 p-3 rounded-lg">
                <h3 class="text-white text-sm font-semibold mb-3 text-center">Globale Einstellungen</h3>
                <div class="flex items-center p-2 bg-slate-700 rounded">
                    <span class="text-white text-xs mr-2">Z-Höhe:</span>
                    <input type="number" :value="globalDrawingHeight"
                        @change="$emit('update-drawing-height', Number(($event.target as HTMLInputElement).value))"
                        class="p-1 w-16 border rounded text-sm bg-white" min="0" max="50" step="0.5" />
                    <span class="text-white text-xs ml-1">mm</span>
                </div>
                <div class="mt-2 text-xs text-slate-400 p-2 bg-slate-700/50 rounded">
                    Materialstärke für alle SVGs.
                </div>
            </div>
        </div>
    </aside>
</template>

<script setup lang="ts">
import { ref, markRaw } from 'vue';
import * as THREE from 'three';
import { useMainStore } from '../store';
import { getThreejsObjectFromSvg, generateInfillForGroup, InfillPatternType, defaultInfillOptions } from '../utils/threejs_services';
import ToolPanel from './ToolPanel.vue';
import SVGItemPanel from './SVGItemPanel.vue';

const props = defineProps<{
    activeToolIndex: number;
    toolPenTypes: string[];
    globalDrawingHeight: number;
}>();

const emit = defineEmits<{
    (e: 'select-tool', index: number): void;
    (e: 'update-pen-type', index: number, penType: string): void;
    (e: 'update-drawing-height', value: number): void;
}>();

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
            const lineGeoGroup = await getThreejsObjectFromSvg(contents);
            const currentPenType = props.toolPenTypes[props.activeToolIndex - 1];

            store.addSVGItem(
                markRaw(lineGeoGroup),
                props.activeToolIndex,
                file.name,
                currentPenType,
                { ...defaultInfillOptions },
                3000,
                props.activeToolIndex,
                0
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

    // Generate new infill
    const infillGroup = generateInfillForGroup(item.geometry, item.infillOptions);
    store.setSVGItemInfillGroup(index, infillGroup);
    item.geometry.add(infillGroup);

    console.log(`Infill-Vorschau generiert für SVG #${index}: ${item.fileName}`);
};
</script>
