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
                        Analysiert die Stroke-Farben im SVG
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
                        class="flex items-center space-x-2 p-2 bg-slate-700 rounded">

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

                        <!-- Tool-Dropdown -->
                        <select :value="colorGroup.toolNumber"
                            @change="setColorTool(colorIdx, Number(($event.target as HTMLSelectElement).value))"
                            class="w-14 p-1 text-sm border border-slate-600 rounded bg-slate-600 text-white">
                            <option v-for="i in 9" :key="i" :value="i">T{{ i }}</option>
                        </select>
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

const store = useMainStore();

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
</script>
