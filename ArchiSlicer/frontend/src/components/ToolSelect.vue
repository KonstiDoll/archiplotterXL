<template>
    <div class="relative" ref="containerRef">
        <!-- Selected Value Button -->
        <button
            type="button"
            @click="isOpen = !isOpen"
            class="flex items-center px-1.5 py-0.5 text-xs border border-slate-600 rounded bg-slate-700 text-white hover:bg-slate-600 transition-colors"
            :class="buttonClass"
        >
            <div
                class="w-3 h-3 rounded-sm border border-slate-500 mr-1 shrink-0"
                :style="{ backgroundColor: selectedColor }"
            ></div>
            <span>{{ modelValue }}</span>
            <span class="text-slate-400 text-[10px] ml-0.5">▼</span>
        </button>

        <!-- Dropdown -->
        <div
            v-if="isOpen"
            class="absolute z-50 mt-0.5 bg-slate-700 border border-slate-600 rounded shadow-lg overflow-y-auto max-h-48"
        >
            <button
                v-for="i in 9"
                :key="i"
                type="button"
                @click="selectTool(i)"
                class="flex items-center w-full px-1.5 py-1 text-xs text-white hover:bg-slate-600 transition-colors"
                :class="{ 'bg-slate-500': i === modelValue }"
            >
                <div
                    class="w-3 h-3 rounded-sm border border-slate-500 mr-1.5 shrink-0"
                    :style="{ backgroundColor: getToolColor(i) }"
                ></div>
                <span class="w-3">{{ i }}</span>
                <span class="ml-1 text-[10px] text-slate-400 truncate">{{ getToolType(i) }}</span>
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

interface ToolConfig {
    penType: string;
    color: string;
}

const props = defineProps<{
    modelValue: number;
    toolConfigs: ToolConfig[];
    buttonClass?: string;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: number): void;
}>();

const isOpen = ref(false);
const containerRef = ref<HTMLElement | null>(null);

// Schließe Dropdown bei Klick außerhalb
const handleClickOutside = (event: MouseEvent) => {
    if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
        isOpen.value = false;
    }
};

onMounted(() => {
    document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
});

const selectedColor = computed(() => {
    const index = props.modelValue - 1;
    if (index >= 0 && index < props.toolConfigs.length) {
        return props.toolConfigs[index].color;
    }
    return '#000000';
});

const getToolColor = (toolNumber: number): string => {
    const index = toolNumber - 1;
    if (index >= 0 && index < props.toolConfigs.length) {
        return props.toolConfigs[index].color;
    }
    return '#000000';
};

const getToolType = (toolNumber: number): string => {
    const index = toolNumber - 1;
    if (index >= 0 && index < props.toolConfigs.length) {
        return props.toolConfigs[index].penType;
    }
    return '';
};

const selectTool = (toolNumber: number) => {
    emit('update:modelValue', toolNumber);
    isOpen.value = false;
};
</script>
