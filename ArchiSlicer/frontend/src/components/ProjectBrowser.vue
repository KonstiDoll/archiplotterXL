<template>
    <div v-if="isOpen" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div class="bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <!-- Header -->
            <div class="flex justify-between items-center p-4 border-b border-slate-700">
                <h2 class="text-white text-lg font-semibold">Projekte</h2>
                <button @click="close" class="text-slate-400 hover:text-white">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto p-4">
                <!-- Loading state -->
                <div v-if="isLoading" class="text-center py-8 text-slate-400">
                    Lade Projekte...
                </div>

                <!-- Error state -->
                <div v-else-if="error" class="text-center py-8">
                    <p class="text-red-400 mb-4">{{ error }}</p>
                    <button @click="loadProjects" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">
                        Erneut versuchen
                    </button>
                </div>

                <!-- Empty state -->
                <div v-else-if="projects.length === 0" class="text-center py-8 text-slate-400">
                    <p>Keine Projekte vorhanden.</p>
                    <p class="text-sm mt-2">Speichere dein erstes Projekt mit "Speichern".</p>
                </div>

                <!-- Projects list -->
                <div v-else class="space-y-2">
                    <div
                        v-for="project in projects"
                        :key="project.id"
                        class="p-3 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors cursor-pointer group"
                        @click="openProject(project.id)">
                        <div class="flex justify-between items-start">
                            <div class="flex-1 min-w-0">
                                <h3 class="text-white font-medium truncate">{{ project.name }}</h3>
                                <p v-if="project.description" class="text-slate-400 text-sm truncate mt-1">
                                    {{ project.description }}
                                </p>
                                <p class="text-slate-500 text-xs mt-1">
                                    Zuletzt bearbeitet: {{ formatDate(project.updated_at) }}
                                </p>
                            </div>
                            <button
                                @click.stop="confirmDelete(project)"
                                class="ml-2 p-1 text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Projekt löschen">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Footer with local file upload -->
            <div class="p-4 border-t border-slate-700">
                <div class="flex items-center gap-4">
                    <label class="flex-1 cursor-pointer">
                        <div class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-center text-sm">
                            Lokale Datei öffnen (.archislicer)
                        </div>
                        <input
                            type="file"
                            accept=".archislicer,application/json"
                            class="hidden"
                            @change="handleFileUpload" />
                    </label>
                    <button @click="close" class="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm">
                        Schließen
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Delete confirmation dialog -->
    <div v-if="projectToDelete" class="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
        <div class="bg-slate-800 rounded-lg shadow-xl p-6 max-w-md">
            <h3 class="text-white text-lg font-semibold mb-4">Projekt löschen?</h3>
            <p class="text-slate-300 mb-6">
                Möchtest du das Projekt "{{ projectToDelete.name }}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div class="flex gap-3 justify-end">
                <button
                    @click="projectToDelete = null"
                    class="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded">
                    Abbrechen
                </button>
                <button
                    @click="deleteConfirmed"
                    :disabled="isDeleting"
                    class="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded">
                    {{ isDeleting ? 'Löschen...' : 'Löschen' }}
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useMainStore } from '../store';
import {
    fetchProjects,
    fetchProject,
    deleteProject,
    readProjectFile,
    currentProjectId,
    currentProjectName,
    clearCurrentProject,
    type ProjectListItem,
} from '../utils/project_services';

const props = defineProps<{
    isOpen: boolean;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'project-loaded'): void;
}>();

const store = useMainStore();

const projects = ref<ProjectListItem[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);
const projectToDelete = ref<ProjectListItem | null>(null);
const isDeleting = ref(false);

// Load projects when dialog opens
watch(() => props.isOpen, (open) => {
    if (open) {
        loadProjects();
    }
});

async function loadProjects() {
    isLoading.value = true;
    error.value = null;
    try {
        projects.value = await fetchProjects();
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Fehler beim Laden';
    } finally {
        isLoading.value = false;
    }
}

async function openProject(projectId: number) {
    isLoading.value = true;
    error.value = null;
    try {
        const response = await fetchProject(projectId);
        await store.loadProjectData(response.project_data);
        currentProjectId.value = projectId;
        currentProjectName.value = response.name;
        emit('project-loaded');
        close();
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Fehler beim Öffnen';
    } finally {
        isLoading.value = false;
    }
}

function confirmDelete(project: ProjectListItem) {
    projectToDelete.value = project;
}

async function deleteConfirmed() {
    if (!projectToDelete.value) return;

    isDeleting.value = true;
    try {
        await deleteProject(projectToDelete.value.id);
        // Reload project list
        await loadProjects();
        projectToDelete.value = null;
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Fehler beim Löschen';
    } finally {
        isDeleting.value = false;
    }
}

async function handleFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    isLoading.value = true;
    error.value = null;
    try {
        const projectData = await readProjectFile(file);
        await store.loadProjectData(projectData);
        // Local file - no server ID
        clearCurrentProject();
        currentProjectName.value = projectData.name;
        emit('project-loaded');
        close();
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Fehler beim Laden der Datei';
    } finally {
        isLoading.value = false;
        // Reset input
        input.value = '';
    }
}

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function close() {
    emit('close');
}
</script>
