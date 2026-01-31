<template>
    <div class="bg-slate-800 rounded-lg">
        <!-- Header -->
        <div class="flex items-center justify-between p-3 bg-slate-700 rounded-t-lg">
            <span class="text-white font-medium text-sm truncate max-w-[140px]" :title="item.fileName">
                {{ item.fileName }}
            </span>
            <div class="flex items-center space-x-1">
                <button @click="$emit('move-up')"
                    class="p-1 rounded text-slate-300 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    :disabled="isFirst">
                    <span class="text-sm">↑</span>
                </button>
                <button @click="$emit('move-down')"
                    class="p-1 rounded text-slate-300 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    :disabled="isLast">
                    <span class="text-sm">↓</span>
                </button>
                <button @click="$emit('remove')"
                    class="p-1 rounded text-red-400 hover:bg-slate-600 hover:text-red-300">
                    <span class="text-lg leading-none">&times;</span>
                </button>
            </div>
        </div>

        <!-- Settings -->
        <div class="p-3 space-y-3">
            <!-- Workpiece Start Auswahl -->
            <div v-if="store.workpieceStarts.length > 0" class="flex items-center">
                <label class="text-xs text-slate-400 mr-2">Position:</label>
                <select :value="item.workpieceStartId || ''"
                    @change="$emit('update-workpiece-start', ($event.target as HTMLSelectElement).value || undefined)"
                    class="flex-grow p-1 text-sm border border-slate-600 rounded bg-slate-700 text-white">
                    <option value="">Ursprung (0, 0)</option>
                    <option v-for="ws in store.workpieceStarts" :key="ws.id" :value="ws.id">
                        {{ ws.name }} (X{{ ws.y }}, Y{{ ws.x }})
                    </option>
                </select>
            </div>

            <!-- File Settings Section Header -->
            <div class="border-t border-slate-600 pt-3">
                <button @click="fileSettingsExpanded = !fileSettingsExpanded"
                    class="w-full flex items-center justify-between p-2 rounded hover:bg-slate-700 transition-colors">
                    <div class="flex items-center space-x-2">
                        <!-- File-level visibility toggle -->
                        <button v-if="item.isAnalyzed && item.colorGroups.length > 0"
                            @click.stop="$emit('toggle-file-visibility')"
                            class="w-5 h-5 flex items-center justify-center text-xs rounded"
                            :class="allColorsVisible ? 'bg-green-600 text-white' : 'bg-slate-600 text-slate-400'"
                            :title="allColorsVisible ? 'Alle Farben sichtbar' : 'Einige Farben versteckt'">
                            {{ allColorsVisible ? '👁' : '👁‍🗨' }}
                        </button>
                        <span class="text-sm text-white font-medium">File Settings</span>
                        <span v-if="item.isAnalyzed" class="text-xs text-slate-400">(Fallback)</span>
                    </div>
                    <span class="text-slate-400 transition-transform duration-200"
                        :class="{ 'rotate-180': !fileSettingsExpanded }">▼</span>
                </button>

                <!-- File Settings Content (collapsible) -->
                <div v-if="fileSettingsExpanded" class="mt-2 space-y-3 px-2">
                    <!-- Tool & Feedrate Row -->
                    <div class="flex items-center space-x-3">
                        <div class="flex items-center">
                            <label class="text-xs text-slate-400 mr-1">Tool:</label>
                            <ToolSelect
                                :model-value="item.toolNumber"
                                :tool-configs="toolConfigs"
                                @update:model-value="(v: number) => $emit('update-tool', v)"
                                button-class="w-16"
                            />
                        </div>
                        <div class="flex items-center flex-grow">
                            <label class="text-xs text-slate-400 mr-1">Speed:</label>
                            <input type="number" :value="item.feedrate"
                                @change="$emit('update-feedrate', Number(($event.target as HTMLInputElement).value))"
                                class="p-1 w-20 text-sm border border-slate-600 rounded bg-slate-700 text-white" min="100" max="30000" step="100" />
                            <span class="text-xs text-slate-400 ml-1">mm/min</span>
                        </div>
                    </div>

                    <!-- Infill Tool (when NOT using color-based infill) -->
                    <div v-if="!item.isAnalyzed" class="flex items-center">
                        <label class="text-xs text-slate-400 mr-1">Infill Tool:</label>
                        <ToolSelect
                            :model-value="item.infillToolNumber"
                            :tool-configs="toolConfigs"
                            @update:model-value="(v: number) => $emit('update-infill-tool', v)"
                            button-class="flex-grow"
                        />
                    </div>

                    <!-- Apply to all colors button (only when analyzed) -->
                    <button v-if="item.isAnalyzed && item.colorGroups.length > 0"
                        @click="$emit('apply-to-all-colors')"
                        class="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                        Auf alle Farben anwenden
                    </button>

                    <!-- Hint when analyzed -->
                    <div v-if="item.isAnalyzed" class="text-xs text-slate-400 p-2 bg-slate-700/50 rounded">
                        ℹ️ Diese Einstellungen dienen als Fallback-Werte für Farben, die "File Default" verwenden.
                    </div>
                </div>
            </div>

            <!-- Colors Section -->
            <div class="border-t border-slate-600 pt-3">
                <!-- If NOT analyzed: Show analyze button -->
                <div v-if="!item.isAnalyzed" class="text-center">
                    <button @click="$emit('analyze')"
                        class="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors">
                        Farben analysieren
                    </button>
                    <div class="text-xs text-slate-400 mt-2">
                        Analysiert Farben im SVG (Stroke und Fill)
                    </div>
                </div>

                <!-- If analyzed: Show colors section -->
                <div v-else>
                    <button @click="colorsExpanded = !colorsExpanded"
                        class="w-full flex items-center justify-between p-2 rounded hover:bg-slate-700 transition-colors">
                        <div class="flex items-center space-x-2">
                            <span class="text-sm text-white font-medium">Colors</span>
                            <span class="text-xs text-slate-400">({{ item.colorGroups.length }})</span>
                        </div>
                        <span class="text-slate-400 transition-transform duration-200"
                            :class="{ 'rotate-180': !colorsExpanded }">▼</span>
                    </button>

                    <!-- Color Rows -->
                    <div v-if="colorsExpanded" class="space-y-2 mt-2">
                        <ColorRow
                            v-for="(colorGroup, colorIdx) in item.colorGroups"
                            :key="colorIdx"
                            :color-group="colorGroup"
                            :item-index="itemIndex"
                            :color-index="colorIdx"
                            :file-tool="item.toolNumber"
                            :file-infill-tool="item.infillToolNumber"
                            :tool-configs="toolConfigs"
                            :is-generating="store.infillGenerating?.svgIndex === itemIndex && store.infillGenerating?.colorIndex === colorIdx"
                            :is-optimizing="store.infillOptimizing?.svgIndex === itemIndex && store.infillOptimizing?.colorIndex === colorIdx"
                            :is-generating-centerline="store.centerlineGenerating?.svgIndex === itemIndex && store.centerlineGenerating?.colorIndex === colorIdx"
                            :is-first="colorIdx === 0"
                            :is-last="colorIdx === item.colorGroups.length - 1"
                            :pen-width="getPenWidthForColor(colorGroup)"
                            @toggle-visibility="store.toggleColorVisibility(itemIndex, colorIdx)"
                            @toggle-outlines="store.toggleColorOutlines(itemIndex, colorIdx)"
                            @toggle-use-defaults="store.toggleColorUseFileDefaults(itemIndex, colorIdx)"
                            @update-tool="store.setColorTool(itemIndex, colorIdx, $event)"
                            @toggle-infill="store.toggleColorInfill(itemIndex, colorIdx)"
                            @toggle-infill-first="store.toggleColorInfillFirst(itemIndex, colorIdx)"
                            @update-infill-tool="store.setColorInfillTool(itemIndex, colorIdx, $event)"
                            @update-pattern="store.setColorInfillPattern(itemIndex, colorIdx, $event as InfillPatternType)"
                            @generate-infill="store.queueTask('generate', itemIndex, colorIdx, `Gen: ${item.fileName} - ${colorGroup.color}`)"
                            @optimize-infill="store.queueTask('optimize', itemIndex, colorIdx, `TSP: ${item.fileName} - ${colorGroup.color}`)"
                            @delete-infill="store.deleteColorInfill(itemIndex, colorIdx)"
                            @update-density="store.updateColorInfillOptions(itemIndex, colorIdx, { density: $event })"
                            @update-angle="store.updateColorInfillOptions(itemIndex, colorIdx, { angle: $event })"
                            @update-outline-offset="store.updateColorInfillOptions(itemIndex, colorIdx, { outlineOffset: $event })"
                            @update-drawing-mode="store.setColorDrawingMode(itemIndex, colorIdx, $event)"
                            @update-custom-offset="store.setColorCustomOffset(itemIndex, colorIdx, $event)"
                            @generate-offset-contour="store.generateOffsetContour(itemIndex, colorIdx, getPenWidthForColor(colorGroup))"
                            @move-up="store.moveColorUp(itemIndex, colorIdx)"
                            @move-down="store.moveColorDown(itemIndex, colorIdx)"
                            @toggle-centerline="store.toggleColorCenterline(itemIndex, colorIdx)"
                            @generate-centerline="store.generateColorCenterline(itemIndex, colorIdx)"
                            @delete-centerline="store.deleteColorCenterline(itemIndex, colorIdx)"
                            @update-centerline-option="(key: string, value: number | string) => store.updateCenterlineOptions(itemIndex, colorIdx, { [key]: value })"
                        />
                    </div>
                </div>
            </div>

            <!-- DPI-Skalierung und Abmessungen -->
            <div class="flex items-center justify-between">
                <div class="flex items-center">
                    <label class="text-xs text-slate-400 mr-1">DPI:</label>
                    <input type="number" :value="item.dpi"
                        @change="$emit('update-dpi', Number(($event.target as HTMLInputElement).value))"
                        class="p-1 w-14 text-sm border border-slate-600 rounded bg-slate-700 text-white" min="1" max="600" step="1" />
                </div>
                <div class="text-xs text-slate-300">
                    {{ dimensions.width.toFixed(0) }} × {{ dimensions.height.toFixed(0) }} mm
                </div>
            </div>

            <!-- Path-Analyse (Hole Detection) - automatisch beim Import -->
            <div v-if="item.isPathAnalyzed && (item.pathAnalysis?.paths.length || 0) > 0" class="flex items-center justify-between">
                <div class="flex items-center space-x-2">
                    <span class="text-xs text-slate-400">Pfade:</span>
                    <span class="text-xs px-1.5 py-0.5 rounded bg-green-600/30 text-green-300">
                        {{ item.pathAnalysis?.outerPaths.length || 0 }} Outer
                    </span>
                    <span v-if="(item.pathAnalysis?.holes.length || 0) > 0"
                        class="text-xs px-1.5 py-0.5 rounded bg-yellow-600/30 text-yellow-300">
                        {{ item.pathAnalysis?.holes.length }} Holes
                    </span>
                    <span v-if="(item.pathAnalysis?.nestedObjects.length || 0) > 0"
                        class="text-xs px-1.5 py-0.5 rounded bg-blue-600/30 text-blue-300">
                        {{ item.pathAnalysis?.nestedObjects.length }} Nested
                    </span>
                </div>
                <div class="flex items-center space-x-1">
                    <!-- Hole Editor Toggle Button -->
                    <button @click="store.toggleHoleEditorMode()"
                        class="px-2 py-1 text-xs rounded transition-colors"
                        :class="store.holeEditorMode
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-600 text-slate-400 hover:bg-slate-500'">
                        {{ store.holeEditorMode ? '✓ Editor' : 'Editor' }}
                    </button>
                    <button @click="pathDetailsExpanded = !pathDetailsExpanded"
                        class="px-2 py-1 text-xs bg-slate-600 text-white rounded hover:bg-slate-500">
                        {{ pathDetailsExpanded ? 'Ausblenden' : 'Details' }}
                    </button>
                </div>
            </div>

            <!-- Hole Editor Hinweis -->
            <div v-if="store.holeEditorMode && item.isPathAnalyzed"
                 class="text-xs p-2 bg-purple-900/30 rounded space-y-1">
                <div class="text-purple-300">Klicke auf Flächen um Rolle zu ändern:</div>
                <div class="flex items-center space-x-2">
                    <span class="inline-flex items-center">
                        <span class="w-3 h-3 rounded-sm bg-green-500 mr-1"></span>
                        <span class="text-green-300">Outer</span>
                    </span>
                    <span class="text-slate-500">→</span>
                    <span class="inline-flex items-center">
                        <span class="w-3 h-3 rounded-sm bg-red-500 mr-1"></span>
                        <span class="text-red-300">Hole</span>
                    </span>
                    <span class="text-slate-500">→</span>
                    <span class="inline-flex items-center">
                        <span class="w-3 h-3 rounded-sm bg-blue-500 mr-1"></span>
                        <span class="text-blue-300">Nested</span>
                    </span>
                    <span class="text-slate-500">→ ...</span>
                </div>
                <div class="text-yellow-400/70 text-[10px]">Gelber Rand = manuell überschrieben</div>
            </div>

            <!-- Path Details (Expandable) -->
            <div v-if="item.isPathAnalyzed && pathDetailsExpanded" class="p-2 bg-slate-700/50 rounded border border-slate-600 space-y-1 max-h-32 overflow-y-auto">
                <div v-for="path in item.pathAnalysis?.paths" :key="path.id"
                    class="flex items-center justify-between text-xs">
                    <div class="flex items-center space-x-1">
                        <span class="text-slate-400">#{{ path.id.slice(-4) }}</span>
                        <span :class="{
                            'text-green-400': getPathRole(path) === 'outer',
                            'text-yellow-400': getPathRole(path) === 'hole',
                            'text-blue-400': getPathRole(path) === 'nested-object'
                        }">
                            {{ getPathRole(path) }}
                        </span>
                        <span v-if="path.userOverriddenRole" class="text-orange-400">(überschrieben)</span>
                    </div>
                    <select :value="path.userOverriddenRole || path.autoDetectedRole"
                        @change="handlePathRoleChange(path, ($event.target as HTMLSelectElement).value)"
                        class="p-0.5 text-xs border border-slate-500 rounded bg-slate-600 text-white">
                        <option value="outer">Outer</option>
                        <option value="hole">Hole</option>
                        <option value="nested-object">Nested</option>
                    </select>
                </div>
            </div>

            <!-- File-level Infill (only if NOT analyzed) -->
            <div v-if="!item.isAnalyzed">
                <!-- Infill Toggle Button -->
                <button @click="expanded = !expanded"
                class="w-full flex items-center justify-between p-2 rounded text-sm transition-colors"
                :class="item.infillOptions.patternType !== 'none'
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'">
                <span>
                    {{ item.infillOptions.patternType !== 'none'
                        ? `Infill: ${item.infillOptions.patternType}`
                        : 'Kein Infill' }}
                </span>
                <span>{{ expanded ? '▲' : '▼' }}</span>
            </button>
        </div>

        <!-- Infill Options (Expandable) - only show if NOT analyzed -->
        <div v-if="expanded && !item.isAnalyzed" class="p-3 bg-slate-700/50 border-t border-slate-600 space-y-3 rounded-b-lg">
            <!-- Pattern Type -->
            <div class="flex items-center">
                <label class="w-20 text-xs text-slate-400">Pattern:</label>
                <select :value="item.infillOptions.patternType"
                    @change="$emit('update-pattern', ($event.target as HTMLSelectElement).value)"
                    class="flex-grow p-1 text-sm border border-slate-600 rounded bg-slate-600 text-white">
                    <option v-for="pt in patternTypes" :key="pt" :value="pt">{{ pt }}</option>
                </select>
            </div>

            <!-- Infill Tool -->
            <div class="flex items-center">
                <label class="w-20 text-xs text-slate-400">Infill Tool:</label>
                <ToolSelect
                    :model-value="item.infillToolNumber"
                    :tool-configs="toolConfigs"
                    @update:model-value="(v: number) => $emit('update-infill-tool', v)"
                    button-class="flex-grow"
                />
            </div>

            <!-- Density -->
            <div class="flex items-center">
                <label class="w-20 text-xs text-slate-400">Dichte:</label>
                <input type="range" :value="item.infillOptions.density"
                    @input="$emit('update-density', Number(($event.target as HTMLInputElement).value))"
                    :min="densityRange.min" :max="densityRange.max" :step="densityRange.step"
                    class="flex-grow" />
                <input type="number" :value="item.infillOptions.density"
                    @change="$emit('update-density', Number(($event.target as HTMLInputElement).value))"
                    :min="densityRange.min" :max="densityRange.max" :step="densityRange.step"
                    class="w-14 ml-2 p-1 text-xs border border-slate-500 rounded bg-slate-600 text-white text-right" />
                <span class="text-xs text-slate-400 ml-1">mm</span>
            </div>

            <!-- Angle -->
            <div class="flex items-center">
                <label class="w-20 text-xs text-slate-400">Winkel:</label>
                <input type="range" :value="item.infillOptions.angle"
                    @input="$emit('update-angle', Number(($event.target as HTMLInputElement).value))"
                    min="0" max="180" step="5" class="flex-grow" />
                <input type="number" :value="item.infillOptions.angle"
                    @change="$emit('update-angle', Number(($event.target as HTMLInputElement).value))"
                    min="0" max="180" step="1"
                    class="w-14 ml-2 p-1 text-xs border border-slate-500 rounded bg-slate-600 text-white text-right" />
                <span class="text-xs text-slate-400 ml-1">°</span>
            </div>

            <!-- Outline Offset -->
            <div class="flex items-center">
                <label class="w-20 text-xs text-slate-400">Rand:</label>
                <input type="range" :value="item.infillOptions.outlineOffset"
                    @input="$emit('update-offset', Number(($event.target as HTMLInputElement).value))"
                    min="0" max="5" step="0.1" class="flex-grow" />
                <input type="number" :value="item.infillOptions.outlineOffset"
                    @change="$emit('update-offset', Number(($event.target as HTMLInputElement).value))"
                    min="0" max="5" step="0.1"
                    class="w-14 ml-2 p-1 text-xs border border-slate-500 rounded bg-slate-600 text-white text-right" />
                <span class="text-xs text-slate-400 ml-1">mm</span>
            </div>

            <!-- Action Buttons -->
            <div class="flex justify-end space-x-2 pt-2">
                <button @click="$emit('remove-infill')"
                    :disabled="isGeneratingInfill || isOptimizingInfill"
                    class="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    Löschen
                </button>
                <button @click="$emit('generate-preview')"
                    :disabled="isGeneratingInfill || isOptimizingInfill"
                    class="px-3 py-1 text-xs rounded transition-colors whitespace-nowrap"
                    :class="isGeneratingInfill
                        ? 'bg-yellow-600 text-yellow-100 cursor-wait'
                        : 'bg-green-600 text-white hover:bg-green-700'">
                    <template v-if="isGeneratingInfill">
                        <svg class="inline-block w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
                        Generiere...
                    </template>
                    <template v-else>
                        Generieren
                    </template>
                </button>
                <!-- Optimieren Button (nur wenn Infill vorhanden) -->
                <button v-if="item.infillGroup"
                    @click="$emit('optimize-infill')"
                    :disabled="isOptimizingInfill || isGeneratingInfill || item.infillStats?.isOptimized"
                    class="px-3 py-1 text-xs rounded transition-colors whitespace-nowrap"
                    :class="isOptimizingInfill
                        ? 'bg-yellow-600 text-yellow-100 cursor-wait'
                        : item.infillStats?.isOptimized
                            ? 'bg-blue-800 text-blue-300 cursor-default'
                            : 'bg-blue-600 text-white hover:bg-blue-500'">
                    <template v-if="isOptimizingInfill">
                        <svg class="inline-block w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
                        Optimiere...
                    </template>
                    <template v-else>
                        {{ item.infillStats?.isOptimized ? 'Optimiert ✓' : 'Optimieren' }}
                    </template>
                </button>
            </div>
            <!-- Infill Stats (nur wenn Infill vorhanden) -->
            <div v-if="item.infillGroup && item.infillStats && !isGeneratingInfill"
                class="flex items-center justify-end space-x-3 pt-1 text-xs text-slate-400">
                <span>{{ item.infillStats.numSegments }} Linien</span>
                <span :class="item.infillStats.isOptimized ? 'text-green-400' : 'text-orange-400'">
                    {{ item.infillStats.travelLengthMm }}mm Travel
                </span>
            </div>
            </div> <!-- End of File-level Infill conditional -->
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Group } from 'three';
import { InfillPatternType, patternDensityRanges } from '../utils/threejs_services';
import { useMainStore, type ColorGroup, type InfillStats } from '../store';
import type { PathAnalysisResult, PathInfo, PathRole } from '../utils/geometry/path-analysis';
import { getEffectiveRole } from '../utils/geometry/path-analysis';
import { penTypes } from '../utils/gcode_services';
import ToolSelect from './ToolSelect.vue';
import ColorRow from './ColorRow.vue';

const store = useMainStore();

// ToolConfig Interface (gleiche Struktur wie in gcode_services)
interface ToolConfig {
    penType: string;
    color: string;
}

const props = defineProps<{
    item: {
        fileName: string;
        toolNumber: number;
        feedrate: number;
        infillToolNumber: number;
        infillOptions: {
            patternType: string;
            density: number;
            angle: number;
            outlineOffset: number;
        };
        infillGroup?: Group;
        infillStats?: InfillStats;
        // Farb-Analyse
        colorGroups: ColorGroup[];
        isAnalyzed: boolean;
        // Path-Analyse (Hole Detection)
        pathAnalysis?: PathAnalysisResult;
        isPathAnalyzed: boolean;
        // Platzierung
        offsetX: number;
        offsetY: number;
        workpieceStartId?: string;
        // DPI-Skalierung
        dpi: number;
        // Geometrie für Abmessungen
        geometry: Group;
    };
    itemIndex: number;
    toolConfigs: ToolConfig[];
    isFirst: boolean;
    isLast: boolean;
}>();

// Check if file-level infill is currently being generated for this item
const isGeneratingInfill = computed(() => {
    const gen = store.infillGenerating;
    return gen !== null && gen.svgIndex === props.itemIndex && gen.colorIndex === null;
});

// Check if file-level infill is currently being optimized for this item
const isOptimizingInfill = computed(() => {
    const opt = store.infillOptimizing;
    return opt !== null && opt.svgIndex === props.itemIndex && opt.colorIndex === null;
});

// Berechne Abmessungen aus der Geometrie
// Nutze item.dpi als Trigger für Reaktivität
const dimensions = computed(() => {
    const geo = props.item.geometry;
    const _dpi = props.item.dpi; // Reaktivitäts-Trigger
    void _dpi; // Unused variable warning vermeiden

    if (!geo || !geo.userData) return { width: 0, height: 0 };

    const { minX, maxX, minY, maxY } = geo.userData;
    if (minX === undefined || maxX === undefined) return { width: 0, height: 0 };

    return {
        width: Math.abs(maxX - minX),
        height: Math.abs(maxY - minY)
    };
});

const expanded = ref(false);
const pathDetailsExpanded = ref(false);
const colorsExpanded = ref(true); // Colors section expanded by default
const fileSettingsExpanded = ref(false); // File settings collapsed by default
const patternTypes = Object.values(InfillPatternType);

const densityRange = computed(() => {
    const pt = props.item.infillOptions.patternType as InfillPatternType;
    return patternDensityRanges[pt] || patternDensityRanges[InfillPatternType.LINES];
});

// Check if all colors are visible (for file-level eye icon)
const allColorsVisible = computed(() => {
    if (!props.item.isAnalyzed || props.item.colorGroups.length === 0) return true;
    return props.item.colorGroups.every(cg => cg.visible);
});

// Get pen width for a color group (considers file defaults)
function getPenWidthForColor(colorGroup: ColorGroup): number {
    const effectiveTool = colorGroup.useFileDefaults
        ? props.item.toolNumber
        : colorGroup.toolNumber;
    const toolConfig = props.toolConfigs[effectiveTool - 1];
    if (toolConfig && penTypes[toolConfig.penType]) {
        return penTypes[toolConfig.penType].width ?? 0.5;
    }
    return 0.5; // Default fallback
}

// Helper function to get path role
function getPathRole(path: PathInfo): PathRole {
    return getEffectiveRole(path);
}

// Emit helper for path role change
const emit = defineEmits<{
    (e: 'move-up'): void;
    (e: 'move-down'): void;
    (e: 'remove'): void;
    (e: 'update-tool', value: number): void;
    (e: 'update-feedrate', value: number): void;
    (e: 'update-pattern', value: string): void;
    (e: 'update-infill-tool', value: number): void;
    (e: 'update-density', value: number): void;
    (e: 'update-angle', value: number): void;
    (e: 'update-offset', value: number): void;
    (e: 'remove-infill'): void;
    (e: 'generate-preview'): void;
    (e: 'optimize-infill'): void;
    (e: 'analyze'): void;
    (e: 'set-path-role', pathId: string, role: PathRole | null): void;
    (e: 'update-workpiece-start', value: string | undefined): void;
    (e: 'update-dpi', value: number): void;
    (e: 'apply-to-all-colors'): void;
    (e: 'toggle-file-visibility'): void;
}>();

function handlePathRoleChange(path: PathInfo, value: string) {
    const role = value as PathRole;
    // If the selected value equals the auto-detected role, reset to null (auto)
    emit('set-path-role', path.id, role === path.autoDetectedRole ? null : role);
}
</script>
