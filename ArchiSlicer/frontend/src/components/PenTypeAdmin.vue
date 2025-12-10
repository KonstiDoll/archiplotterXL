<template>
    <div class="bg-slate-800 p-4 rounded-lg">
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-white text-sm font-semibold">Stifttypen verwalten</h3>
            <button
                @click="showAddForm = !showAddForm"
                class="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded">
                {{ showAddForm ? 'Abbrechen' : '+ Neu' }}
            </button>
        </div>

        <!-- Add new pen type form -->
        <div v-if="showAddForm" class="mb-4 p-3 bg-slate-700 rounded">
            <h4 class="text-white text-xs font-medium mb-2">Neuer Stifttyp</h4>
            <div class="grid grid-cols-2 gap-2 mb-2">
                <input
                    v-model="newPenType.id"
                    placeholder="ID (z.B. mypen)"
                    class="px-2 py-1 text-xs bg-slate-600 text-white rounded border border-slate-500" />
                <input
                    v-model="newPenType.displayName"
                    placeholder="Name"
                    class="px-2 py-1 text-xs bg-slate-600 text-white rounded border border-slate-500" />
                <input
                    v-model.number="newPenType.penUp"
                    type="number"
                    placeholder="Pen Up"
                    class="px-2 py-1 text-xs bg-slate-600 text-white rounded border border-slate-500" />
                <input
                    v-model.number="newPenType.penDown"
                    type="number"
                    placeholder="Pen Down"
                    class="px-2 py-1 text-xs bg-slate-600 text-white rounded border border-slate-500" />
                <input
                    v-model.number="newPenType.pumpDistanceThreshold"
                    type="number"
                    placeholder="Pump Distanz (0=aus)"
                    class="px-2 py-1 text-xs bg-slate-600 text-white rounded border border-slate-500" />
                <input
                    v-model.number="newPenType.pumpHeight"
                    type="number"
                    placeholder="Pump Höhe"
                    class="px-2 py-1 text-xs bg-slate-600 text-white rounded border border-slate-500" />
            </div>
            <button
                @click="handleCreate"
                :disabled="!canCreate"
                class="w-full px-2 py-1 text-xs bg-green-600 hover:bg-green-700 disabled:bg-slate-500 text-white rounded">
                Erstellen
            </button>
            <p v-if="error" class="mt-1 text-xs text-red-400">{{ error }}</p>
        </div>

        <!-- Pen types list -->
        <div class="space-y-2 max-h-96 overflow-y-auto">
            <div
                v-for="penType in penTypesList"
                :key="penType.id"
                class="p-2 bg-slate-700 rounded">
                <!-- View mode -->
                <div v-if="editingId !== penType.id">
                    <div class="flex justify-between items-start">
                        <div>
                            <span class="text-white text-sm font-medium">{{ penType.displayName }}</span>
                            <span class="text-slate-400 text-xs ml-2">({{ penType.id }})</span>
                        </div>
                        <div class="flex gap-1">
                            <button
                                @click="startEdit(penType)"
                                class="px-2 py-0.5 text-xs bg-slate-600 hover:bg-slate-500 text-white rounded">
                                Edit
                            </button>
                            <button
                                @click="handleDelete(penType.id)"
                                class="px-2 py-0.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded">
                                X
                            </button>
                        </div>
                    </div>
                    <div class="mt-1 text-xs text-slate-400 grid grid-cols-2 gap-x-4">
                        <span>Pen Up: {{ penType.penUp }}mm</span>
                        <span>Pen Down: {{ penType.penDown }}mm</span>
                        <span>Pump: {{ penType.pumpDistanceThreshold > 0 ? `alle ${penType.pumpDistanceThreshold}mm` : 'aus' }}</span>
                        <span v-if="penType.pumpDistanceThreshold > 0">Z Hub: {{ penType.pumpHeight }}mm</span>
                    </div>
                </div>

                <!-- Edit mode -->
                <div v-else class="space-y-2">
                    <div class="flex items-center gap-2 mb-2">
                        <input
                            v-model="editForm.displayName"
                            placeholder="Name"
                            class="flex-1 px-2 py-1 text-xs bg-slate-600 text-white rounded border border-slate-500" />
                        <span class="text-slate-400 text-xs shrink-0">{{ penType.id }}</span>
                    </div>
                    <div class="grid grid-cols-2 gap-x-2 gap-y-1">
                        <div class="flex items-center justify-between">
                            <label class="text-slate-400 text-xs">Up:</label>
                            <input
                                v-model.number="editForm.penUp"
                                type="number"
                                class="w-16 px-1 py-1 text-xs bg-slate-600 text-white rounded border border-slate-500 text-right" />
                        </div>
                        <div class="flex items-center justify-between">
                            <label class="text-slate-400 text-xs">Down:</label>
                            <input
                                v-model.number="editForm.penDown"
                                type="number"
                                class="w-16 px-1 py-1 text-xs bg-slate-600 text-white rounded border border-slate-500 text-right" />
                        </div>
                        <div class="flex items-center justify-between">
                            <label class="text-slate-400 text-xs">Distanz:</label>
                            <input
                                v-model.number="editForm.pumpDistanceThreshold"
                                type="number"
                                class="w-16 px-1 py-1 text-xs bg-slate-600 text-white rounded border border-slate-500 text-right" />
                        </div>
                        <div class="flex items-center justify-between">
                            <label class="text-slate-400 text-xs">Z Hub:</label>
                            <input
                                v-model.number="editForm.pumpHeight"
                                type="number"
                                class="w-16 px-1 py-1 text-xs bg-slate-600 text-white rounded border border-slate-500 text-right" />
                        </div>
                    </div>
                    <div class="flex items-center justify-between">
                        <button
                            @click="showPumpInfo = !showPumpInfo"
                            class="text-slate-400 hover:text-white text-xs flex items-center gap-1">
                            <span class="w-4 h-4 rounded-full border border-slate-400 flex items-center justify-center text-[10px]">i</span>
                            <span>Pump Info</span>
                        </button>
                        <span class="text-slate-500 text-[10px]">alle Werte in mm</span>
                    </div>
                    <div v-if="showPumpInfo" class="p-2 bg-slate-600 rounded text-xs text-slate-300 space-y-1">
                        <p><strong>Distanz:</strong> Nach dieser Zeichendistanz wird gepumpt (0 = aus)</p>
                        <p><strong>Z Hub:</strong> Z fährt relativ um diesen Betrag nach unten und wieder zurück</p>
                        <p class="text-slate-400 text-[10px] mt-2">Der Pump-Vorgang hebt zuerst den Stift (U-Achse), bewegt dann Z relativ nach unten/oben, unabhängig von der aktuellen Zeichenhöhe.</p>
                    </div>
                    <div class="flex gap-2">
                        <button
                            @click="handleUpdate"
                            class="flex-1 px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded">
                            Speichern
                        </button>
                        <button
                            @click="cancelEdit"
                            class="flex-1 px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 text-white rounded">
                            Abbrechen
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Loading/Error states -->
        <div v-if="isLoading" class="text-center py-2 text-slate-400 text-xs">
            Laden...
        </div>
        <div v-if="penTypesError" class="mt-2 p-2 bg-red-900/30 rounded text-red-400 text-xs">
            API Fehler: {{ penTypesError }}
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
    penTypes,
    penTypesLoading,
    penTypesError,
    createPenType,
    updatePenType,
    deletePenType,
    type PenType
} from '../utils/gcode_services';

const showAddForm = ref(false);
const showPumpInfo = ref(false);
const editingId = ref<string | null>(null);
const error = ref<string | null>(null);
const isLoading = ref(false);

// New pen type form
const newPenType = ref({
    id: '',
    displayName: '',
    penUp: 33,
    penDown: 13,
    pumpDistanceThreshold: 0,
    pumpHeight: 50,
});

// Edit form
const editForm = ref({
    displayName: '',
    penUp: 0,
    penDown: 0,
    pumpDistanceThreshold: 0,
    pumpHeight: 50,
});

// Computed
const penTypesList = computed(() => Object.values(penTypes));
const canCreate = computed(() => newPenType.value.id && newPenType.value.displayName);

// Methods
function startEdit(penType: PenType) {
    editingId.value = penType.id;
    editForm.value = {
        displayName: penType.displayName,
        penUp: penType.penUp,
        penDown: penType.penDown,
        pumpDistanceThreshold: penType.pumpDistanceThreshold,
        pumpHeight: penType.pumpHeight,
    };
}

function cancelEdit() {
    editingId.value = null;
}

async function handleCreate() {
    if (!canCreate.value) return;

    error.value = null;
    isLoading.value = true;

    try {
        await createPenType({
            id: newPenType.value.id,
            displayName: newPenType.value.displayName,
            penUp: newPenType.value.penUp,
            penDown: newPenType.value.penDown,
            pumpDistanceThreshold: newPenType.value.pumpDistanceThreshold,
            pumpHeight: newPenType.value.pumpHeight,
        });

        // Reset form
        newPenType.value = {
            id: '',
            displayName: '',
            penUp: 33,
            penDown: 13,
            pumpDistanceThreshold: 0,
            pumpHeight: 50,
        };
        showAddForm.value = false;
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Fehler beim Erstellen';
    } finally {
        isLoading.value = false;
    }
}

async function handleUpdate() {
    if (!editingId.value) return;

    error.value = null;
    isLoading.value = true;

    try {
        await updatePenType(editingId.value, editForm.value);
        editingId.value = null;
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Fehler beim Aktualisieren';
    } finally {
        isLoading.value = false;
    }
}

async function handleDelete(id: string) {
    if (!confirm(`Stifttyp "${id}" wirklich löschen?`)) return;

    error.value = null;
    isLoading.value = true;

    try {
        await deletePenType(id);
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Fehler beim Löschen';
    } finally {
        isLoading.value = false;
    }
}
</script>
