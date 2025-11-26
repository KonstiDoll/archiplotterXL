<template>
    <div class="bg-slate-800 p-3 rounded-lg">
        <h3 class="text-white text-sm font-semibold mb-3 text-center">Werkzeuge & Stifte</h3>
        <div class="space-y-2">
            <div v-for="(tool, index) in tools" :key="index"
                class="flex items-center space-x-2">
                <!-- Tool-Button -->
                <button
                    class="w-10 h-10 rounded-lg flex items-center justify-center font-bold transition-colors"
                    :class="activeToolIndex === index + 1
                        ? 'bg-orange-600 text-white'
                        : 'bg-slate-600 text-slate-200 hover:bg-slate-500'"
                    @click="$emit('select-tool', index + 1)">
                    {{ tool.name }}
                </button>

                <!-- Stift-Selektor -->
                <select
                    :value="toolPenTypes[index]"
                    @change="$emit('update-pen-type', index, ($event.target as HTMLSelectElement).value)"
                    class="flex-grow p-2 text-sm border border-slate-600 rounded bg-slate-700 text-white">
                    <option v-for="pen in availablePens" :key="pen" :value="pen">
                        {{ pen }}
                    </option>
                </select>
            </div>
        </div>
        <div class="mt-3 text-xs text-slate-400 p-2 bg-slate-700/50 rounded">
            Stift-Zuordnung gilt für alle SVGs mit diesem Werkzeug.
        </div>
    </div>
</template>

<script setup lang="ts">
import { availablePens } from '../utils/gcode_services';

defineProps<{
    activeToolIndex: number;
    toolPenTypes: string[];
}>();

defineEmits<{
    (e: 'select-tool', toolIndex: number): void;
    (e: 'update-pen-type', index: number, penType: string): void;
}>();

const tools = [
    { name: '1' }, { name: '2' }, { name: '3' },
    { name: '4' }, { name: '5' }, { name: '6' },
    { name: '7' }, { name: '8' }, { name: '9' },
];
</script>
