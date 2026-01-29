<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import * as THREE from 'three';
import { useMainStore } from './store';
import { createGcodeFromLineGroup, createGcodeFromColorGroups, createGcodeWithColorInfill, fetchPenTypes, type ToolConfig } from './utils/gcode_services';
import { InfillPatternType } from './utils/threejs_services';
import AppHeader from './components/AppHeader.vue';
import Sidebar from './components/Sidebar.vue';
import ThreejsScene from './components/ThreejsScene.vue';
import GCodePanel from './components/GCodePanel.vue';

const store = useMainStore();

// LocalStorage Keys
const STORAGE_KEY_TOOLS = 'archislicer_toolConfigs';

// Default Tool-Konfiguration
const createDefaultToolConfigs = (): ToolConfig[] =>
    Array(9).fill(null).map(() => ({
        penType: 'stabilo',
        color: '#000000'
    }));

// State
const activeToolIndex = ref(1);
// Tool-Konfiguration aus localStorage laden oder Default verwenden
const toolConfigs = ref<ToolConfig[]>(createDefaultToolConfigs());

// Beim Start aus localStorage laden und PenTypes von API laden
onMounted(async () => {
    // Load pen types from API
    await fetchPenTypes();

    // Load tool configs from localStorage
    const saved = localStorage.getItem(STORAGE_KEY_TOOLS);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length === 9) {
                toolConfigs.value = parsed;
                console.log('Tool-Konfiguration aus localStorage geladen');
            }
        } catch (e) {
            console.warn('Fehler beim Laden der Tool-Konfiguration:', e);
        }
    }
});

// Bei Änderungen in localStorage speichern
watch(toolConfigs, (newConfigs) => {
    localStorage.setItem(STORAGE_KEY_TOOLS, JSON.stringify(newConfigs));
    console.log('Tool-Konfiguration gespeichert');
}, { deep: true });

const globalDrawingHeight = ref(0);
const gCode = ref('');
// Hintergrund-Preset für die 3D-Vorschau
const backgroundPreset = ref('forest');
const customBackgroundColor = ref('#e0e0e0');

// Computed
const hasItems = computed(() => store.svgItems.length > 0);

// Generiere Dateinamen aus den SVG-Namen
const gcodeFilename = computed(() => {
    if (store.svgItems.length === 0) return 'output.gcode';

    // Datum im Format YYYYMMDD
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');

    // Ersten SVG-Namen nehmen (ohne .svg Extension)
    const firstName = store.svgItems[0].fileName.replace(/\.svg$/i, '');

    // Bei mehreren SVGs: "name_+2more"
    if (store.svgItems.length > 1) {
        return `${dateStr}_${firstName}_+${store.svgItems.length - 1}more.gcode`;
    }

    return `${dateStr}_${firstName}.gcode`;
});

// Event handlers
const handleSelectTool = (index: number) => {
    activeToolIndex.value = index;
};

const handleUpdateToolConfig = (index: number, config: ToolConfig) => {
    toolConfigs.value[index] = config;
};

const handleUpdateDrawingHeight = (value: number) => {
    globalDrawingHeight.value = value;
};

const handleUpdateBackgroundPreset = (preset: string) => {
    backgroundPreset.value = preset;
};

const handleUpdateCustomColor = (color: string) => {
    customBackgroundColor.value = color;
};

const handleLoadPreset = (configs: ToolConfig[]) => {
    // Load all tool configs from preset
    configs.forEach((config, index) => {
        if (index < toolConfigs.value.length) {
            toolConfigs.value[index] = config;
        }
    });
};

// G-Code generation
const generateGcode = () => {
    if (store.svgItems.length === 0) {
        alert('Keine Dateien geladen!');
        return;
    }

    let combinedGcode = '';
    combinedGcode += '; --- GLOBALE EINSTELLUNGEN ---\n';
    combinedGcode += `; Zeichenhöhe/Materialstärke: ${globalDrawingHeight.value.toFixed(2)}mm\n\n`;

    store.svgItems.forEach((item, index) => {
        combinedGcode += `\n; --- SVG #${index + 1}: ${item.fileName} ---\n`;

        // Offset ausgeben wenn gesetzt
        if (item.offsetX !== 0 || item.offsetY !== 0) {
            combinedGcode += `; Platzierung: X=${item.offsetX}mm, Y=${item.offsetY}mm\n`;
        }

        // Prüfen ob SVG analysiert wurde
        if (item.isAnalyzed && item.colorGroups.length > 0) {
            // Multi-Color G-Code generieren
            combinedGcode += `; Multi-Color Modus: ${item.colorGroups.length} Farben\n`;

            // Verwendete Tools auflisten
            const usedTools = new Set(item.colorGroups.map(cg => cg.toolNumber));
            combinedGcode += `; Verwendete Tools: ${Array.from(usedTools).sort().join(', ')}\n`;
            combinedGcode += `; Feedrate ${item.feedrate} mm/min\n`;

            // Prüfen ob farb-basiertes Infill aktiv ist (nur wenn bereits generiert)
            const hasColorInfill = item.colorGroups.some(cg => cg.infillEnabled && cg.infillGroup && cg.infillGroup.children.length > 0);

            if (hasColorInfill) {
                // Farb-basiertes Infill: Verwende bereits generiertes Infill
                const infillGroups = new Map<string, THREE.Group>();
                const colorsWithInfill: string[] = [];

                for (const colorGroup of item.colorGroups) {
                    // Nur verwenden wenn Infill aktiviert UND bereits generiert wurde
                    if (colorGroup.infillEnabled && colorGroup.infillGroup && colorGroup.infillGroup.children.length > 0) {
                        infillGroups.set(colorGroup.color.toLowerCase(), colorGroup.infillGroup);
                        colorsWithInfill.push(colorGroup.color);
                    }
                }

                combinedGcode += `; Farb-basiertes Infill für: ${colorsWithInfill.join(', ')}\n`;

                const svgGcode = createGcodeWithColorInfill(
                    item.geometry,
                    item.colorGroups,
                    infillGroups,
                    toolConfigs.value,
                    item.feedrate,
                    globalDrawingHeight.value,
                    item.offsetX,
                    item.offsetY,
                    item.toolNumber,  // File-level fallback tool for contours
                    item.infillToolNumber  // File-level fallback tool for infill
                );

                combinedGcode += svgGcode;
            } else {
                // Kein farb-basiertes Infill: Standard Multi-Color G-Code (mit File-Level Infill falls vorhanden)
                const svgGcode = createGcodeFromColorGroups(
                    item.geometry,
                    item.colorGroups,
                    toolConfigs.value,
                    item.feedrate,
                    globalDrawingHeight.value,
                    item.offsetX,
                    item.offsetY,
                    item.infillToolNumber,
                    item.toolNumber,  // File-level fallback tool for contours
                    store.gcodeExportMode  // Export-Modus: 'tool' oder 'layer'
                );

                combinedGcode += svgGcode;
            }
        } else {
            // Standard Single-Tool G-Code
            const currentToolConfig = toolConfigs.value[item.toolNumber - 1];
            const infillToolConfig = toolConfigs.value[item.infillToolNumber - 1];

            combinedGcode += `; Single-Tool Modus\n`;
            combinedGcode += `; Kontur mit Tool #${item.toolNumber}, Typ "${currentToolConfig.penType}", Farbe "${currentToolConfig.color}"\n`;
            if (item.infillOptions.patternType !== InfillPatternType.NONE) {
                combinedGcode += `; Infill (${item.infillOptions.patternType}) mit Tool #${item.infillToolNumber}, Typ "${infillToolConfig.penType}"\n`;
            }
            combinedGcode += `; Feedrate ${item.feedrate} mm/min\n`;

            const svgGcode = createGcodeFromLineGroup(
                item.geometry,
                item.toolNumber,
                currentToolConfig,
                item.feedrate,
                item.infillToolNumber,
                infillToolConfig,
                globalDrawingHeight.value,
                item.offsetX,
                item.offsetY
            );

            combinedGcode += svgGcode;
        }
    });

    gCode.value = combinedGcode;
};
</script>

<template>
    <div class="flex flex-col h-screen w-screen overflow-hidden bg-slate-900">
        <!-- Header -->
        <AppHeader />

        <!-- Main Content -->
        <div class="flex flex-grow overflow-hidden">
            <!-- Sidebar -->
            <Sidebar
                :active-tool-index="activeToolIndex"
                :tool-configs="toolConfigs"
                :global-drawing-height="globalDrawingHeight"
                :background-preset="backgroundPreset"
                :custom-background-color="customBackgroundColor"
                @select-tool="handleSelectTool"
                @update-tool-config="handleUpdateToolConfig"
                @update-drawing-height="handleUpdateDrawingHeight"
                @update-background-preset="handleUpdateBackgroundPreset"
                @update-custom-color="handleUpdateCustomColor"
                @load-preset="handleLoadPreset"
            />

            <!-- Main Area -->
            <main class="flex flex-col flex-grow overflow-hidden">
                <!-- 3D Preview -->
                <div class="flex-grow overflow-hidden p-2">
                    <ThreejsScene
                        :activeToolIndex="activeToolIndex"
                        :backgroundPreset="backgroundPreset"
                        :customColor="customBackgroundColor"
                        class="h-full rounded-lg" />
                </div>

                <!-- G-Code Panel -->
                <div class="h-64 shrink-0 p-2 pt-0">
                    <GCodePanel
                        :gcode="gCode"
                        :has-items="hasItems"
                        :filename="gcodeFilename"
                        @generate="generateGcode"
                    />
                </div>
            </main>
        </div>
    </div>
</template>

<style>
/* Reset and base styles */
html, body, #app {
    margin: 0;
    padding: 0;
    height: 100%;
    width: 100%;
    overflow: hidden;
}
</style>
