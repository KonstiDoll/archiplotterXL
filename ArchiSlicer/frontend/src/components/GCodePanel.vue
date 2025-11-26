<template>
    <div class="flex flex-col h-full bg-slate-100 rounded-lg overflow-hidden">
        <!-- Header with Generate Button -->
        <div class="flex items-center justify-between p-3 bg-slate-200 border-b">
            <div class="flex items-center space-x-3">
                <button @click="$emit('generate')"
                    class="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
                    :disabled="!hasItems">
                    G-Code generieren
                </button>
                <span v-if="!hasItems" class="text-xs text-slate-500">
                    Keine SVGs geladen
                </span>
            </div>
            <div class="flex items-center space-x-2">
                <button v-if="gcode" @click="copyToClipboard"
                    class="px-3 py-1 text-sm bg-slate-600 hover:bg-slate-700 text-white rounded transition-colors">
                    {{ copied ? '✓ Kopiert' : 'Kopieren' }}
                </button>
                <button v-if="gcode" @click="downloadGcode"
                    class="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors">
                    Download
                </button>
            </div>
        </div>

        <!-- G-Code Output -->
        <div class="flex-grow p-3 overflow-hidden">
            <textarea
                :value="gcode"
                readonly
                placeholder="G-Code wird hier angezeigt..."
                class="w-full h-full bg-white p-3 rounded border border-slate-300 font-mono text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
    gcode: string;
    hasItems: boolean;
    filename: string;
}>();

defineEmits<{
    (e: 'generate'): void;
}>();

const copied = ref(false);

const copyToClipboard = async () => {
    if (props.gcode) {
        await navigator.clipboard.writeText(props.gcode);
        copied.value = true;
        setTimeout(() => copied.value = false, 2000);
    }
};

const downloadGcode = () => {
    if (props.gcode) {
        const blob = new Blob([props.gcode], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = props.filename || 'output.gcode';
        a.click();
        URL.revokeObjectURL(url);
    }
};
</script>
