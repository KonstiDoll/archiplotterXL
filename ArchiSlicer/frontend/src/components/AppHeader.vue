<template>
    <header class="flex items-center justify-between h-14 px-6 bg-slate-900 text-white shrink-0">
        <div class="flex items-center space-x-3">
            <div class="text-xl font-bold tracking-wide">ArchiSlicer</div>
            <div class="text-xs text-slate-400">Multi-Layer SVG to G-Code</div>
        </div>

        <!-- Project Controls -->
        <div class="flex items-center space-x-2">
            <!-- Current project name -->
            <span v-if="currentProjectName" class="text-sm text-slate-400 mr-2">
                {{ currentProjectName }}
            </span>

            <!-- New Project -->
            <button
                @click="handleNewProject"
                class="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 rounded flex items-center gap-1"
                title="Neues Projekt">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Neu</span>
            </button>

            <!-- Open Project -->
            <button
                @click="showProjectBrowser = true"
                class="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 rounded flex items-center gap-1"
                title="Projekt öffnen">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span>Öffnen</span>
            </button>

            <!-- Save Project -->
            <button
                @click="handleSave"
                class="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 rounded flex items-center gap-1"
                title="Projekt speichern">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                <span>Speichern</span>
            </button>

            <!-- Save As -->
            <button
                @click="openSaveDialog('saveAs')"
                class="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 rounded"
                title="Speichern unter...">
                <span>Speichern als...</span>
            </button>

            <!-- Version & What's New -->
            <button
                @click="showWhatsNew = true"
                class="flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-300 ml-2 transition-colors"
                title="Was ist neu?">
                <span>v{{ version }}</span>
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </button>
        </div>
    </header>

    <!-- Project Browser Dialog -->
    <ProjectBrowser
        :is-open="showProjectBrowser"
        @close="showProjectBrowser = false"
        @project-loaded="handleProjectLoadedFromBrowser"
    />

    <!-- Save Project Dialog -->
    <SaveProjectDialog
        :is-open="showSaveDialog"
        :mode="saveDialogMode"
        :background-preset="props.backgroundPreset"
        :custom-background-color="props.customBackgroundColor"
        :tool-configs="props.toolConfigs"
        @close="showSaveDialog = false"
        @saved="handleProjectSaved"
    />

    <!-- What's New Dialog -->
    <WhatsNewDialog
        :is-open="showWhatsNew"
        @close="handleWhatsNewClose"
    />

    <!-- New Project Confirmation -->
    <div v-if="showNewConfirm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div class="bg-slate-800 rounded-lg shadow-xl p-6 max-w-md">
            <h3 class="text-white text-lg font-semibold mb-4">Neues Projekt?</h3>
            <p class="text-slate-300 mb-6">
                Möchtest du ein neues Projekt starten? Ungespeicherte Änderungen gehen verloren.
            </p>
            <div class="flex gap-3 justify-end">
                <button
                    @click="showNewConfirm = false"
                    class="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded">
                    Abbrechen
                </button>
                <button
                    @click="confirmNewProject"
                    class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">
                    Neues Projekt
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { version } from '../../package.json';
import { useMainStore } from '../store';
import ProjectBrowser from './ProjectBrowser.vue';
import SaveProjectDialog from './SaveProjectDialog.vue';
import WhatsNewDialog from './WhatsNewDialog.vue';
import {
    currentProjectId,
    currentProjectName,
    clearCurrentProject,
} from '../utils/project_services';

interface ToolConfig {
    penType: string;
    color: string;
}

const props = defineProps<{
    backgroundPreset?: string;
    customBackgroundColor?: string;
    toolConfigs?: ToolConfig[];
}>();

const emit = defineEmits<{
    (e: 'project-loaded', data: { backgroundPreset?: string; customBackgroundColor?: string; toolConfigs?: ToolConfig[] }): void;
}>();

const store = useMainStore();

const showProjectBrowser = ref(false);
const showSaveDialog = ref(false);
const saveDialogMode = ref<'save' | 'saveAs'>('save');
const showNewConfirm = ref(false);
const showWhatsNew = ref(false);

// LocalStorage Key für letzte gesehene Version
const STORAGE_KEY_LAST_VERSION = 'archislicer_lastSeenVersion';

// Beim Start prüfen, ob neue Version vorhanden ist
onMounted(() => {
    const lastSeenVersion = localStorage.getItem(STORAGE_KEY_LAST_VERSION);
    if (lastSeenVersion !== version) {
        // Neue Version! Dialog automatisch anzeigen
        showWhatsNew.value = true;
    }
});

// Handler für Dialog-Schließen
function handleWhatsNewClose() {
    showWhatsNew.value = false;
    // Version im localStorage speichern
    localStorage.setItem(STORAGE_KEY_LAST_VERSION, version);
}

function handleNewProject() {
    // If there are items, ask for confirmation
    if (store.svgItems.length > 0) {
        showNewConfirm.value = true;
    } else {
        confirmNewProject();
    }
}

function confirmNewProject() {
    store.clearProject();
    clearCurrentProject();
    showNewConfirm.value = false;
}

function handleSave() {
    // If we have an existing project, save directly; otherwise show dialog
    if (currentProjectId.value) {
        openSaveDialog('save');
    } else {
        openSaveDialog('saveAs');
    }
}

function openSaveDialog(mode: 'save' | 'saveAs') {
    saveDialogMode.value = mode;
    showSaveDialog.value = true;
}

interface ProjectLoadedData {
    backgroundPreset?: string;
    customBackgroundColor?: string;
    toolConfigs?: ToolConfig[];
}

function handleProjectLoadedFromBrowser(data: ProjectLoadedData) {
    console.log('Project loaded successfully, forwarding settings:', data);
    // Forward to App.vue
    emit('project-loaded', data);
}

function handleProjectSaved() {
    console.log('Project saved successfully');
}
</script>
