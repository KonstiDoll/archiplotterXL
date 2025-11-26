<template>
    <div class="bg-white rounded-lg shadow-sm overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between p-3 bg-slate-100 border-b">
            <span class="font-medium text-sm truncate max-w-[140px]" :title="item.fileName">
                {{ item.fileName }}
            </span>
            <div class="flex items-center space-x-1">
                <button @click="$emit('move-up')"
                    class="p-1 rounded hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    :disabled="isFirst">
                    <span class="text-sm">↑</span>
                </button>
                <button @click="$emit('move-down')"
                    class="p-1 rounded hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    :disabled="isLast">
                    <span class="text-sm">↓</span>
                </button>
                <button @click="$emit('remove')"
                    class="p-1 rounded hover:bg-red-100 text-red-500 hover:text-red-700">
                    <span class="text-lg leading-none">&times;</span>
                </button>
            </div>
        </div>

        <!-- Settings -->
        <div class="p-3 space-y-3">
            <!-- Tool & Feedrate Row -->
            <div class="flex items-center space-x-3">
                <div class="flex items-center">
                    <label class="text-xs text-slate-500 mr-1">Tool:</label>
                    <select :value="item.toolNumber"
                        @change="$emit('update-tool', Number(($event.target as HTMLSelectElement).value))"
                        class="p-1 w-14 border rounded text-sm">
                        <option v-for="i in 9" :key="i" :value="i">{{ i }}</option>
                    </select>
                </div>
                <div class="flex items-center flex-grow">
                    <label class="text-xs text-slate-500 mr-1">Speed:</label>
                    <input type="number" :value="item.feedrate"
                        @change="$emit('update-feedrate', Number(($event.target as HTMLInputElement).value))"
                        class="p-1 w-20 border rounded text-sm" min="100" max="30000" step="100" />
                    <span class="text-xs text-slate-400 ml-1">mm/min</span>
                </div>
            </div>

            <!-- Infill Toggle Button -->
            <button @click="expanded = !expanded"
                class="w-full flex items-center justify-between p-2 rounded text-sm transition-colors"
                :class="item.infillOptions.patternType !== 'none'
                    ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'">
                <span>
                    {{ item.infillOptions.patternType !== 'none'
                        ? `Infill: ${item.infillOptions.patternType}`
                        : 'Kein Infill' }}
                </span>
                <span>{{ expanded ? '▲' : '▼' }}</span>
            </button>
        </div>

        <!-- Infill Options (Expandable) -->
        <div v-if="expanded" class="p-3 bg-slate-50 border-t space-y-3">
            <!-- Pattern Type -->
            <div class="flex items-center">
                <label class="w-20 text-xs text-slate-500">Pattern:</label>
                <select :value="item.infillOptions.patternType"
                    @change="$emit('update-pattern', ($event.target as HTMLSelectElement).value)"
                    class="flex-grow p-1 border rounded text-sm">
                    <option v-for="pt in patternTypes" :key="pt" :value="pt">{{ pt }}</option>
                </select>
            </div>

            <!-- Infill Tool -->
            <div class="flex items-center">
                <label class="w-20 text-xs text-slate-500">Infill Tool:</label>
                <select :value="item.infillToolNumber"
                    @change="$emit('update-infill-tool', Number(($event.target as HTMLSelectElement).value))"
                    class="flex-grow p-1 border rounded text-sm">
                    <option v-for="i in 9" :key="i" :value="i">{{ i }}</option>
                </select>
            </div>

            <!-- Density -->
            <div class="flex items-center">
                <label class="w-20 text-xs text-slate-500">Dichte:</label>
                <input type="range" :value="item.infillOptions.density"
                    @input="$emit('update-density', Number(($event.target as HTMLInputElement).value))"
                    :min="densityRange.min" :max="densityRange.max" :step="densityRange.step"
                    class="flex-grow" />
                <span class="w-12 text-right text-xs text-slate-500">{{ item.infillOptions.density.toFixed(1) }}mm</span>
            </div>

            <!-- Angle -->
            <div class="flex items-center">
                <label class="w-20 text-xs text-slate-500">Winkel:</label>
                <input type="range" :value="item.infillOptions.angle"
                    @input="$emit('update-angle', Number(($event.target as HTMLInputElement).value))"
                    min="0" max="180" step="5" class="flex-grow" />
                <span class="w-12 text-right text-xs text-slate-500">{{ item.infillOptions.angle }}°</span>
            </div>

            <!-- Outline Offset -->
            <div class="flex items-center">
                <label class="w-20 text-xs text-slate-500">Rand:</label>
                <input type="range" :value="item.infillOptions.outlineOffset"
                    @input="$emit('update-offset', Number(($event.target as HTMLInputElement).value))"
                    min="0" max="5" step="0.1" class="flex-grow" />
                <span class="w-12 text-right text-xs text-slate-500">{{ item.infillOptions.outlineOffset.toFixed(1) }}mm</span>
            </div>

            <!-- Action Buttons -->
            <div class="flex justify-end space-x-2 pt-2">
                <button @click="$emit('remove-infill')"
                    class="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">
                    Infill löschen
                </button>
                <button @click="$emit('generate-preview')"
                    class="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">
                    Vorschau
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { InfillPatternType, patternDensityRanges } from '../utils/threejs_services';

const props = defineProps<{
    item: {
        fileName: string;
        toolNumber: number;
        feedrate: number;
        infillToolNumber: number;
        infillOptions: {
            patternType: string;
            density: number;
            angle: number;
            outlineOffset: number;
        };
    };
    isFirst: boolean;
    isLast: boolean;
}>();

defineEmits<{
    (e: 'move-up'): void;
    (e: 'move-down'): void;
    (e: 'remove'): void;
    (e: 'update-tool', value: number): void;
    (e: 'update-feedrate', value: number): void;
    (e: 'update-pattern', value: string): void;
    (e: 'update-infill-tool', value: number): void;
    (e: 'update-density', value: number): void;
    (e: 'update-angle', value: number): void;
    (e: 'update-offset', value: number): void;
    (e: 'remove-infill'): void;
    (e: 'generate-preview'): void;
}>();

const expanded = ref(false);
const patternTypes = Object.values(InfillPatternType);

const densityRange = computed(() => {
    const pt = props.item.infillOptions.patternType as InfillPatternType;
    return patternDensityRanges[pt] || patternDensityRanges[InfillPatternType.LINES];
});
</script>
