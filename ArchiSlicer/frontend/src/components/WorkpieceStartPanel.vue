<template>
    <div class="bg-slate-800 p-3 rounded-lg">
        <div class="flex items-center justify-between mb-3">
            <h3 class="text-white text-sm font-semibold">Workpiece Starts</h3>
            <button @click="addNewStart"
                class="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors">
                + Neu
            </button>
        </div>

        <!-- Liste der Workpiece Starts -->
        <div v-if="store.workpieceStarts.length > 0" class="space-y-2">
            <div v-for="ws in store.workpieceStarts" :key="ws.id"
                class="flex items-center gap-1 p-2 bg-slate-700 rounded">
                <!-- Farbiger Marker -->
                <div class="w-2 h-2 rounded-full bg-cyan-400 shrink-0"></div>

                <!-- Name (editierbar) -->
                <input type="text" :value="ws.name"
                    @change="updateName(ws.id, ($event.target as HTMLInputElement).value)"
                    class="flex-1 min-w-0 p-1 text-xs bg-slate-600 border border-slate-500 rounded text-white" />

                <!-- Koordinaten in Maschinen-Koordinaten (X = Slicer Y, Y = Slicer X) -->
                <div class="flex items-center gap-0.5 shrink-0">
                    <span class="text-slate-400 text-xs">X</span>
                    <input type="number" inputmode="numeric"
                        :value="ws.y"
                        @change="updateMachineX(ws.id, $event)"
                        @blur="updateMachineX(ws.id, $event)"
                        :min="WORKPIECE_LIMITS.MACHINE_X_MIN" :max="WORKPIECE_LIMITS.MACHINE_X_MAX"
                        class="w-12 p-1 text-xs bg-slate-600 border border-slate-500 rounded text-white text-center"
                        :title="`Maschine X (${WORKPIECE_LIMITS.MACHINE_X_MIN}-${WORKPIECE_LIMITS.MACHINE_X_MAX})`" />
                    <span class="text-slate-400 text-xs">Y</span>
                    <input type="number" inputmode="numeric"
                        :value="ws.x"
                        @change="updateMachineY(ws.id, $event)"
                        @blur="updateMachineY(ws.id, $event)"
                        :min="WORKPIECE_LIMITS.MACHINE_Y_MIN" :max="WORKPIECE_LIMITS.MACHINE_Y_MAX"
                        class="w-12 p-1 text-xs bg-slate-600 border border-slate-500 rounded text-white text-center"
                        :title="`Maschine Y (${WORKPIECE_LIMITS.MACHINE_Y_MIN}-${WORKPIECE_LIMITS.MACHINE_Y_MAX})`" />
                </div>

                <!-- Löschen-Button -->
                <button @click="removeStart(ws.id)"
                    class="text-red-400 hover:text-red-300 text-sm shrink-0 ml-1">
                    ✕
                </button>
            </div>
        </div>

        <!-- Leerzustand -->
        <div v-else class="text-slate-400 text-xs text-center py-2">
            Keine Starts definiert
        </div>

        <div class="mt-2 text-xs text-slate-400 p-2 bg-slate-700/50 rounded space-y-1">
            <div>SVG-Ursprung (0,0) wird an den gewählten Start platziert</div>
            <div class="text-slate-500">
                Limits: X {{ WORKPIECE_LIMITS.MACHINE_X_MIN }}-{{ WORKPIECE_LIMITS.MACHINE_X_MAX }}mm,
                Y {{ WORKPIECE_LIMITS.MACHINE_Y_MIN }}-{{ WORKPIECE_LIMITS.MACHINE_Y_MAX }}mm
                <span class="block mt-0.5">(Werkzeugkasten-Bereich bei niedrigem X)</span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useMainStore, WORKPIECE_LIMITS } from '../store';

const store = useMainStore();

let startCounter = 1;

// Clamp-Funktion für Limits
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const addNewStart = () => {
    const name = `Start ${startCounter++}`;
    // Neuer Start am Minimum der Maschinen-Koordinaten
    // Maschine X → Slicer Y, Maschine Y → Slicer X
    const slicerX = WORKPIECE_LIMITS.MACHINE_Y_MIN;  // Maschine Y → Slicer X
    const slicerY = WORKPIECE_LIMITS.MACHINE_X_MIN;  // Maschine X → Slicer Y
    store.addWorkpieceStart(name, slicerX, slicerY);
};

const updateName = (id: string, name: string) => {
    store.updateWorkpieceStartName(id, name);
};

// Maschine X ändern (= Slicer Y)
const updateMachineX = (id: string, event: Event) => {
    const input = event.target as HTMLInputElement;
    const machineX = Number(input.value) || WORKPIECE_LIMITS.MACHINE_X_MIN;
    const clampedMachineX = clamp(machineX, WORKPIECE_LIMITS.MACHINE_X_MIN, WORKPIECE_LIMITS.MACHINE_X_MAX);

    // Input-Feld auf geclampten Wert setzen
    input.value = String(clampedMachineX);

    // Finde aktuellen Workpiece Start für Slicer X (= Maschine Y)
    const ws = store.workpieceStarts.find(w => w.id === id);
    if (ws) {
        // Slicer X bleibt gleich (ws.x), Slicer Y wird zu Maschine X
        store.updateWorkpieceStart(id, ws.x, clampedMachineX);
    }
};

// Maschine Y ändern (= Slicer X)
const updateMachineY = (id: string, event: Event) => {
    const input = event.target as HTMLInputElement;
    const machineY = Number(input.value) || WORKPIECE_LIMITS.MACHINE_Y_MIN;
    const clampedMachineY = clamp(machineY, WORKPIECE_LIMITS.MACHINE_Y_MIN, WORKPIECE_LIMITS.MACHINE_Y_MAX);

    // Input-Feld auf geclampten Wert setzen
    input.value = String(clampedMachineY);

    // Finde aktuellen Workpiece Start für Slicer Y (= Maschine X)
    const ws = store.workpieceStarts.find(w => w.id === id);
    if (ws) {
        // Slicer X wird zu Maschine Y, Slicer Y bleibt gleich (ws.y)
        store.updateWorkpieceStart(id, clampedMachineY, ws.y);
    }
};

const removeStart = (id: string) => {
    store.removeWorkpieceStart(id);
};
</script>
