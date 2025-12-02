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

                        <!-- Zeile 2b: Generate/Delete Buttons (nur wenn Infill aktiviert) -->
                        <div v-if="colorGroup.infillEnabled" class="flex items-center space-x-2 pt-1">
                            <!-- Generieren Button -->
                            <button @click="generateInfill(colorIdx)"
                                class="flex-1 px-2 py-1 text-xs rounded transition-colors"
                                :class="colorGroup.infillGroup ? 'bg-green-700 text-green-200 hover:bg-green-600' : 'bg-green-600 text-white hover:bg-green-500'">
                                {{ colorGroup.infillGroup ? '↻ Neu generieren' : '▶ Generieren' }}
                            </button>
                            <!-- Löschen Button (nur wenn Infill generiert) -->
                            <button v-if="colorGroup.infillGroup"
                                @click="deleteInfill(colorIdx)"
                                class="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-500 transition-colors">
                                ✕ Löschen
                            </button>
                            <!-- Info über generierte Linien -->
                            <span v-if="colorGroup.infillGroup" class="text-xs text-slate-400">
                                {{ colorGroup.infillGroup.children.length }} Linien
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
                                    min="0.5" max="20" step="0.5"
                                    class="flex-grow h-1 bg-slate-600 rounded appearance-none cursor-pointer" />
                                <span class="w-12 text-xs text-right text-slate-300">{{ colorGroup.infillOptions.density }}mm</span>
                            </div>
                            <!-- Winkel -->
                            <div class="flex items-center space-x-2">
                                <label class="w-14 text-xs text-slate-400">Winkel:</label>
                                <input type="range"
                                    :value="colorGroup.infillOptions.angle"
                                    @input="updateInfillAngle(colorIdx, Number(($event.target as HTMLInputElement).value))"
                                    min="0" max="180" step="5"
                                    class="flex-grow h-1 bg-slate-600 rounded appearance-none cursor-pointer" />
                                <span class="w-12 text-xs text-right text-slate-300">{{ colorGroup.infillOptions.angle }}°</span>
                            </div>
                            <!-- Rand (Outline Offset) -->
                            <div class="flex items-center space-x-2">
                                <label class="w-14 text-xs text-slate-400">Rand:</label>
                                <input type="range"
                                    :value="colorGroup.infillOptions.outlineOffset"
                                    @input="updateInfillOutlineOffset(colorIdx, Number(($event.target as HTMLInputElement).value))"
                                    min="0" max="10" step="0.5"
                                    class="flex-grow h-1 bg-slate-600 rounded appearance-none cursor-pointer" />
                                <span class="w-12 text-xs text-right text-slate-300">{{ colorGroup.infillOptions.outlineOffset }}mm</span>
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
    { value: InfillPatternType.ZIGZAG, label: 'Zickzack' },
    { value: InfillPatternType.HONEYCOMB, label: 'Waben' },
    { value: InfillPatternType.CONCENTRIC, label: 'Konzentrisch' },
    { value: InfillPatternType.SPIRAL, label: 'Spirale' },
    { value: InfillPatternType.FERMAT_SPIRAL, label: 'Fermat-Spirale' },
    { value: InfillPatternType.CROSSHATCH, label: 'Kreuzschraffur' },
    { value: InfillPatternType.HILBERT, label: 'Hilbert' }
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

// Infill für eine Farbe generieren
const generateInfill = (colorIdx: number) => {
    store.generateColorInfill(selectedSvgIndex.value, colorIdx);
};

// Infill für eine Farbe löschen
const deleteInfill = (colorIdx: number) => {
    store.deleteColorInfill(selectedSvgIndex.value, colorIdx);
};
</script>
