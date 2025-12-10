<template>
    <div class="bg-slate-800 p-3 rounded-lg">
        <h3 class="text-white text-sm font-semibold mb-3 text-center">Werkzeuge & Stifte</h3>

        <!-- Preset Selector -->
        <div class="mb-3 space-y-2">
            <div class="flex gap-2">
                <select
                    v-model="selectedPresetId"
                    @change="handlePresetSelect"
                    class="flex-1 p-2 text-sm border border-slate-600 rounded bg-slate-700 text-white">
                    <option :value="null">-- Preset wählen --</option>
                    <option v-for="preset in toolPresets" :key="preset.id" :value="preset.id">
                        {{ preset.name }}
                    </option>
                </select>
                <button
                    @click="showSaveDialog = true"
                    class="px-3 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                    title="Aktuelle Konfiguration speichern">
                    Speichern
                </button>
            </div>

            <!-- Save Dialog -->
            <div v-if="showSaveDialog" class="p-2 bg-slate-700 rounded space-y-2">
                <input
                    v-model="presetName"
                    placeholder="Preset-Name"
                    class="w-full px-2 py-1 text-sm bg-slate-600 text-white rounded border border-slate-500"
                    @keyup.enter="handleSavePreset" />
                <div class="flex gap-2">
                    <button
                        @click="handleSavePreset"
                        :disabled="!presetName.trim()"
                        class="flex-1 px-2 py-1 text-xs bg-green-600 hover:bg-green-700 disabled:bg-slate-500 text-white rounded">
                        {{ editingPresetId ? 'Aktualisieren' : 'Neu speichern' }}
                    </button>
                    <button
                        v-if="selectedPresetId"
                        @click="handleDeletePreset"
                        class="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded">
                        Löschen
                    </button>
                    <button
                        @click="closeSaveDialog"
                        class="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 text-white rounded">
                        Abbrechen
                    </button>
                </div>
            </div>
            <p v-if="presetError" class="text-xs text-red-400">{{ presetError }}</p>
        </div>

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
import { ref, computed, onMounted } from 'vue';
import {
    penTypes,
    getPenTypeConfig,
    toolPresets,
    fetchToolPresets,
    createToolPreset,
    updateToolPreset,
    deleteToolPreset,
    type ToolConfig
} from '../utils/gcode_services';

// Computed list of available pen types (reactive to API updates)
const availablePenTypes = computed(() => Object.keys(penTypes));

const props = defineProps<{
    activeToolIndex: number;
    toolConfigs: ToolConfig[];
}>();

const emit = defineEmits<{
    (e: 'select-tool', toolIndex: number): void;
    (e: 'update-tool-config', index: number, config: ToolConfig): void;
    (e: 'load-preset', configs: ToolConfig[]): void;
}>();

const tools = [
    { name: '1' }, { name: '2' }, { name: '3' },
    { name: '4' }, { name: '5' }, { name: '6' },
    { name: '7' }, { name: '8' }, { name: '9' },
];

// Preset state
const selectedPresetId = ref<number | null>(null);
const showSaveDialog = ref(false);
const presetName = ref('');
const editingPresetId = ref<number | null>(null);
const presetError = ref<string | null>(null);

// Fetch presets on mount
onMounted(() => {
    fetchToolPresets();
});

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
    // Clear selected preset when manually changing config
    selectedPresetId.value = null;
}

// Handler für Farb-Änderung
function handleColorChange(index: number, newColor: string) {
    const currentConfig = props.toolConfigs[index] || { penType: 'stabilo', color: '#000000' };
    emit('update-tool-config', index, {
        ...currentConfig,
        color: newColor
    });
    // Clear selected preset when manually changing config
    selectedPresetId.value = null;
}

// Preset handlers
function handlePresetSelect() {
    if (selectedPresetId.value === null) return;

    const preset = toolPresets.find(p => p.id === selectedPresetId.value);
    if (preset) {
        emit('load-preset', preset.tool_configs);
    }
}

async function handleSavePreset() {
    if (!presetName.value.trim()) return;

    presetError.value = null;

    try {
        if (editingPresetId.value) {
            await updateToolPreset(editingPresetId.value, presetName.value.trim(), props.toolConfigs);
        } else {
            const created = await createToolPreset(presetName.value.trim(), props.toolConfigs);
            selectedPresetId.value = created.id;
        }
        closeSaveDialog();
    } catch (e) {
        presetError.value = e instanceof Error ? e.message : 'Fehler beim Speichern';
    }
}

async function handleDeletePreset() {
    if (!selectedPresetId.value) return;
    if (!confirm('Preset wirklich löschen?')) return;

    presetError.value = null;

    try {
        await deleteToolPreset(selectedPresetId.value);
        selectedPresetId.value = null;
        closeSaveDialog();
    } catch (e) {
        presetError.value = e instanceof Error ? e.message : 'Fehler beim Löschen';
    }
}

function closeSaveDialog() {
    showSaveDialog.value = false;
    presetName.value = '';
    editingPresetId.value = null;
    presetError.value = null;
}

// When opening save dialog with a selected preset, prefill for update
function openSaveDialog() {
    if (selectedPresetId.value) {
        const preset = toolPresets.find(p => p.id === selectedPresetId.value);
        if (preset) {
            presetName.value = preset.name;
            editingPresetId.value = preset.id;
        }
    }
    showSaveDialog.value = true;
}
</script>
