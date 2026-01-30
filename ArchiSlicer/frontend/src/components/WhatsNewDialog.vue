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
        version: '0.10.0',
        date: '30.01.2026',
        title: 'Mittellinie-Extraktion für Text',
        changes: [
            'Neue Centerline-Funktion: Extrahiert Mittellinien aus geschlossenen Formen (Text, schmale Objekte)',
            'Voronoi-Methode (empfohlen): Mathematisch korrekte Medial-Axis-Extraktion',
            'Skeleton-Methode: Zhang-Suen Thinning mit Endpoint-Extension',
            'Offset-Methode: Polygon-Schrumpf für Ring-Formen (O, P, Q, R)',
            'Spoke-Filter: Entfernt Eck-Artefakte bei Voronoi-Extraktion',
            'Live-Preview: Centerline wird bei Parameteränderung automatisch aktualisiert',
            'G-Code Export: Centerline ersetzt Outline für saubere einzeilige Schrift',
        ]
    },
    {
        version: '0.9.0',
        date: '29.01.2026',
        title: 'G-Code Simulator',
        changes: [
            'Neuer interaktiver G-Code Simulator: Visualisiert generierten G-Code in Echtzeit',
            '3D-Stift-Visualisierung mit Tool-Farbe und animierter Bewegung',
            'Playback-Steuerung: Play/Pause, Geschwindigkeit (0.5x-10x), Timeline-Scrubbing',
            'Makro-Expansion: Werkzeugwechsel-Fahrwege werden vollständig animiert',
            'Fehler-Anzeige: Unbekannte Makros, Out-of-Bounds, ungültige Befehle',
            'Statistiken: Zeichenlänge, Fahrweg, Pumps, verwendete Tools',
            'Toggle für Fahrwege und Pump-Indikatoren',
        ]
    },
    {
        version: '0.8.5',
        date: '29.01.2026',
        title: 'Visual Hole Editor',
        changes: [
            'Neuer visueller Editor für Path-Rollen: Klicke auf Flächen um Outer/Hole/Nested zu ändern',
            'Farbcodierte Overlays: Grün = Outer, Rot = Hole, Blau = Nested',
            'Gelber Rand zeigt manuell überschriebene Rollen an',
            'Nested Objects werden jetzt korrekt aus Parent-Infill ausgespart',
            'Fix: Kamera zoomt auf korrekte Position inkl. Workpiece-Offset',
            'Fix: Workpiece Start Marker werden initial angezeigt',
        ]
    },
    {
        version: '0.8.4',
        date: '29.01.2026',
        title: 'Outlines Toggle & Workpiece Start Limits',
        changes: [
            'Neuer Outlines-Toggle pro Farbe: Konturen ausblenden, nur Infill zeichnen (▢/▣ Button)',
            'Workpiece Start Limits: X 100-1150mm, Y 50-1800mm (Werkzeugkasten-Bereich ausgespart)',
            'Eingabefelder zeigen jetzt Maschinen-Koordinaten (nicht Slicer-Koordinaten)',
            'Neue SVGs werden automatisch am ersten Workpiece Start platziert',
            'Input-Validierung mit automatischer Korrektur bei ungültigen Werten',
        ]
    },
    {
        version: '0.8.3',
        date: '29.01.2026',
        title: 'Farb-Reihenfolge & Export-Modus',
        changes: [
            'Farben manuell sortierbar: Pfeile (↑↓) zum Ändern der Zeichenreihenfolge',
            'Neuer Export-Modus im G-Code Panel: "Tool" (minimiert Werkzeugwechsel) oder "Layer" (Farb-Reihenfolge)',
            'Position (1., 2., 3., ...) wird bei jeder Farbe angezeigt',
            'ZigZag-Pattern jetzt auch im Farb-Infill-Dropdown verfügbar',
        ]
    },
    {
        version: '0.8.2',
        date: '29.01.2026',
        title: 'ZigZag Infill Pattern',
        changes: [
            'Neues ZigZag-Infill-Muster: Kontinuierliche Zickzack-Linien mit minimalen Pen-Lifts',
            'Erzeugt zusammenhängende Polylines statt einzelner Segmente',
            'Ideal für schnelles Füllen großer Flächen',
        ]
    },
    {
        version: '0.8.1',
        date: '09.01.2026',
        title: 'Auto-Show "What\'s New"',
        changes: [
            '"What\'s New" Dialog wird automatisch beim ersten Start nach Update angezeigt',
            'Version wird in localStorage gespeichert (nur einmal pro Version)',
            'Dialog kann weiterhin manuell über Button geöffnet werden',
        ]
    },
    {
        version: '0.8.0',
        date: '09.01.2026',
        title: 'Layer System & TSP-Optimierung',
        changes: [
            'Hierarchische Layer-UI: Datei-Layer mit ausklappbaren Farb-Layern',
            'Visibility-Toggle funktioniert jetzt in 3D-Preview und GCode-Export',
            'Fallback-Mechanismus: File-Settings als Default für Farben',
            'Resizable Sidebar mit localStorage-Persistenz',
            'Animierte Collapse-Pfeile (einheitlich 180° Rotation)',
            'TSP-Optimierung: Kompletter Wechsel zu Greedy-Algorithmus (schnell & effektiv)',
            'NULL-Segmente werden automatisch herausgefiltert',
            'Korrekte Travel-Distance-Berechnung (AS-IS ohne Optimierung)',
            'Fix: Log zeigt jetzt korrekt +/- Prozent bei Verschlechterung/Verbesserung',
        ]
    },
    {
        version: '0.7.4',
        date: '08.01.2026',
        title: 'Pumping Fix für Polylines',
        changes: [
            'Fix: Pumping erfolgt jetzt auf dem Papier (Stift unten), nicht in der Luft',
            'Pumping während langer Polylines (z.B. alle 20mm in 50mm Ring)',
            'Korrekte Sequenz: Zeichnen → Pumpen → Stift heben',
        ]
    },
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
