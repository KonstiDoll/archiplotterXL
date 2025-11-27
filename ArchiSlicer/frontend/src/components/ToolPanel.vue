<template>
    <div class="bg-slate-800 p-3 rounded-lg">
        <h3 class="text-white text-sm font-semibold mb-3 text-center">Werkzeuge & Stifte</h3>
        <div class="space-y-2">
            <div v-for="(tool, index) in tools" :key="index"
                class="flex items-center space-x-2">
                <!-- Tool-Button -->
                <button
                    class="w-10 h-10 rounded-lg flex items-center justify-center font-bold transition-colors shrink-0"
                    :class="activeToolIndex === index + 1
                        ? 'bg-orange-600 text-white'
                        : 'bg-slate-600 text-slate-200 hover:bg-slate-500'"
                    @click="$emit('select-tool', index + 1)">
                    {{ tool.name }}
                </button>

                <!-- Stift-Typ Selektor -->
                <select
                    :value="toolConfigs[index]?.penType || 'stabilo'"
                    @change="handlePenTypeChange(index, ($event.target as HTMLSelectElement).value)"
                    class="flex-grow p-2 text-sm border border-slate-600 rounded bg-slate-700 text-white min-w-0">
                    <option v-for="penType in availablePenTypes" :key="penType" :value="penType">
                        {{ getPenTypeDisplayName(penType) }}
                    </option>
                </select>

                <!-- Farb-Picker (natives HTML-Farbrad) -->
                <input
                    type="color"
                    :value="toolConfigs[index]?.color || '#000000'"
                    @input="handleColorChange(index, ($event.target as HTMLInputElement).value)"
                    class="w-10 h-10 rounded border border-slate-500 cursor-pointer shrink-0 bg-transparent"
                    :title="`Farbe für Tool ${index + 1}`" />
            </div>
        </div>
        <div class="mt-3 text-xs text-slate-400 p-2 bg-slate-700/50 rounded">
            Stift-Typ bestimmt die Zeichenhöhe. Farbe ist frei wählbar.
        </div>
    </div>
</template>

<script setup lang="ts">
import { availablePenTypes, getPenTypeConfig, type ToolConfig } from '../utils/gcode_services';

const props = defineProps<{
    activeToolIndex: number;
    toolConfigs: ToolConfig[];
}>();

const emit = defineEmits<{
    (e: 'select-tool', toolIndex: number): void;
    (e: 'update-tool-config', index: number, config: ToolConfig): void;
}>();

const tools = [
    { name: '1' }, { name: '2' }, { name: '3' },
    { name: '4' }, { name: '5' }, { name: '6' },
    { name: '7' }, { name: '8' }, { name: '9' },
];

// Hilfsfunktion für PenType-Anzeigename
function getPenTypeDisplayName(penTypeId: string): string {
    const config = getPenTypeConfig(penTypeId);
    return config?.displayName ?? penTypeId;
}

// Handler für Stift-Typ Änderung
function handlePenTypeChange(index: number, newPenType: string) {
    const currentConfig = props.toolConfigs[index] || { penType: 'stabilo', color: '#000000' };
    emit('update-tool-config', index, {
        ...currentConfig,
        penType: newPenType
    });
}

// Handler für Farb-Änderung
function handleColorChange(index: number, newColor: string) {
    const currentConfig = props.toolConfigs[index] || { penType: 'stabilo', color: '#000000' };
    emit('update-tool-config', index, {
        ...currentConfig,
        color: newColor
    });
}
</script>
