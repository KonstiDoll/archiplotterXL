<template>
    <div class="bg-slate-800 p-3 rounded-lg">
        <h3 class="text-white text-sm font-semibold mb-3 text-center">Farb-Zuordnung</h3>

        <!-- Info wenn keine SVGs geladen -->
        <div v-if="store.svgItems.length === 0" class="text-xs text-slate-400 text-center p-2">
            Keine SVGs geladen
        </div>

        <!-- SVG Auswahl wenn mehrere vorhanden -->
        <div v-else>
            <div v-if="store.svgItems.length > 1" class="mb-3">
                <select v-model="selectedSvgIndex"
                    class="w-full p-2 text-sm border border-slate-600 rounded bg-slate-700 text-white">
                    <option v-for="(item, idx) in store.svgItems" :key="idx" :value="idx">
                        {{ item.fileName }}
                    </option>
                </select>
            </div>

            <!-- Analyse-Status und Button -->
            <div v-if="selectedItem" class="space-y-3">
                <!-- Nicht analysiert -->
                <div v-if="!selectedItem.isAnalyzed" class="text-center">
                    <button @click="analyzeCurrentSvg"
                        class="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors">
                        Farben analysieren
                    </button>
                    <div class="text-xs text-slate-400 mt-2">
                        Analysiert die Farben im SVG (Stroke und Fill)
                    </div>
                </div>

                <!-- Analysiert - Farbliste -->
                <div v-else class="space-y-2">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-xs text-slate-400">
                            {{ selectedItem.colorGroups.length }} Farben gefunden
                        </span>
                        <button @click="resetAnalysis"
                            class="text-xs text-red-400 hover:text-red-300">
                            Zurücksetzen
                        </button>
                    </div>

                    <!-- Farb-Liste -->
                    <div v-for="(colorGroup, colorIdx) in selectedItem.colorGroups" :key="colorIdx"
                        class="p-2 bg-slate-700 rounded space-y-2">

                        <!-- Zeile 1: Sichtbarkeit, Farbe, Infos, Kontur-Tool -->
                        <div class="flex items-center space-x-2">
                            <!-- Sichtbarkeits-Toggle -->
                            <button @click="toggleVisibility(colorIdx)"
                                class="w-5 h-5 flex items-center justify-center text-xs rounded"
                                :class="colorGroup.visible ? 'bg-green-600 text-white' : 'bg-slate-600 text-slate-400'">
                                {{ colorGroup.visible ? '✓' : '○' }}
                            </button>

                            <!-- Farbfeld -->
                            <div class="w-6 h-6 rounded border border-slate-500 shrink-0"
                                :style="{ backgroundColor: colorGroup.color }"
                                :title="colorGroup.color">
                            </div>

                            <!-- Farb-Code und Linien-Anzahl -->
                            <div class="flex-grow min-w-0">
                                <div class="text-xs text-white font-mono truncate">{{ colorGroup.color }}</div>
                                <div class="text-xs text-slate-400">{{ colorGroup.lineCount }} Linien</div>
                            </div>

                            <!-- Kontur-Tool -->
                            <div class="flex items-center space-x-1">
                                <span class="text-xs text-slate-400">K:</span>
                                <ToolSelect
                                    :model-value="colorGroup.toolNumber"
                                    :tool-configs="props.toolConfigs"
                                    @update:model-value="(v: number) => setColorTool(colorIdx, v)"
                                />
                            </div>
                        </div>

                        <!-- Zeile 2: Infill-Einstellungen -->
                        <div class="flex items-center space-x-2 pt-1 border-t border-slate-600">
                            <!-- Infill Toggle -->
                            <button @click="toggleInfill(colorIdx)"
                                class="px-2 py-1 text-xs rounded transition-colors"
                                :class="colorGroup.infillEnabled ? 'bg-blue-600 text-white' : 'bg-slate-600 text-slate-400 hover:bg-slate-500'">
                                {{ colorGroup.infillEnabled ? 'Infill ✓' : 'Infill' }}
                            </button>

                            <!-- Infill-Optionen (nur wenn aktiviert) -->
                            <template v-if="colorGroup.infillEnabled">
                                <!-- Infill-Tool -->
                                <div class="flex items-center space-x-1">
                                    <span class="text-xs text-slate-400">I:</span>
                                    <ToolSelect
                                        :model-value="colorGroup.infillToolNumber"
                                        :tool-configs="props.toolConfigs"
                                        @update:model-value="(v: number) => setInfillTool(colorIdx, v)"
                                    />
                                </div>

                                <!-- Pattern-Dropdown -->
                                <select :value="colorGroup.infillOptions.patternType"
                                    @change="setInfillPattern(colorIdx, ($event.target as HTMLSelectElement).value as any)"
                                    class="flex-grow p-1 text-xs border border-slate-600 rounded bg-slate-600 text-white min-w-0">
                                    <option v-for="pt in patternTypes" :key="pt.value" :value="pt.value">
                                        {{ pt.label }}
                                    </option>
                                </select>
                            </template>
                        </div>

                        <!-- Zeile 2b: Generate/Optimize/Delete Buttons (nur wenn Infill aktiviert) -->
                        <div v-if="colorGroup.infillEnabled" class="flex items-center space-x-2 pt-1">
                            <!-- Generieren Button -->
                            <button @click="generateInfill(colorIdx)"
                                :disabled="isGenerating(colorIdx) || isOptimizing(colorIdx)"
                                class="px-2 py-1 text-xs rounded transition-colors whitespace-nowrap"
                                :class="isGenerating(colorIdx)
                                    ? isGeneratingRunning(colorIdx)
                                        ? 'bg-yellow-600 text-yellow-100 cursor-wait'
                                        : 'bg-yellow-800 text-yellow-200 cursor-wait'
                                    : colorGroup.infillGroup
                                        ? 'bg-green-700 text-green-200 hover:bg-green-600'
                                        : 'bg-green-600 text-white hover:bg-green-500'">
                                <template v-if="isGenerating(colorIdx)">
                                    <svg class="inline-block w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                    </svg>
                                    {{ isGeneratingRunning(colorIdx) ? 'Generiere...' : 'Wartend' }}
                                </template>
                                <template v-else>
                                    {{ colorGroup.infillGroup ? 'Neu' : 'Generieren' }}
                                </template>
                            </button>
                            <!-- Optimieren Button (nur wenn Infill generiert und nicht optimiert) -->
                            <button v-if="colorGroup.infillGroup && !isGenerating(colorIdx)"
                                @click="optimizeInfill(colorIdx)"
                                :disabled="isOptimizing(colorIdx) || colorGroup.infillStats?.isOptimized"
                                class="px-2 py-1 text-xs rounded transition-colors whitespace-nowrap"
                                :class="isOptimizing(colorIdx)
                                    ? isRunning(colorIdx)
                                        ? 'bg-yellow-600 text-yellow-100 cursor-wait'
                                        : 'bg-yellow-800 text-yellow-200 cursor-wait'
                                    : colorGroup.infillStats?.isOptimized
                                        ? 'bg-blue-800 text-blue-300 cursor-default'
                                        : 'bg-blue-600 text-white hover:bg-blue-500'">
                                <template v-if="isOptimizing(colorIdx)">
                                    <svg class="inline-block w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                    </svg>
                                    {{ isRunning(colorIdx) ? 'Optimiere...' : 'Wartend' }}
                                </template>
                                <template v-else>
                                    {{ colorGroup.infillStats?.isOptimized ? 'Optimiert ✓' : 'Optimieren' }}
                                </template>
                            </button>
                            <!-- Löschen Button -->
                            <button v-if="colorGroup.infillGroup && !isGenerating(colorIdx) && !isOptimizing(colorIdx)"
                                @click="deleteInfill(colorIdx)"
                                class="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-500 transition-colors"
                                title="Infill löschen">
                                ✕
                            </button>
                        </div>
                        <!-- Zeile 2c: Infill Stats (nur wenn Infill generiert) -->
                        <div v-if="colorGroup.infillGroup && colorGroup.infillStats && !isGenerating(colorIdx)"
                            class="flex items-center space-x-3 pt-1 text-xs text-slate-400">
                            <span>{{ colorGroup.infillStats.numSegments }} Linien</span>
                            <span :class="colorGroup.infillStats.isOptimized ? 'text-green-400' : 'text-orange-400'">
                                {{ colorGroup.infillStats.travelLengthMm }}mm Travel
                            </span>
                        </div>

                        <!-- Zeile 3: Erweiterte Optionen (expandierbar) -->
                        <div v-if="colorGroup.infillEnabled && expandedColorIdx === colorIdx"
                            class="space-y-2 pt-1 border-t border-slate-600">
                            <!-- Dichte -->
                            <div class="flex items-center space-x-2">
                                <label class="w-14 text-xs text-slate-400">Dichte:</label>
                                <input type="range"
                                    :value="colorGroup.infillOptions.density"
                                    @input="updateInfillDensity(colorIdx, Number(($event.target as HTMLInputElement).value))"
                                    min="0.1" max="20" step="0.1"
                                    class="flex-grow h-1 bg-slate-600 rounded appearance-none cursor-pointer" />
                                <input type="number"
                                    :value="colorGroup.infillOptions.density"
                                    @change="updateInfillDensity(colorIdx, Number(($event.target as HTMLInputElement).value))"
                                    min="0.1" max="100" step="0.1"
                                    class="w-14 px-1 py-0.5 text-xs text-right text-slate-300 bg-slate-600 border border-slate-500 rounded" />
                                <span class="text-xs text-slate-400">mm</span>
                            </div>
                            <!-- Winkel -->
                            <div class="flex items-center space-x-2">
                                <label class="w-14 text-xs text-slate-400">Winkel:</label>
                                <input type="range"
                                    :value="colorGroup.infillOptions.angle"
                                    @input="updateInfillAngle(colorIdx, Number(($event.target as HTMLInputElement).value))"
                                    min="0" max="180" step="1"
                                    class="flex-grow h-1 bg-slate-600 rounded appearance-none cursor-pointer" />
                                <input type="number"
                                    :value="colorGroup.infillOptions.angle"
                                    @change="updateInfillAngle(colorIdx, Number(($event.target as HTMLInputElement).value))"
                                    min="0" max="360" step="1"
                                    class="w-14 px-1 py-0.5 text-xs text-right text-slate-300 bg-slate-600 border border-slate-500 rounded" />
                                <span class="text-xs text-slate-400">°</span>
                            </div>
                            <!-- Rand (Outline Offset) -->
                            <div class="flex items-center space-x-2">
                                <label class="w-14 text-xs text-slate-400">Rand:</label>
                                <input type="range"
                                    :value="colorGroup.infillOptions.outlineOffset"
                                    @input="updateInfillOutlineOffset(colorIdx, Number(($event.target as HTMLInputElement).value))"
                                    min="0" max="10" step="0.1"
                                    class="flex-grow h-1 bg-slate-600 rounded appearance-none cursor-pointer" />
                                <input type="number"
                                    :value="colorGroup.infillOptions.outlineOffset"
                                    @change="updateInfillOutlineOffset(colorIdx, Number(($event.target as HTMLInputElement).value))"
                                    min="0" max="50" step="0.1"
                                    class="w-14 px-1 py-0.5 text-xs text-right text-slate-300 bg-slate-600 border border-slate-500 rounded" />
                                <span class="text-xs text-slate-400">mm</span>
                            </div>
                        </div>

                        <!-- Mehr Optionen Button -->
                        <button v-if="colorGroup.infillEnabled"
                            @click="toggleExpandedOptions(colorIdx)"
                            class="w-full text-xs text-slate-400 hover:text-slate-300 py-1 transition-colors">
                            {{ expandedColorIdx === colorIdx ? '▲ Weniger' : '▼ Mehr Optionen' }}
                        </button>
                    </div>

                    <!-- Quick-Actions -->
                    <div class="flex space-x-2 pt-2">
                        <button @click="setAllToTool(1)"
                            class="flex-1 px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded hover:bg-slate-600">
                            Alle → T1
                        </button>
                        <button @click="autoAssignTools"
                            class="flex-1 px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded hover:bg-slate-600">
                            Auto-Zuordnung
                        </button>
                    </div>

                    <!-- Batch Actions -->
                    <div v-if="ungeneratedCount > 0 || unoptimizedCount > 0 || store.taskQueue.length > 0" class="flex space-x-2 pt-2">
                        <!-- Alle generieren -->
                        <button v-if="ungeneratedCount > 0 || store.taskQueue.some(t => t.type === 'generate')"
                            @click="generateAllInfills"
                            :disabled="store.isProcessingQueue || ungeneratedCount === 0"
                            class="flex-1 px-2 py-2 text-xs rounded transition-colors whitespace-nowrap"
                            :class="store.isProcessingQueue && store.taskQueue.some(t => t.type === 'generate')
                                ? 'bg-yellow-600 text-yellow-100 cursor-wait'
                                : 'bg-green-600 text-white hover:bg-green-500'">
                            <template v-if="store.isProcessingQueue && store.taskQueue.some(t => t.type === 'generate')">
                                <svg class="inline-block w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                </svg>
                                Gen...
                            </template>
                            <template v-else>
                                Alle generieren ({{ ungeneratedCount }})
                            </template>
                        </button>
                        <!-- Alle optimieren -->
                        <button v-if="unoptimizedCount > 0 || store.taskQueue.some(t => t.type === 'optimize')"
                            @click="optimizeAllInfills"
                            :disabled="store.isProcessingQueue || unoptimizedCount === 0"
                            class="flex-1 px-2 py-2 text-xs rounded transition-colors whitespace-nowrap"
                            :class="store.isProcessingQueue && store.taskQueue.some(t => t.type === 'optimize')
                                ? 'bg-yellow-600 text-yellow-100 cursor-wait'
                                : 'bg-blue-600 text-white hover:bg-blue-500'">
                            <template v-if="store.isProcessingQueue && store.taskQueue.some(t => t.type === 'optimize')">
                                <svg class="inline-block w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                </svg>
                                Opt...
                            </template>
                            <template v-else>
                                Alle optimieren ({{ unoptimizedCount }})
                            </template>
                        </button>
                    </div>
                    <!-- Queue Status -->
                    <div v-if="store.taskQueue.length > 0" class="pt-1 text-center text-xs text-slate-400">
                        {{ store.taskQueue.length }} Tasks in Queue
                    </div>
                </div>
            </div>
        </div>

        <!-- Info-Text -->
        <div class="mt-3 text-xs text-slate-400 p-2 bg-slate-700/50 rounded">
            Analysierte Farben können verschiedenen Werkzeugen zugeordnet werden.
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useMainStore } from '../store';
import { InfillPatternType } from '../utils/threejs_services';
import ToolSelect from './ToolSelect.vue';

interface ToolConfig {
    penType: string;
    color: string;
}

const props = defineProps<{
    toolConfigs: ToolConfig[];
}>();

const store = useMainStore();

// Pattern-Typen für Dropdown
const patternTypes = [
    { value: InfillPatternType.NONE, label: 'Kein Infill' },
    { value: InfillPatternType.LINES, label: 'Linien' },
    { value: InfillPatternType.GRID, label: 'Gitter' },
    { value: InfillPatternType.HONEYCOMB, label: 'Waben' },
    { value: InfillPatternType.CONCENTRIC, label: 'Konzentrisch' },
    { value: InfillPatternType.CROSSHATCH, label: 'Kreuzschraffur' },
];

// Expanded state für erweiterte Optionen
const expandedColorIdx = ref<number | null>(null);

// Ausgewählter SVG-Index
const selectedSvgIndex = ref(0);

// Aktuell ausgewähltes Item
const selectedItem = computed(() => {
    if (selectedSvgIndex.value >= 0 && selectedSvgIndex.value < store.svgItems.length) {
        return store.svgItems[selectedSvgIndex.value];
    }
    return null;
});

// Bei Änderung der SVG-Liste: Index anpassen
watch(() => store.svgItems.length, (newLen) => {
    if (selectedSvgIndex.value >= newLen) {
        selectedSvgIndex.value = Math.max(0, newLen - 1);
    }
});

// Farben analysieren
const analyzeCurrentSvg = () => {
    store.analyzeColors(selectedSvgIndex.value);
};

// Analyse zurücksetzen
const resetAnalysis = () => {
    store.resetColorAnalysis(selectedSvgIndex.value);
};

// Tool für Farbe setzen
const setColorTool = (colorIdx: number, toolNumber: number) => {
    store.setColorTool(selectedSvgIndex.value, colorIdx, toolNumber);
};

// Sichtbarkeit togglen
const toggleVisibility = (colorIdx: number) => {
    store.toggleColorVisibility(selectedSvgIndex.value, colorIdx);
};

// Alle Farben auf ein Tool setzen
const setAllToTool = (toolNumber: number) => {
    if (selectedItem.value) {
        selectedItem.value.colorGroups.forEach((_, idx) => {
            store.setColorTool(selectedSvgIndex.value, idx, toolNumber);
        });
    }
};

// Auto-Zuordnung: Jede Farbe bekommt ein anderes Tool (1-9, dann wieder von vorne)
const autoAssignTools = () => {
    if (selectedItem.value) {
        selectedItem.value.colorGroups.forEach((_, idx) => {
            const toolNumber = (idx % 9) + 1;
            store.setColorTool(selectedSvgIndex.value, idx, toolNumber);
        });
    }
};

// ===== Infill pro Farbe =====

// Infill für eine Farbe aktivieren/deaktivieren
const toggleInfill = (colorIdx: number) => {
    store.toggleColorInfill(selectedSvgIndex.value, colorIdx);
};

// Infill-Tool für eine Farbe setzen
const setInfillTool = (colorIdx: number, toolNumber: number) => {
    store.setColorInfillTool(selectedSvgIndex.value, colorIdx, toolNumber);
};

// Infill-Pattern für eine Farbe setzen
const setInfillPattern = (colorIdx: number, patternType: InfillPatternType) => {
    store.setColorInfillPattern(selectedSvgIndex.value, colorIdx, patternType);
};

// Infill-Dichte für eine Farbe setzen
const updateInfillDensity = (colorIdx: number, density: number) => {
    store.updateColorInfillOptions(selectedSvgIndex.value, colorIdx, { density });
};

// Infill-Winkel für eine Farbe setzen
const updateInfillAngle = (colorIdx: number, angle: number) => {
    store.updateColorInfillOptions(selectedSvgIndex.value, colorIdx, { angle });
};

// Infill-Rand (Outline Offset) für eine Farbe setzen
const updateInfillOutlineOffset = (colorIdx: number, outlineOffset: number) => {
    store.updateColorInfillOptions(selectedSvgIndex.value, colorIdx, { outlineOffset });
};

// Toggle erweiterte Optionen
const toggleExpandedOptions = (colorIdx: number) => {
    expandedColorIdx.value = expandedColorIdx.value === colorIdx ? null : colorIdx;
};

// Check if infill is currently being generated for a specific color (or queued)
const isGenerating = (colorIdx: number): boolean => {
    // Aktiv laufend
    const gen = store.infillGenerating;
    if (gen !== null && gen.svgIndex === selectedSvgIndex.value && gen.colorIndex === colorIdx) {
        return true;
    }
    // In Queue (pending oder running)
    return store.taskQueue.some(t =>
        t.type === 'generate' &&
        t.svgIndex === selectedSvgIndex.value &&
        t.colorIndex === colorIdx &&
        (t.status === 'pending' || t.status === 'running')
    );
};

// Check if generation task is actively running (not just queued)
const isGeneratingRunning = (colorIdx: number): boolean => {
    const gen = store.infillGenerating;
    return gen !== null && gen.svgIndex === selectedSvgIndex.value && gen.colorIndex === colorIdx;
};

// Check if infill is currently being optimized for a specific color (or queued)
const isOptimizing = (colorIdx: number): boolean => {
    // Aktiv laufend
    const opt = store.infillOptimizing;
    if (opt !== null && opt.svgIndex === selectedSvgIndex.value && opt.colorIndex === colorIdx) {
        return true;
    }
    // In Queue (pending oder running)
    return store.taskQueue.some(t =>
        t.type === 'optimize' &&
        t.svgIndex === selectedSvgIndex.value &&
        t.colorIndex === colorIdx &&
        (t.status === 'pending' || t.status === 'running')
    );
};

// Check if task is actively running (not just queued)
const isRunning = (colorIdx: number): boolean => {
    const opt = store.infillOptimizing;
    return opt !== null && opt.svgIndex === selectedSvgIndex.value && opt.colorIndex === colorIdx;
};

// Infill für eine Farbe generieren (via Queue)
const generateInfill = (colorIdx: number) => {
    const item = selectedItem.value;
    if (!item) return;
    const colorGroup = item.colorGroups[colorIdx];
    const label = `Gen: ${item.fileName} - ${colorGroup.color}`;
    store.queueTask('generate', selectedSvgIndex.value, colorIdx, label);
};

// TSP-Optimierung für Infill einer Farbe (via Queue)
const optimizeInfill = (colorIdx: number) => {
    const item = selectedItem.value;
    if (!item) return;
    const colorGroup = item.colorGroups[colorIdx];
    const label = `TSP: ${item.fileName} - ${colorGroup.color}`;
    store.queueTask('optimize', selectedSvgIndex.value, colorIdx, label);
};

// Alle unoptimierte Infills auf einmal optimieren (Queue)
const optimizeAllInfills = () => {
    const item = selectedItem.value;
    if (!item) return;

    let queued = 0;
    item.colorGroups.forEach((colorGroup, colorIdx) => {
        // Nur wenn Infill vorhanden und noch nicht optimiert
        if (colorGroup.infillGroup && !colorGroup.infillStats?.isOptimized) {
            const label = `TSP: ${item.fileName} - ${colorGroup.color}`;
            store.queueTask('optimize', selectedSvgIndex.value, colorIdx, label);
            queued++;
        }
    });
    console.log(`${queued} TSP-Optimierungen in Queue gestellt`);
};

// Anzahl der ungenerierten Infills (infillEnabled aber kein infillGroup)
const ungeneratedCount = computed(() => {
    const item = selectedItem.value;
    if (!item) return 0;
    return item.colorGroups.filter(cg =>
        cg.infillEnabled && !cg.infillGroup
    ).length;
});

// Anzahl der unoptimierte Infills berechnen
const unoptimizedCount = computed(() => {
    const item = selectedItem.value;
    if (!item) return 0;
    return item.colorGroups.filter(cg =>
        cg.infillGroup && !cg.infillStats?.isOptimized
    ).length;
});

// Alle ungenerierten Infills auf einmal generieren (Queue)
const generateAllInfills = () => {
    const item = selectedItem.value;
    if (!item) return;

    let queued = 0;
    item.colorGroups.forEach((colorGroup, colorIdx) => {
        // Nur wenn Infill aktiviert aber noch nicht generiert
        if (colorGroup.infillEnabled && !colorGroup.infillGroup) {
            const label = `Gen: ${item.fileName} - ${colorGroup.color}`;
            store.queueTask('generate', selectedSvgIndex.value, colorIdx, label);
            queued++;
        }
    });
    console.log(`${queued} Infill-Generierungen in Queue gestellt`);
};

// Infill für eine Farbe löschen
const deleteInfill = (colorIdx: number) => {
    store.deleteColorInfill(selectedSvgIndex.value, colorIdx);
};
</script>
