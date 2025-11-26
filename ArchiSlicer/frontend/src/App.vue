<script setup lang="ts">
import { ref, computed } from 'vue';
import { useMainStore } from './store';
import { createGcodeFromLineGroup } from './utils/gcode_services';
import { InfillPatternType } from './utils/threejs_services';
import AppHeader from './components/AppHeader.vue';
import Sidebar from './components/Sidebar.vue';
import ThreejsScene from './components/ThreejsScene.vue';
import GCodePanel from './components/GCodePanel.vue';

const store = useMainStore();

// State
const activeToolIndex = ref(1);
const toolPenTypes = ref<string[]>(Array(9).fill('stabilo'));
const globalDrawingHeight = ref(0);
const gCode = ref('');

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

const handleUpdatePenType = (index: number, penType: string) => {
    toolPenTypes.value[index] = penType;
};

const handleUpdateDrawingHeight = (value: number) => {
    globalDrawingHeight.value = value;
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
        const currentPenType = toolPenTypes.value[item.toolNumber - 1];

        const svgGcode = createGcodeFromLineGroup(
            item.geometry,
            item.toolNumber,
            currentPenType,
            item.feedrate,
            item.infillToolNumber,
            globalDrawingHeight.value
        );

        combinedGcode += `\n; --- SVG #${index + 1}: ${item.fileName} ---\n`;
        combinedGcode += `; Kontur mit Tool #${item.toolNumber}, Stift "${currentPenType}"\n`;
        if (item.infillOptions.patternType !== InfillPatternType.NONE) {
            combinedGcode += `; Infill (${item.infillOptions.patternType}) mit Tool #${item.infillToolNumber}\n`;
        }
        combinedGcode += `; Feedrate ${item.feedrate} mm/min\n`;
        combinedGcode += svgGcode;
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
                :tool-pen-types="toolPenTypes"
                :global-drawing-height="globalDrawingHeight"
                @select-tool="handleSelectTool"
                @update-pen-type="handleUpdatePenType"
                @update-drawing-height="handleUpdateDrawingHeight"
            />

            <!-- Main Area -->
            <main class="flex flex-col flex-grow overflow-hidden">
                <!-- 3D Preview -->
                <div class="flex-grow overflow-hidden p-2">
                    <ThreejsScene :activeToolIndex="activeToolIndex" class="h-full rounded-lg" />
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
