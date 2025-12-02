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
                        {{ ws.name }} ({{ ws.x }}, {{ ws.y }})
                    </option>
                </select>
            </div>

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

            <!-- Farb-Analyse Status -->
            <div class="flex items-center justify-between">
                <!-- Mini-Farbübersicht wenn analysiert -->
                <div v-if="item.isAnalyzed" class="flex items-center space-x-1">
                    <span class="text-xs text-slate-400 mr-1">Farben:</span>
                    <div v-for="(colorGroup, idx) in item.colorGroups.slice(0, 5)" :key="idx"
                        class="w-4 h-4 rounded border border-slate-500"
                        :style="{ backgroundColor: colorGroup.color }"
                        :title="`${colorGroup.color} (Tool ${colorGroup.toolNumber})`">
                    </div>
                    <span v-if="item.colorGroups.length > 5" class="text-xs text-slate-400">
                        +{{ item.colorGroups.length - 5 }}
                    </span>
                </div>
                <div v-else class="text-xs text-slate-400">
                    Farben nicht analysiert
                </div>

                <!-- Analyse Button -->
                <button v-if="!item.isAnalyzed"
                    @click="$emit('analyze')"
                    class="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">
                    Analysieren
                </button>
                <span v-else class="text-xs text-green-400">
                    ✓ {{ item.colorGroups.length }} Farben
                </span>
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
                <button @click="pathDetailsExpanded = !pathDetailsExpanded"
                    class="px-2 py-1 text-xs bg-slate-600 text-white rounded hover:bg-slate-500">
                    {{ pathDetailsExpanded ? 'Ausblenden' : 'Details' }}
                </button>
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

        <!-- Infill Options (Expandable) -->
        <div v-if="expanded" class="p-3 bg-slate-700/50 border-t border-slate-600 space-y-3 rounded-b-lg">
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
                    class="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700">
                    Infill löschen
                </button>
                <button @click="$emit('generate-preview')"
                    class="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700">
                    Generieren
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Group } from 'three';
import { InfillPatternType, patternDensityRanges } from '../utils/threejs_services';
import { useMainStore, type ColorGroup } from '../store';
import type { PathAnalysisResult, PathInfo, PathRole } from '../utils/geometry/path-analysis';
import { getEffectiveRole } from '../utils/geometry/path-analysis';
import ToolSelect from './ToolSelect.vue';

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
    toolConfigs: ToolConfig[];
    isFirst: boolean;
    isLast: boolean;
}>();

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
const patternTypes = Object.values(InfillPatternType);

const densityRange = computed(() => {
    const pt = props.item.infillOptions.patternType as InfillPatternType;
    return patternDensityRanges[pt] || patternDensityRanges[InfillPatternType.LINES];
});

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
    (e: 'analyze'): void;
    (e: 'set-path-role', pathId: string, role: PathRole | null): void;
    (e: 'update-workpiece-start', value: string | undefined): void;
    (e: 'update-dpi', value: number): void;
}>();

function handlePathRoleChange(path: PathInfo, value: string) {
    const role = value as PathRole;
    // If the selected value equals the auto-detected role, reset to null (auto)
    emit('set-path-role', path.id, role === path.autoDetectedRole ? null : role);
}
</script>
