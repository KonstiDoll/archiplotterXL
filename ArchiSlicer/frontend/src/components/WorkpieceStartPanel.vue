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

                <!-- Koordinaten kompakt -->
                <div class="flex items-center gap-0.5 shrink-0">
                    <input type="text" inputmode="numeric" :value="ws.x"
                        @change="updatePosition(ws.id, Number(($event.target as HTMLInputElement).value) || 0, ws.y)"
                        class="w-10 p-1 text-xs bg-slate-600 border border-slate-500 rounded text-white text-center"
                        title="X" />
                    <span class="text-slate-500 text-xs">/</span>
                    <input type="text" inputmode="numeric" :value="ws.y"
                        @change="updatePosition(ws.id, ws.x, Number(($event.target as HTMLInputElement).value) || 0)"
                        class="w-10 p-1 text-xs bg-slate-600 border border-slate-500 rounded text-white text-center"
                        title="Y" />
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

        <div class="mt-2 text-xs text-slate-400 p-2 bg-slate-700/50 rounded">
            SVG-Ursprung (0,0) wird an den gewählten Start platziert
        </div>
    </div>
</template>

<script setup lang="ts">
import { useMainStore } from '../store';

const store = useMainStore();

let startCounter = 1;

const addNewStart = () => {
    const name = `Start ${startCounter++}`;
    store.addWorkpieceStart(name, 0, 0);
};

const updateName = (id: string, name: string) => {
    store.updateWorkpieceStartName(id, name);
};

const updatePosition = (id: string, x: number, y: number) => {
    store.updateWorkpieceStart(id, x, y);
};

const removeStart = (id: string) => {
    store.removeWorkpieceStart(id);
};
</script>
