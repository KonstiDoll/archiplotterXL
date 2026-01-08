<template>
    <Teleport to="body">
        <div v-if="isOpen" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="$emit('close')">
            <div class="bg-slate-800 rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
                <!-- Header -->
                <div class="flex items-center justify-between p-4 border-b border-slate-700">
                    <h2 class="text-white text-lg font-semibold">Was ist neu?</h2>
                    <button @click="$emit('close')" class="text-slate-400 hover:text-white">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <!-- Content -->
                <div class="flex-1 overflow-y-auto p-4 space-y-6">
                    <div v-for="release in changelog" :key="release.version" class="space-y-2">
                        <!-- Version Header -->
                        <div class="flex items-center space-x-2">
                            <span class="text-blue-400 font-mono font-semibold">v{{ release.version }}</span>
                            <span class="text-slate-500 text-sm">{{ release.date }}</span>
                            <span v-if="release.version === currentVersion"
                                class="px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">
                                Aktuell
                            </span>
                        </div>
                        <!-- Title -->
                        <h3 class="text-white font-medium">{{ release.title }}</h3>
                        <!-- Changes -->
                        <ul class="text-slate-300 text-sm space-y-1 list-disc list-inside">
                            <li v-for="(change, idx) in release.changes" :key="idx">{{ change }}</li>
                        </ul>
                    </div>
                </div>

                <!-- Footer -->
                <div class="p-4 border-t border-slate-700">
                    <button @click="$emit('close')"
                        class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">
                        Schließen
                    </button>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { version as currentVersion } from '../../package.json';

defineProps<{
    isOpen: boolean;
}>();

defineEmits<{
    (e: 'close'): void;
}>();

interface Release {
    version: string;
    date: string;
    title: string;
    changes: string[];
}

const changelog: Release[] = [
    {
        version: '0.7.3',
        date: '08.01.2026',
        title: 'Polyline-Optimierung für konzentrische Ringe',
        changes: [
            'Konzentrische Ringe als zusammenhängende Polylines (statt tausende Segmente)',
            'Beispiel: 11.000 Segmente → 100 Polylines (100x weniger!)',
            'TSP-Optimierung für Ringe: Rotation statt Umkehrung (erhält Ring-Struktur)',
            'Optimierung viel schneller durch weniger Segmente',
            'G-Code Generator funktioniert direkt mit Polylines',
        ]
    },
    {
        version: '0.7.2',
        date: '08.01.2026',
        title: 'Konzentrisches Infill Fix',
        changes: [
            'Fix: Konzentrisches Infill füllt jetzt alle Bereiche vollständig',
            'Keine Löcher mehr in komplexen Formen (z.B. Buchstaben)',
            'MultiPolygon-Splitting wird korrekt behandelt',
        ]
    },
    {
        version: '0.7.1',
        date: '08.01.2026',
        title: 'TSP-Optimierung für große Infills',
        changes: [
            'Automatischer Greedy-Algorithmus für >200 Linien (schnell!)',
            'Optimierung von 11.000 Linien in ~10 Sekunden statt 5+ Minuten',
            'OR-Tools für 4-200 Linien mit 300s Timeout (optimal)',
            'Timeout über API konfigurierbar (max. 600s)',
            'CORS-Fix für Port 5174',
        ]
    },
    {
        version: '0.7.0',
        date: '17.12.2025',
        title: 'Backend Infill-Generierung mit TSP-Optimierung',
        changes: [
            'Neues Python-Backend für Infill-Muster (Linien, Gitter, Konzentrisch, Kreuzschraffur)',
            'TSP-Optimierung reduziert Pen-Lifts und Fahrwege deutlich',
            'Task-Queue für Batch-Verarbeitung mehrerer Infill-Operationen',
            '"Alle generieren" und "Alle optimieren" Buttons',
            'Verbesserte Button-Labels und Lade-Animationen',
        ]
    },
    {
        version: '0.6.2',
        date: '17.12.2025',
        title: 'Hole Detection für mehrfarbige SVGs',
        changes: [
            'Globale Path-Analyse erkennt Löcher auch bei unterschiedlichen Farben',
            'Verbessertes Infill-Clipping für Text mit Innenflächen',
        ]
    },
    {
        version: '0.6.1',
        date: '11.12.2025',
        title: 'Kamera-Steuerung und DPI-Einstellungen',
        changes: [
            'Kamera-Kippen kann deaktiviert werden für 2D-Arbeit',
            'DPI-Einstellung pro SVG-Datei',
            'Dynamische Versionsanzeige',
        ]
    },
    {
        version: '0.6.0',
        date: '11.12.2025',
        title: 'Projekt-Verwaltung',
        changes: [
            'Projekte speichern und laden',
            'Projekt-Browser mit Vorschau',
            'Automatische Versionierung',
        ]
    },
];
</script>
