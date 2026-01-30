<template>
    <div class="bg-slate-700 rounded p-2">
        <!-- Collapsed Header: Position, Eye, Color swatch, Name, Stats, Arrows, Expand -->
        <div class="flex items-center space-x-2 cursor-pointer hover:bg-slate-600/30 -m-2 p-2 rounded transition-colors"
            @click="expanded = !expanded">
            <!-- Position Number -->
            <span class="text-xs text-slate-500 w-4 text-center shrink-0">{{ colorIndex + 1 }}.</span>

            <!-- Visibility Toggle -->
            <button @click.stop="$emit('toggle-visibility')"
                class="w-5 h-5 flex items-center justify-center text-xs rounded shrink-0"
                :class="colorGroup.visible ? 'bg-green-600 text-white' : 'bg-slate-600 text-slate-400'"
                :title="colorGroup.visible ? 'Sichtbar' : 'Versteckt'">
                {{ colorGroup.visible ? '✓' : '○' }}
            </button>

            <!-- Outlines Toggle (nur wenn visible) -->
            <button v-if="colorGroup.visible"
                @click.stop="$emit('toggle-outlines')"
                class="w-5 h-5 flex items-center justify-center text-xs rounded shrink-0"
                :class="colorGroup.showOutlines ? 'bg-blue-600 text-white' : 'bg-slate-600 text-slate-400'"
                :title="colorGroup.showOutlines ? 'Konturen sichtbar' : 'Nur Infill'">
                {{ colorGroup.showOutlines ? '▢' : '▣' }}
            </button>

            <!-- Color Swatch -->
            <div class="w-6 h-6 rounded border border-slate-500 shrink-0"
                :style="{ backgroundColor: colorGroup.color }"
                :title="colorGroup.color">
            </div>

            <!-- Color Code and Line Count -->
            <div class="flex-grow min-w-0">
                <div class="text-xs text-white font-mono truncate">{{ colorGroup.color }}</div>
                <div class="text-xs text-slate-400">{{ colorGroup.lineCount }} Linien</div>
            </div>

            <!-- Reorder Buttons -->
            <div class="flex items-center space-x-0.5 shrink-0" @click.stop>
                <button @click="$emit('move-up')"
                    :disabled="isFirst"
                    class="p-0.5 rounded text-slate-400 hover:bg-slate-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Nach oben">
                    <span class="text-xs">↑</span>
                </button>
                <button @click="$emit('move-down')"
                    :disabled="isLast"
                    class="p-0.5 rounded text-slate-400 hover:bg-slate-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Nach unten">
                    <span class="text-xs">↓</span>
                </button>
            </div>

            <!-- Expand/Collapse Indicator -->
            <div class="p-1 text-slate-300 transition-transform duration-200"
                :class="{ 'rotate-180': !expanded }">
                ▼
            </div>
        </div>

        <!-- Expanded Settings -->
        <div v-if="expanded" class="mt-2 space-y-2 border-t border-slate-600 pt-2">
            <!-- Tool Selection with Inheritance Indicator -->
            <div class="flex items-center space-x-2">
                <label class="text-xs text-slate-400 w-12">Tool:</label>
                <ToolSelect
                    :model-value="effectiveTool"
                    :tool-configs="toolConfigs"
                    :disabled="colorGroup.useFileDefaults"
                    :class="{ 'opacity-60': colorGroup.useFileDefaults }"
                    @update:model-value="handleToolChange"
                    button-class="flex-grow"
                />
                <button @click="$emit('toggle-use-defaults')"
                    class="text-xs px-2 py-1 rounded whitespace-nowrap transition-colors"
                    :class="colorGroup.useFileDefaults
                        ? 'bg-green-600/30 text-green-300 hover:bg-green-600/50'
                        : 'bg-slate-600 text-slate-300 hover:bg-slate-500'">
                    {{ colorGroup.useFileDefaults ? '🔗 File' : '✏️ Custom' }}
                </button>
            </div>

            <!-- Infill Toggle -->
            <div class="flex items-center space-x-2">
                <button @click="$emit('toggle-infill')"
                    class="px-2 py-1 text-xs rounded transition-colors"
                    :class="colorGroup.infillEnabled ? 'bg-blue-600 text-white' : 'bg-slate-600 text-slate-400 hover:bg-slate-500'">
                    {{ colorGroup.infillEnabled ? 'Infill ✓' : 'Infill' }}
                </button>

                <!-- Infill Tool (only when enabled) -->
                <template v-if="colorGroup.infillEnabled">
                    <label class="text-xs text-slate-400">I:</label>
                    <ToolSelect
                        :model-value="effectiveInfillTool"
                        :tool-configs="toolConfigs"
                        :disabled="colorGroup.useFileDefaults"
                        :class="{ 'opacity-60': colorGroup.useFileDefaults }"
                        @update:model-value="handleInfillToolChange"
                    />

                    <!-- Pattern Dropdown -->
                    <select :value="colorGroup.infillOptions.patternType"
                        @change="$emit('update-pattern', ($event.target as HTMLSelectElement).value)"
                        class="flex-grow p-1 text-xs border border-slate-600 rounded bg-slate-600 text-white min-w-0">
                        <option v-for="pt in patternTypes" :key="pt.value" :value="pt.value">
                            {{ pt.label }}
                        </option>
                    </select>
                </template>
            </div>

            <!-- Infill Actions (only when enabled) -->
            <div v-if="colorGroup.infillEnabled" class="flex items-center space-x-2">
                <!-- Generate Button -->
                <button @click="$emit('generate-infill')"
                    :disabled="isGenerating || isOptimizing"
                    class="px-2 py-1 text-xs rounded transition-colors whitespace-nowrap"
                    :class="isGenerating
                        ? 'bg-yellow-600 text-yellow-100 cursor-wait'
                        : colorGroup.infillGroup
                            ? 'bg-green-700 text-green-200 hover:bg-green-600'
                            : 'bg-green-600 text-white hover:bg-green-500'">
                    <template v-if="isGenerating">
                        <svg class="inline-block w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
                        Generiere...
                    </template>
                    <template v-else>
                        {{ colorGroup.infillGroup ? 'Neu' : 'Generieren' }}
                    </template>
                </button>

                <!-- Optimize Button (only if generated) -->
                <button v-if="colorGroup.infillGroup && !isGenerating"
                    @click="$emit('optimize-infill')"
                    :disabled="isOptimizing || colorGroup.infillStats?.isOptimized"
                    class="px-2 py-1 text-xs rounded transition-colors whitespace-nowrap"
                    :class="isOptimizing
                        ? 'bg-yellow-600 text-yellow-100 cursor-wait'
                        : colorGroup.infillStats?.isOptimized
                            ? 'bg-blue-800 text-blue-300 cursor-default'
                            : 'bg-blue-600 text-white hover:bg-blue-500'">
                    <template v-if="isOptimizing">
                        <svg class="inline-block w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
                        Optimiere...
                    </template>
                    <template v-else>
                        {{ colorGroup.infillStats?.isOptimized ? 'Optimiert ✓' : 'Optimieren' }}
                    </template>
                </button>

                <!-- Delete Button -->
                <button v-if="colorGroup.infillGroup && !isGenerating && !isOptimizing"
                    @click="$emit('delete-infill')"
                    class="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-500 transition-colors"
                    title="Infill löschen">
                    ✕
                </button>
            </div>

            <!-- Infill Stats (only if generated) -->
            <div v-if="colorGroup.infillGroup && colorGroup.infillStats && !isGenerating"
                class="flex items-center space-x-3 text-xs text-slate-400">
                <span>{{ colorGroup.infillStats.numSegments }} Linien</span>
                <span :class="colorGroup.infillStats.isOptimized ? 'text-green-400' : 'text-orange-400'">
                    {{ colorGroup.infillStats.travelLengthMm }}mm Travel
                </span>
                <span :class="colorGroup.infillStats.isOptimized ? 'text-green-400' : 'text-slate-400'">
                    {{ colorGroup.infillStats.numPenLifts }} Pen-Lifts
                </span>
            </div>

            <!-- Advanced Infill Options (collapsible) -->
            <div v-if="colorGroup.infillEnabled" class="pt-1">
                <button @click="advancedExpanded = !advancedExpanded"
                    class="w-full text-xs text-slate-400 hover:text-slate-300 transition-colors">
                    {{ advancedExpanded ? '▲ Weniger' : '▼ Mehr Optionen' }}
                </button>

                <div v-if="advancedExpanded" class="space-y-2 pt-2">
                    <!-- Density -->
                    <div class="flex items-center space-x-2">
                        <label class="w-14 text-xs text-slate-400">Dichte:</label>
                        <input type="range"
                            :value="colorGroup.infillOptions.density"
                            @input="$emit('update-density', Number(($event.target as HTMLInputElement).value))"
                            min="0.1" max="20" step="0.1"
                            class="flex-grow h-1 bg-slate-600 rounded appearance-none cursor-pointer" />
                        <input type="number"
                            :value="colorGroup.infillOptions.density"
                            @change="$emit('update-density', Number(($event.target as HTMLInputElement).value))"
                            min="0.1" max="100" step="0.1"
                            class="w-14 px-1 py-0.5 text-xs text-right text-slate-300 bg-slate-600 border border-slate-500 rounded" />
                        <span class="text-xs text-slate-400">mm</span>
                    </div>

                    <!-- Angle -->
                    <div class="flex items-center space-x-2">
                        <label class="w-14 text-xs text-slate-400">Winkel:</label>
                        <input type="range"
                            :value="colorGroup.infillOptions.angle"
                            @input="$emit('update-angle', Number(($event.target as HTMLInputElement).value))"
                            min="0" max="180" step="1"
                            class="flex-grow h-1 bg-slate-600 rounded appearance-none cursor-pointer" />
                        <input type="number"
                            :value="colorGroup.infillOptions.angle"
                            @change="$emit('update-angle', Number(($event.target as HTMLInputElement).value))"
                            min="0" max="360" step="1"
                            class="w-14 px-1 py-0.5 text-xs text-right text-slate-300 bg-slate-600 border border-slate-500 rounded" />
                        <span class="text-xs text-slate-400">°</span>
                    </div>

                    <!-- Outline Offset -->
                    <div class="flex items-center space-x-2">
                        <label class="w-14 text-xs text-slate-400">Rand:</label>
                        <input type="range"
                            :value="colorGroup.infillOptions.outlineOffset"
                            @input="$emit('update-outline-offset', Number(($event.target as HTMLInputElement).value))"
                            min="0" max="10" step="0.1"
                            class="flex-grow h-1 bg-slate-600 rounded appearance-none cursor-pointer" />
                        <input type="number"
                            :value="colorGroup.infillOptions.outlineOffset"
                            @change="$emit('update-outline-offset', Number(($event.target as HTMLInputElement).value))"
                            min="0" max="50" step="0.1"
                            class="w-14 px-1 py-0.5 text-xs text-right text-slate-300 bg-slate-600 border border-slate-500 rounded" />
                        <span class="text-xs text-slate-400">mm</span>
                    </div>
                </div>

                <!-- Contour Offset Section (separate from infill) -->
                <div class="pt-2 mt-2 border-t border-slate-600">
                    <div class="flex items-center space-x-2">
                        <label class="w-14 text-xs text-slate-400">Kontur:</label>
                        <select :value="colorGroup.drawingMode"
                            @change="$emit('update-drawing-mode', ($event.target as HTMLSelectElement).value as DrawingMode)"
                            class="flex-grow p-1 text-xs border border-slate-600 rounded bg-slate-600 text-white">
                            <option v-for="mode in drawingModes" :key="mode.value" :value="mode.value">
                                {{ mode.label }}
                            </option>
                        </select>
                        <span v-if="colorGroup.drawingMode !== 'center'" class="text-xs text-slate-400">
                            {{ effectiveOffset.toFixed(1) }}mm
                        </span>
                    </div>

                    <!-- Custom Offset (nur wenn nicht 'center') -->
                    <div v-if="colorGroup.drawingMode !== 'center'" class="flex items-center space-x-2 mt-2">
                        <label class="w-14 text-xs text-slate-400">Offset:</label>
                        <button @click="toggleCustomOffset"
                            class="px-2 py-0.5 text-xs rounded transition-colors"
                            :class="useCustomOffset
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-600 text-slate-300 hover:bg-slate-500'">
                            {{ useCustomOffset ? 'Custom' : 'Auto' }}
                        </button>
                        <template v-if="useCustomOffset">
                            <input type="range"
                                :value="colorGroup.customOffset ?? penWidth / 2"
                                @input="$emit('update-custom-offset', Number(($event.target as HTMLInputElement).value))"
                                min="0" max="5" step="0.1"
                                class="flex-grow h-1 bg-slate-600 rounded appearance-none cursor-pointer" />
                            <input type="number"
                                :value="colorGroup.customOffset ?? penWidth / 2"
                                @change="$emit('update-custom-offset', Number(($event.target as HTMLInputElement).value))"
                                min="0" max="10" step="0.1"
                                class="w-14 px-1 py-0.5 text-xs text-right text-slate-300 bg-slate-600 border border-slate-500 rounded" />
                            <span class="text-xs text-slate-400">mm</span>
                        </template>
                        <span v-else class="text-xs text-slate-500">
                            (Stiftbreite/2 = {{ (penWidth / 2).toFixed(2) }}mm)
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { ColorGroup, DrawingMode } from '../store';
import { InfillPatternType } from '../utils/threejs_services';
import ToolSelect from './ToolSelect.vue';

interface ToolConfig {
    penType: string;
    color: string;
}

const props = defineProps<{
    colorGroup: ColorGroup;
    itemIndex: number;
    colorIndex: number;
    fileTool: number;
    fileInfillTool: number;
    toolConfigs: ToolConfig[];
    isGenerating: boolean;
    isOptimizing: boolean;
    isFirst: boolean;
    isLast: boolean;
    penWidth: number;  // Stiftbreite des aktuellen Tools in mm
}>();

const emit = defineEmits<{
    (e: 'toggle-visibility'): void;
    (e: 'toggle-outlines'): void;
    (e: 'toggle-use-defaults'): void;
    (e: 'update-tool', value: number): void;
    (e: 'toggle-infill'): void;
    (e: 'update-infill-tool', value: number): void;
    (e: 'update-pattern', value: string): void;
    (e: 'generate-infill'): void;
    (e: 'optimize-infill'): void;
    (e: 'delete-infill'): void;
    (e: 'update-density', value: number): void;
    (e: 'update-angle', value: number): void;
    (e: 'update-outline-offset', value: number): void;
    (e: 'update-drawing-mode', value: DrawingMode): void;
    (e: 'update-custom-offset', value: number | undefined): void;
    (e: 'move-up'): void;
    (e: 'move-down'): void;
}>();

const expanded = ref(false);
const advancedExpanded = ref(false);

// Pattern types for dropdown
const patternTypes = [
    { value: InfillPatternType.NONE, label: 'Kein Infill' },
    { value: InfillPatternType.LINES, label: 'Linien' },
    { value: InfillPatternType.GRID, label: 'Gitter' },
    { value: InfillPatternType.HONEYCOMB, label: 'Waben' },
    { value: InfillPatternType.CONCENTRIC, label: 'Konzentrisch' },
    { value: InfillPatternType.CROSSHATCH, label: 'Kreuzschraffur' },
    { value: InfillPatternType.ZIGZAG, label: 'Zickzack' },
];

// Drawing modes for contour offset
const drawingModes = [
    { value: 'center' as DrawingMode, label: 'Mitte' },
    { value: 'inside' as DrawingMode, label: 'Innen' },
    { value: 'outside' as DrawingMode, label: 'Außen' },
];

// Use custom offset toggle
const useCustomOffset = ref(props.colorGroup.customOffset !== undefined);

// Computed effective offset (auto = penWidth / 2)
const effectiveOffset = computed(() => {
    if (props.colorGroup.customOffset !== undefined) {
        return props.colorGroup.customOffset;
    }
    return props.penWidth / 2;
});

// Effective tool (file or custom)
const effectiveTool = computed(() => {
    return props.colorGroup.useFileDefaults
        ? props.fileTool
        : props.colorGroup.toolNumber;
});

// Effective infill tool (file or custom)
const effectiveInfillTool = computed(() => {
    return props.colorGroup.useFileDefaults
        ? props.fileInfillTool
        : props.colorGroup.infillToolNumber;
});

// Handle tool change - automatically disable useFileDefaults if user changes tool
function handleToolChange(newTool: number) {
    emit('update-tool', newTool);
    // If currently using defaults, disable them when user makes a custom change
    if (props.colorGroup.useFileDefaults) {
        emit('toggle-use-defaults');
    }
}

// Handle infill tool change
function handleInfillToolChange(newTool: number) {
    emit('update-infill-tool', newTool);
    // If currently using defaults, disable them when user makes a custom change
    if (props.colorGroup.useFileDefaults) {
        emit('toggle-use-defaults');
    }
}

// Toggle custom offset on/off
function toggleCustomOffset() {
    useCustomOffset.value = !useCustomOffset.value;
    if (useCustomOffset.value) {
        // Aktivieren: Starte mit pen width / 2 als Standardwert
        emit('update-custom-offset', props.penWidth / 2);
    } else {
        // Deaktivieren: Auf undefined setzen (Auto-Modus)
        emit('update-custom-offset', undefined);
    }
}
</script>
