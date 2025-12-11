<template>
    <div v-if="isOpen" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div class="bg-slate-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <!-- Header -->
            <h2 class="text-white text-lg font-semibold mb-4">
                {{ mode === 'saveAs' ? 'Projekt speichern als' : 'Projekt speichern' }}
            </h2>

            <!-- Form -->
            <div class="space-y-4">
                <!-- Project name -->
                <div>
                    <label class="block text-slate-300 text-sm mb-1">Projektname</label>
                    <input
                        v-model="projectName"
                        type="text"
                        placeholder="Mein Projekt"
                        class="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-blue-500 focus:outline-none"
                        @keydown.enter="save" />
                </div>

                <!-- Description (optional, only for new projects) -->
                <div v-if="mode === 'saveAs' || !currentProjectId">
                    <label class="block text-slate-300 text-sm mb-1">Beschreibung (optional)</label>
                    <textarea
                        v-model="description"
                        rows="2"
                        placeholder="Projektbeschreibung..."
                        class="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-blue-500 focus:outline-none resize-none" />
                </div>

                <!-- Version message (optional, only when updating existing project) -->
                <div v-if="mode === 'save' && currentProjectId && (saveLocation === 'server' || saveLocation === 'both')">
                    <label class="block text-slate-300 text-sm mb-1">Änderungsnotiz (optional)</label>
                    <input
                        v-model="versionMessage"
                        type="text"
                        placeholder="z.B. Farben angepasst, neue SVG hinzugefügt..."
                        class="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-blue-500 focus:outline-none" />
                </div>

                <!-- Save location choice -->
                <div>
                    <label class="block text-slate-300 text-sm mb-2">Speicherort</label>
                    <div class="flex gap-2">
                        <button
                            @click="saveLocation = 'server'"
                            :class="[
                                'flex-1 px-3 py-2 rounded text-sm transition-colors',
                                saveLocation === 'server'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            ]">
                            Server
                        </button>
                        <button
                            @click="saveLocation = 'local'"
                            :class="[
                                'flex-1 px-3 py-2 rounded text-sm transition-colors',
                                saveLocation === 'local'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            ]">
                            Lokal
                        </button>
                        <button
                            @click="saveLocation = 'both'"
                            :class="[
                                'flex-1 px-3 py-2 rounded text-sm transition-colors',
                                saveLocation === 'both'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            ]">
                            Beides
                        </button>
                    </div>
                </div>

                <!-- Error message -->
                <div v-if="error" class="p-3 bg-red-900/30 rounded text-red-400 text-sm">
                    {{ error }}
                </div>

                <!-- Success message -->
                <div v-if="successMessage" class="p-3 bg-green-900/30 rounded text-green-400 text-sm">
                    {{ successMessage }}
                </div>
            </div>

            <!-- Buttons -->
            <div class="flex gap-3 mt-6">
                <button
                    @click="close"
                    class="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded">
                    Abbrechen
                </button>
                <button
                    @click="save"
                    :disabled="!canSave || isSaving"
                    class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-500 text-white rounded">
                    {{ isSaving ? 'Speichern...' : 'Speichern' }}
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useMainStore } from '../store';
import {
    createProject,
    updateProject,
    downloadProjectFile,
    currentProjectId,
    currentProjectName,
} from '../utils/project_services';

const props = defineProps<{
    isOpen: boolean;
    mode: 'save' | 'saveAs';
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'saved'): void;
}>();

const store = useMainStore();

const projectName = ref('');
const description = ref('');
const versionMessage = ref('');
const saveLocation = ref<'server' | 'local' | 'both'>('server');
const isSaving = ref(false);
const error = ref<string | null>(null);
const successMessage = ref<string | null>(null);

const canSave = computed(() => projectName.value.trim().length > 0);

// Initialize form when dialog opens
watch(() => props.isOpen, (open) => {
    if (open) {
        // Use existing project name if available and not "save as"
        if (props.mode === 'save' && currentProjectName.value) {
            projectName.value = currentProjectName.value;
        } else {
            projectName.value = currentProjectName.value || 'Neues Projekt';
        }
        description.value = '';
        versionMessage.value = '';
        error.value = null;
        successMessage.value = null;
    }
});

async function save() {
    if (!canSave.value || isSaving.value) return;

    isSaving.value = true;
    error.value = null;
    successMessage.value = null;

    const name = projectName.value.trim();

    try {
        // Get project data from store
        const projectData = store.getProjectData(name);

        // Save to server if requested
        if (saveLocation.value === 'server' || saveLocation.value === 'both') {
            // If we have an existing project ID and this is a "save" (not "save as"), update it
            if (props.mode === 'save' && currentProjectId.value) {
                await updateProject(currentProjectId.value, {
                    name,
                    description: description.value || undefined,
                    project_data: projectData,
                    version_message: versionMessage.value || undefined,
                });
                console.log(`Project ${currentProjectId.value} updated`);
            } else {
                // Create new project
                const response = await createProject(name, projectData, description.value || undefined);
                console.log(`Project created with ID ${response.id}`);
            }
        }

        // Download locally if requested
        if (saveLocation.value === 'local' || saveLocation.value === 'both') {
            downloadProjectFile(projectData);
        }

        // Update current project name
        currentProjectName.value = name;

        successMessage.value = 'Projekt gespeichert!';

        // Close after short delay
        setTimeout(() => {
            emit('saved');
            close();
        }, 1000);
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Fehler beim Speichern';
    } finally {
        isSaving.value = false;
    }
}

function close() {
    emit('close');
}
</script>
