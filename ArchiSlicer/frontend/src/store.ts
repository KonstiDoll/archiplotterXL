import { defineStore } from 'pinia'
import * as THREE from 'three';
import { markRaw } from 'vue';
import { InfillOptions, InfillPatternType, defaultInfillOptions, analyzeColorsInGroup, getThreejsObjectFromSvg, generateInfillForColorAsync } from './utils/threejs_services';
import { optimizePathBackend, extractCenterlineBackend, CenterlineOptions, defaultCenterlineOptions } from './utils/infill-api';
import { PathAnalysisResult, PathRole, getEffectiveRole, analyzePathRelationshipsWithColors, extractPolygonsWithColorsFromGroup } from './utils/geometry/path-analysis';
import type { ProjectData, SerializedSVGItem, SerializedColorGroup, SerializedInfillLine } from './utils/project_services';
import { deserializeInfillGroup } from './utils/project_services';

// Interface für Infill-Statistiken
export interface InfillStats {
  totalLengthMm: number;      // Gesamte Zeichnungslänge
  travelLengthMm: number;     // Fahrstrecke (Pen-up)
  numSegments: number;        // Anzahl Liniensegmente
  numPenLifts: number;        // Anzahl Pen-Lifts
  isOptimized: boolean;       // Wurde TSP-Optimierung angewandt?
  optimizationMethod?: string; // Methode: "greedy" | "ortools"
}

// Interface für Centerline-Statistiken
export interface CenterlineStats {
  totalLengthMm: number;      // Gesamte Linienlänge
  numPolylines: number;       // Anzahl Polylinien
  processingTimeMs: number;   // Verarbeitungszeit
}

// Interface für Backend-Tasks in der Queue
export interface BackendTask {
  id: string;
  type: 'generate' | 'optimize';
  svgIndex: number;
  colorIndex: number | null;  // null = file-level
  status: 'pending' | 'running' | 'completed' | 'failed';
  label: string;  // Human-readable description
}

// Interface für Farbgruppen (erkannte Farben mit Tool-Zuordnung)
export interface ColorGroup {
  color: string;           // Hex-Farbe z.B. "#ff0000"
  toolNumber: number;      // Zugeordnetes Tool für Konturen (1-9), default: 1
  lineCount: number;       // Anzahl Linien mit dieser Farbe
  visible: boolean;        // Sichtbarkeit in Vorschau
  showOutlines: boolean;   // Konturen anzeigen (false = nur Infill, keine Konturen)
  useFileDefaults: boolean; // Wenn true, werden File-Level Settings als Fallback verwendet
  // Infill-Einstellungen pro Farbe
  infillEnabled: boolean;           // Infill an/aus für diese Farbe
  infillToolNumber: number;         // Tool für Infill (kann anders sein als Kontur-Tool)
  infillOptions: InfillOptions;     // Pattern, Dichte, Winkel, etc.
  infillGroup?: THREE.Group;        // Generierte Infill-Geometrie (optional)
  infillStats?: InfillStats;        // Statistiken zum Infill (Länge, Travel, etc.)
  // Centerline-Einstellungen pro Farbe (für dünne Schriftzüge/Formen)
  centerlineEnabled: boolean;       // Mittellinie statt Outline
  centerlineOptions: CenterlineOptions;  // Centerline-Parameter
  centerlineGroup?: THREE.Group;    // Generierte Mittellinie-Geometrie
  centerlineStats?: CenterlineStats; // Statistiken zur Mittellinie
}

// Interface für Workpiece Starts (Platzierungspunkte)
export interface WorkpieceStart {
  id: string;              // Eindeutige ID
  name: string;            // Anzeigename z.B. "Start 1", "Mitte"
  x: number;               // X-Position in mm
  y: number;               // Y-Position in mm
}

// Workpiece Start Limits (Maschinen-Koordinaten, wie der User sie sieht)
// Hinweis: Maschine X = Slicer Y, Maschine Y = Slicer X (intern getauscht)
export const WORKPIECE_LIMITS = {
  MACHINE_X_MIN: 100,   // Werkzeugkasten-Bereich unten
  MACHINE_X_MAX: 1150,
  MACHINE_Y_MIN: 50,
  MACHINE_Y_MAX: 1800,
};

// Interface für SVG-Geometrien mit Werkzeug-Informationen
export interface SVGItem {
  geometry: THREE.Group;
  toolNumber: number;       // Werkzeug für die Konturen (Fallback wenn nicht analysiert)
  infillToolNumber: number; // Werkzeug für das Infill (kann anders als für Konturen sein)
  fileName: string;
  penType: string;
  feedrate: number;         // Geschwindigkeit (mm/min)
  drawingHeight: number;    // Z-Höhe für verschiedene Materialstärken (mm)
  infillOptions: InfillOptions;  // Infill-Optionen für dieses SVG
  infillGroup?: THREE.Group;    // Optional: Generierte Infill-Gruppe
  infillStats?: InfillStats;    // Statistiken zum Infill (Länge, Travel, etc.)
  // Farb-Analyse
  colorGroups: ColorGroup[];   // Erkannte Farben mit Tool-Zuordnung
  isAnalyzed: boolean;         // Wurde Farbanalyse durchgeführt?
  // Path-Analyse (Hole Detection)
  pathAnalysis?: PathAnalysisResult;  // Ergebnis der Path-Analyse
  isPathAnalyzed: boolean;            // Wurde Path-Analyse durchgeführt?
  // Platzierung / Offset
  offsetX: number;             // X-Offset für Platzierung (mm)
  offsetY: number;             // Y-Offset für Platzierung (mm)
  workpieceStartId?: string;   // Optional: Referenz zum gewählten Workpiece Start
  // DPI-Skalierung
  dpi: number;                 // DPI für px→mm Umrechnung (Default: 72)
  svgContent?: string;         // Original SVG-Inhalt für Neuberechnung bei DPI-Änderung
}

export const useMainStore = defineStore('main', {
  state: () => ({
    // Statt einzelner Geometrie eine Liste von SVG-Items
    svgItems: [] as SVGItem[],
    // Für Kompatibilität behalten wir lineGeometry bei
    lineGeometry: null as THREE.Group | null,
    // Workpiece Starts (Platzierungspunkte)
    workpieceStarts: [
      { id: 'default_start_1', name: 'Start 1', x: 100, y: 100 }
    ] as WorkpieceStart[],
    // Default DPI für neue SVG-Imports
    defaultDpi: 72,
    // Kamera-Kippen erlauben (Default: false für 2D-Arbeit)
    cameraTiltEnabled: false,
    // Loading states für async Operationen
    infillGenerating: null as { svgIndex: number; colorIndex: number | null } | null,
    infillOptimizing: null as { svgIndex: number; colorIndex: number | null } | null,
    centerlineGenerating: null as { svgIndex: number; colorIndex: number } | null,
    // Backend task queue
    taskQueue: [] as BackendTask[],
    isProcessingQueue: false,
    // G-Code Export-Modus: 'tool' = gruppiert nach Werkzeug, 'layer' = Layer-Reihenfolge
    gcodeExportMode: 'tool' as 'tool' | 'layer',
    // Hole Editor Mode (visueller Editor für Path-Rollen)
    holeEditorMode: false,
    selectedPathId: null as string | null
  }),
  actions: {
    // Altes setLineGeometry für Kompatibilität
    setLineGeometry(geometry: THREE.Group) {
      this.lineGeometry = geometry;
    },
    
    // Neue Methode zum Hinzufügen einer SVG mit Werkzeug
    addSVGItem(
      geometry: THREE.Group,
      toolNumber: number,
      fileName: string,
      penType: string = 'stabilo-schwarz',
      infillOptions: InfillOptions = { ...defaultInfillOptions },
      feedrate: number = 3000,  // Standard-Geschwindigkeit
      infillToolNumber: number = toolNumber,  // Standardmäßig das gleiche Werkzeug wie für Konturen
      drawingHeight: number = 0,  // Standard-Zeichenhöhe (0 = Plattform)
      dpi: number = 96,  // Standard-DPI für px→mm Umrechnung
      svgContent?: string  // Original SVG-Inhalt für Neuberechnung bei DPI-Änderung
    ) {
      // Wenn Workpiece Starts existieren, ersten als Default nutzen
      const defaultStart = this.workpieceStarts.length > 0
        ? this.workpieceStarts[0]
        : null;

      this.svgItems.push({
        geometry,
        toolNumber,
        infillToolNumber,
        fileName,
        penType,
        feedrate,
        drawingHeight,
        infillOptions,
        colorGroups: [],    // Leer bis Analyse durchgeführt wird
        isAnalyzed: false,  // Noch nicht analysiert
        isPathAnalyzed: false,  // Path-Analyse noch nicht durchgeführt
        offsetX: defaultStart?.x ?? 0,
        offsetY: defaultStart?.y ?? 0,
        workpieceStartId: defaultStart?.id,
        dpi,
        svgContent
      });

      // Update auch lineGeometry für Kompatibilität
      this.lineGeometry = geometry;

      // Automatische Path-Analyse für Hole-Detection
      const newIndex = this.svgItems.length - 1;
      this.analyzePathRelationshipsAction(newIndex);
    },
    
    // Methode zum Aktualisieren des Werkzeugs eines SVG-Items
    updateSVGItemTool(index: number, toolNumber: number) {
      if (index >= 0 && index < this.svgItems.length) {
        this.svgItems[index].toolNumber = toolNumber;
      }
    },
    
    // Methode zum Aktualisieren des Stifttyps eines SVG-Items
    updateSVGItemPenType(index: number, penType: string) {
      if (index >= 0 && index < this.svgItems.length) {
        this.svgItems[index].penType = penType;
      }
    },
    
    // Methode zum Aktualisieren der Infill-Optionen eines SVG-Items
    updateSVGItemInfill(index: number, infillOptions: InfillOptions) {
      if (index >= 0 && index < this.svgItems.length) {
        this.svgItems[index].infillOptions = { ...infillOptions };
      }
    },
    
    // Methode zum Setzen der generierten Infill-Gruppe
    setSVGItemInfillGroup(index: number, infillGroup: THREE.Group | null) {
      if (index >= 0 && index < this.svgItems.length) {
        this.svgItems[index].infillGroup = infillGroup ?? undefined;
      }
    },
    
    // Methode zum Entfernen einer SVG
    removeSVGItem(index: number) {
      if (index >= 0 && index < this.svgItems.length) {
        this.svgItems.splice(index, 1);
        
        // Update lineGeometry mit dem letzten Element oder null
        this.lineGeometry = this.svgItems.length > 0 
          ? this.svgItems[this.svgItems.length - 1].geometry 
          : null;
      }
    },
    
    // Methode zum Verschieben eines SVG-Items nach oben
    moveItemUp(index: number) {
      if (index > 0 && index < this.svgItems.length) {
        // Tausche mit dem vorherigen Element
        const temp = this.svgItems[index];
        this.svgItems[index] = this.svgItems[index - 1];
        this.svgItems[index - 1] = temp;
      }
    },
    
    // Methode zum Verschieben eines SVG-Items nach unten
    moveItemDown(index: number) {
      if (index >= 0 && index < this.svgItems.length - 1) {
        // Tausche mit dem nächsten Element
        const temp = this.svgItems[index];
        this.svgItems[index] = this.svgItems[index + 1];
        this.svgItems[index + 1] = temp;
      }
    },

    // Methode zum Verschieben einer Farbe nach oben
    moveColorUp(itemIndex: number, colorIndex: number) {
      const item = this.svgItems[itemIndex];
      if (!item?.colorGroups || colorIndex <= 0) return;

      const temp = item.colorGroups[colorIndex];
      item.colorGroups[colorIndex] = item.colorGroups[colorIndex - 1];
      item.colorGroups[colorIndex - 1] = temp;
    },

    // Methode zum Verschieben einer Farbe nach unten
    moveColorDown(itemIndex: number, colorIndex: number) {
      const item = this.svgItems[itemIndex];
      if (!item?.colorGroups || colorIndex >= item.colorGroups.length - 1) return;

      const temp = item.colorGroups[colorIndex];
      item.colorGroups[colorIndex] = item.colorGroups[colorIndex + 1];
      item.colorGroups[colorIndex + 1] = temp;
    },

    // G-Code Export-Modus setzen
    setGcodeExportMode(mode: 'tool' | 'layer') {
      this.gcodeExportMode = mode;
    },

    // Methode zum Löschen aller SVGs
    clearSVGItems() {
      this.svgItems = [];
      this.lineGeometry = null;
    },
    
    // Methode zum Aktualisieren der Feedrate eines SVG-Items
    updateSVGItemFeedrate(index: number, feedrate: number) {
      if (index >= 0 && index < this.svgItems.length) {
        this.svgItems[index].feedrate = feedrate;
      }
    },
    
    // Methode zum Aktualisieren des Infill-Werkzeugs eines SVG-Items
    updateSVGItemInfillTool(index: number, infillToolNumber: number) {
      if (index >= 0 && index < this.svgItems.length) {
        this.svgItems[index].infillToolNumber = infillToolNumber;
      }
    },
    
    // Methode zum Aktualisieren der Zeichenhöhe eines SVG-Items
    updateSVGItemDrawingHeight(index: number, drawingHeight: number) {
      if (index >= 0 && index < this.svgItems.length) {
        this.svgItems[index].drawingHeight = drawingHeight;
      }
    },

    // Methode zum Aktualisieren der DPI eines SVG-Items (parst SVG neu)
    async updateSVGItemDpi(index: number, newDpi: number) {
      if (index >= 0 && index < this.svgItems.length) {
        const item = this.svgItems[index];
        const oldDpi = item.dpi;

        if (oldDpi === newDpi) return;

        // Wenn SVG-Inhalt vorhanden, neu parsen
        if (item.svgContent) {
          console.log(`DPI für "${item.fileName}" geändert: ${oldDpi} → ${newDpi} - parse SVG neu...`);

          // Neues Geometrie-Objekt mit neuer DPI erstellen
          const newGeometry = await getThreejsObjectFromSvg(item.svgContent, 0, newDpi);

          // Altes Infill entfernen (wird durch DPI-Änderung ungültig)
          if (item.infillGroup) {
            item.geometry.remove(item.infillGroup);
            item.infillGroup = undefined;
          }

          // Neue Geometrie setzen (markRaw für Vue-Reaktivität)
          item.geometry = markRaw(newGeometry);
          item.dpi = newDpi;

          // Path-Analyse zurücksetzen und neu durchführen
          item.isPathAnalyzed = false;
          this.analyzePathRelationshipsAction(index);

          // Trigger scene update durch Array-Referenz-Änderung
          this.svgItems = [...this.svgItems];

          console.log(`SVG "${item.fileName}" mit ${newDpi} DPI neu geparst`);
        } else {
          console.warn(`Kein SVG-Inhalt für "${item.fileName}" - kann DPI nicht ändern`);
        }
      }
    },

    // Default DPI für neue Imports setzen
    setDefaultDpi(dpi: number) {
      this.defaultDpi = dpi;
      console.log(`Default DPI auf ${dpi} gesetzt`);
    },

    // Kamera-Kippen aktivieren/deaktivieren
    setCameraTiltEnabled(enabled: boolean) {
      this.cameraTiltEnabled = enabled;
      console.log(`Kamera-Kippen ${enabled ? 'aktiviert' : 'deaktiviert'}`);
    },

    // ===== NEU: Farb-Analyse Actions =====

    // Farbanalyse für ein SVG-Item durchführen
    analyzeColors(index: number) {
      if (index >= 0 && index < this.svgItems.length) {
        const item = this.svgItems[index];
        const colorInfos = analyzeColorsInGroup(item.geometry);

        // ColorGroups erstellen - erben das Tool der Datei als Default
        const defaultTool = item.toolNumber;
        const defaultInfillTool = item.infillToolNumber;

        item.colorGroups = colorInfos.map(info => ({
          color: info.color,
          toolNumber: defaultTool,  // Erbe Kontur-Tool von der Datei
          lineCount: info.lineCount,
          visible: true,
          showOutlines: true,  // Konturen standardmäßig sichtbar
          useFileDefaults: true,  // Initial immer File-Defaults verwenden
          // Infill-Defaults - erben von Datei
          infillEnabled: false,
          infillToolNumber: defaultInfillTool,  // Erbe Infill-Tool von der Datei
          infillOptions: { ...defaultInfillOptions },
          // Centerline-Defaults
          centerlineEnabled: false,
          centerlineOptions: { ...defaultCenterlineOptions },
        }));

        item.isAnalyzed = true;
        console.log(`Farbanalyse für "${item.fileName}": ${item.colorGroups.length} Farben gefunden (Default-Tool: ${defaultTool})`);
      }
    },

    // Tool für eine Farbgruppe zuweisen
    setColorTool(svgIndex: number, colorIndex: number, toolNumber: number) {
      if (svgIndex >= 0 && svgIndex < this.svgItems.length) {
        const item = this.svgItems[svgIndex];
        if (colorIndex >= 0 && colorIndex < item.colorGroups.length) {
          item.colorGroups[colorIndex].toolNumber = toolNumber;
        }
      }
    },

    // Sichtbarkeit einer Farbgruppe togglen
    toggleColorVisibility(svgIndex: number, colorIndex: number) {
      if (svgIndex >= 0 && svgIndex < this.svgItems.length) {
        const item = this.svgItems[svgIndex];
        if (colorIndex >= 0 && colorIndex < item.colorGroups.length) {
          item.colorGroups[colorIndex].visible = !item.colorGroups[colorIndex].visible;
        }
      }
    },

    // Konturen-Sichtbarkeit einer Farbgruppe togglen (showOutlines)
    toggleColorOutlines(svgIndex: number, colorIndex: number) {
      if (svgIndex >= 0 && svgIndex < this.svgItems.length) {
        const item = this.svgItems[svgIndex];
        if (colorIndex >= 0 && colorIndex < item.colorGroups.length) {
          item.colorGroups[colorIndex].showOutlines = !item.colorGroups[colorIndex].showOutlines;
        }
      }
    },

    // Toggle useFileDefaults für eine Farbe
    toggleColorUseFileDefaults(svgIndex: number, colorIndex: number) {
      if (svgIndex >= 0 && svgIndex < this.svgItems.length) {
        const item = this.svgItems[svgIndex];
        if (colorIndex >= 0 && colorIndex < item.colorGroups.length) {
          const cg = item.colorGroups[colorIndex];
          cg.useFileDefaults = !cg.useFileDefaults;

          // Wenn Defaults aktiviert werden, File-Settings kopieren
          if (cg.useFileDefaults) {
            cg.toolNumber = item.toolNumber;
            cg.infillToolNumber = item.infillToolNumber;
          }
        }
      }
    },

    // File-Settings auf alle Farben anwenden
    applyFileSettingsToAllColors(svgIndex: number) {
      if (svgIndex >= 0 && svgIndex < this.svgItems.length) {
        const item = this.svgItems[svgIndex];
        item.colorGroups.forEach(cg => {
          cg.toolNumber = item.toolNumber;
          cg.infillToolNumber = item.infillToolNumber;
          cg.useFileDefaults = true;
        });
        console.log(`File-Settings auf ${item.colorGroups.length} Farben angewandt`);
      }
    },

    // File-Level Visibility Toggle (alle Farben auf einmal)
    toggleFileVisibility(svgIndex: number) {
      if (svgIndex >= 0 && svgIndex < this.svgItems.length) {
        const item = this.svgItems[svgIndex];
        // Wenn alle sichtbar sind, verstecke alle. Sonst zeige alle.
        const newVisibility = !item.colorGroups.every(cg => cg.visible);
        item.colorGroups.forEach(cg => {
          cg.visible = newVisibility;
        });
        console.log(`File-Visibility: ${newVisibility ? 'alle sichtbar' : 'alle versteckt'}`);
      }
    },

    // Farbanalyse zurücksetzen
    resetColorAnalysis(index: number) {
      if (index >= 0 && index < this.svgItems.length) {
        this.svgItems[index].colorGroups = [];
        this.svgItems[index].isAnalyzed = false;
      }
    },

    // ===== Farb-basierte Infill Actions =====

    // Infill für eine Farbgruppe aktivieren/deaktivieren
    toggleColorInfill(svgIndex: number, colorIndex: number) {
      if (svgIndex >= 0 && svgIndex < this.svgItems.length) {
        const item = this.svgItems[svgIndex];
        if (colorIndex >= 0 && colorIndex < item.colorGroups.length) {
          item.colorGroups[colorIndex].infillEnabled = !item.colorGroups[colorIndex].infillEnabled;
        }
      }
    },

    // Infill-Tool für eine Farbgruppe setzen
    setColorInfillTool(svgIndex: number, colorIndex: number, toolNumber: number) {
      if (svgIndex >= 0 && svgIndex < this.svgItems.length) {
        const item = this.svgItems[svgIndex];
        if (colorIndex >= 0 && colorIndex < item.colorGroups.length) {
          item.colorGroups[colorIndex].infillToolNumber = toolNumber;
        }
      }
    },

    // Infill-Pattern für eine Farbgruppe setzen
    setColorInfillPattern(svgIndex: number, colorIndex: number, patternType: InfillPatternType) {
      if (svgIndex >= 0 && svgIndex < this.svgItems.length) {
        const item = this.svgItems[svgIndex];
        if (colorIndex >= 0 && colorIndex < item.colorGroups.length) {
          item.colorGroups[colorIndex].infillOptions.patternType = patternType;
        }
      }
    },

    // Infill-Optionen für eine Farbgruppe aktualisieren
    updateColorInfillOptions(svgIndex: number, colorIndex: number, options: Partial<InfillOptions>) {
      if (svgIndex >= 0 && svgIndex < this.svgItems.length) {
        const item = this.svgItems[svgIndex];
        if (colorIndex >= 0 && colorIndex < item.colorGroups.length) {
          item.colorGroups[colorIndex].infillOptions = {
            ...item.colorGroups[colorIndex].infillOptions,
            ...options
          };
        }
      }
    },

    // Infill für eine Farbgruppe generieren (async für Backend-Unterstützung)
    async generateColorInfill(svgIndex: number, colorIndex: number) {
      if (svgIndex >= 0 && svgIndex < this.svgItems.length) {
        const item = this.svgItems[svgIndex];
        if (colorIndex >= 0 && colorIndex < item.colorGroups.length) {
          const colorGroup = item.colorGroups[colorIndex];

          // Set loading state
          this.infillGenerating = { svgIndex, colorIndex };

          try {
            // Vorhandenes Infill entfernen
            if (colorGroup.infillGroup) {
              item.geometry.remove(colorGroup.infillGroup);
              colorGroup.infillGroup = undefined;
            }
            // Stats zurücksetzen
            colorGroup.infillStats = undefined;

            // Neues Infill generieren - OHNE TSP-Optimierung für schnelle Vorschau
            // Nutze pathAnalysis für korrekte Hole-Detection (inkl. userOverriddenRole)
            const infillGroup = await generateInfillForColorAsync(
              item.geometry,
              colorGroup.color,
              colorGroup.infillOptions,
              item.pathAnalysis,  // Path-Analyse mit benutzerdefinierten Rollen
              false  // Keine TSP-Optimierung
            );

            if (infillGroup.children.length > 0) {
              // Mit markRaw für Vue-Reaktivität
              colorGroup.infillGroup = markRaw(infillGroup);
              // Zur Szene hinzufügen
              item.geometry.add(infillGroup);

              // Berechne Basis-Statistiken (ohne Optimierung)
              // WICHTIG: Travel-Distance wird hier AS-IS berechnet - in der Reihenfolge und
              // Orientierung wie die Linien vom Backend kommen. Das entspricht dem tatsächlichen
              // Weg OHNE Optimierung.
              const lines = infillGroup.children.filter(c => c instanceof THREE.Line) as THREE.Line[];
              let totalLength = 0;
              let travelLength = 0;
              let lastEnd: THREE.Vector3 | null = null;

              for (const line of lines) {
                const pos = line.geometry.getAttribute('position');
                if (pos && pos.count >= 2) {
                  const start = new THREE.Vector3(pos.getX(0), pos.getY(0), pos.getZ(0));
                  const end = new THREE.Vector3(pos.getX(1), pos.getY(1), pos.getZ(1));

                  totalLength += start.distanceTo(end);

                  // Travel: Von letztem End-Punkt zum aktuellen Start-Punkt
                  if (lastEnd) {
                    travelLength += lastEnd.distanceTo(start);
                  }
                  lastEnd = end;  // Segment wird start→end gezeichnet (AS-IS)
                }
              }

              colorGroup.infillStats = {
                totalLengthMm: Math.round(totalLength * 10) / 10,
                travelLengthMm: Math.round(travelLength * 10) / 10,
                numSegments: lines.length,
                numPenLifts: lines.length > 0 ? lines.length - 1 : 0,
                isOptimized: false
              };

              console.log(`Infill für Farbe ${colorGroup.color} generiert: ${lines.length} Linien, ${colorGroup.infillStats.travelLengthMm}mm Travel (unoptimiert)`);
            } else {
              console.warn(`Kein Infill für Farbe ${colorGroup.color} generiert (keine geschlossenen Pfade?)`);
            }

            // Trigger scene update
            this.svgItems = [...this.svgItems];
          } finally {
            // Clear loading state
            this.infillGenerating = null;
          }
        }
      }
    },

    // TSP-Optimierung für Infill einer Farbgruppe
    async optimizeColorInfill(svgIndex: number, colorIndex: number) {
      if (svgIndex >= 0 && svgIndex < this.svgItems.length) {
        const item = this.svgItems[svgIndex];
        if (colorIndex >= 0 && colorIndex < item.colorGroups.length) {
          const colorGroup = item.colorGroups[colorIndex];

          if (!colorGroup.infillGroup || colorGroup.infillGroup.children.length === 0) {
            console.warn('Kein Infill zum Optimieren vorhanden');
            return;
          }

          // Set loading state
          this.infillOptimizing = { svgIndex, colorIndex };

          try {
            // Extrahiere die Lines aus der Gruppe
            const lines = colorGroup.infillGroup.children.filter(c => c instanceof THREE.Line) as THREE.Line[];

            if (lines.length < 2) {
              console.log('Zu wenige Linien für Optimierung');
              return;
            }

            console.log(`Starte TSP-Optimierung für ${lines.length} Linien...`);

            // Backend-Optimierung aufrufen
            const result = await optimizePathBackend(lines);

            if (result && result.lines.length > 0) {
              // Alte Geometrie aus Szene entfernen
              item.geometry.remove(colorGroup.infillGroup);

              // Neue optimierte Gruppe erstellen
              const optimizedGroup = new THREE.Group();
              optimizedGroup.name = `InfillGroup_${colorGroup.color.replace('#', '')}_optimized`;

              result.lines.forEach((line, idx) => {
                line.name = `Infill_${colorGroup.color.replace('#', '')}_Opt_Line${idx}`;
                line.userData = {
                  isInfillLine: true,
                  colorGroup: colorGroup.color,
                  optimized: true
                };
                optimizedGroup.add(line);
              });

              // Mit markRaw für Vue-Reaktivität
              colorGroup.infillGroup = markRaw(optimizedGroup);
              item.geometry.add(optimizedGroup);

              // Stats aktualisieren
              const oldTravel = colorGroup.infillStats?.travelLengthMm || 0;
              const oldPenLifts = colorGroup.infillStats?.numPenLifts || 0;

              colorGroup.infillStats = {
                totalLengthMm: Math.round(result.stats.total_drawing_length_mm * 10) / 10,
                travelLengthMm: Math.round(result.stats.total_travel_length_mm * 10) / 10,
                numSegments: result.lines.length,
                numPenLifts: result.stats.num_pen_lifts,
                isOptimized: true,
                optimizationMethod: result.stats.optimization_method
              };

              // Log improvement
              const newTravel = colorGroup.infillStats.travelLengthMm;
              const newPenLifts = colorGroup.infillStats.numPenLifts;

              if (oldTravel > 0 && oldPenLifts > 0) {
                // Show improvement if we had previous stats
                const travelChange = ((newTravel - oldTravel) / oldTravel * 100).toFixed(1);
                const penLiftChange = ((newPenLifts - oldPenLifts) / oldPenLifts * 100).toFixed(1);
                const travelSign = Number(travelChange) > 0 ? '+' : '';
                const penLiftSign = Number(penLiftChange) > 0 ? '+' : '';
                console.log(`✅ TSP-Optimierung (${result.stats.optimization_method}) abgeschlossen:`);
                console.log(`   Travel: ${oldTravel}mm → ${newTravel}mm (${travelSign}${travelChange}%)`);
                console.log(`   Pen-Lifts: ${oldPenLifts} → ${newPenLifts} (${penLiftSign}${penLiftChange}%)`);
              } else {
                // First time optimization
                console.log(`✅ TSP-Optimierung (${result.stats.optimization_method}) abgeschlossen:`);
                console.log(`   Travel: ${newTravel}mm | Pen-Lifts: ${newPenLifts} | Linien: ${colorGroup.infillStats.numSegments}`);
              }

              // Trigger scene update
              this.svgItems = [...this.svgItems];
            } else {
              console.error('TSP-Optimierung fehlgeschlagen');
            }
          } finally {
            // Clear loading state
            this.infillOptimizing = null;
          }
        }
      }
    },

    // Infill für eine Farbgruppe löschen
    deleteColorInfill(svgIndex: number, colorIndex: number) {
      if (svgIndex >= 0 && svgIndex < this.svgItems.length) {
        const item = this.svgItems[svgIndex];
        if (colorIndex >= 0 && colorIndex < item.colorGroups.length) {
          const colorGroup = item.colorGroups[colorIndex];

          if (colorGroup.infillGroup) {
            // Aus Szene entfernen
            item.geometry.remove(colorGroup.infillGroup);
            colorGroup.infillGroup = undefined;
            colorGroup.infillStats = undefined;
            console.log(`Infill für Farbe ${colorGroup.color} gelöscht`);

            // Trigger scene update
            this.svgItems = [...this.svgItems];
          }
        }
      }
    },

    // ===== Centerline (Mittellinie) Actions =====

    // Centerline für eine Farbgruppe aktivieren/deaktivieren
    toggleColorCenterline(svgIndex: number, colorIndex: number) {
      if (svgIndex >= 0 && svgIndex < this.svgItems.length) {
        const item = this.svgItems[svgIndex];
        if (colorIndex >= 0 && colorIndex < item.colorGroups.length) {
          item.colorGroups[colorIndex].centerlineEnabled = !item.colorGroups[colorIndex].centerlineEnabled;
        }
      }
    },

    // Centerline für eine Farbgruppe generieren
    async generateColorCenterline(svgIndex: number, colorIndex: number) {
      if (svgIndex >= 0 && svgIndex < this.svgItems.length) {
        const item = this.svgItems[svgIndex];
        if (colorIndex >= 0 && colorIndex < item.colorGroups.length) {
          const colorGroup = item.colorGroups[colorIndex];

          // Set loading state
          this.centerlineGenerating = { svgIndex, colorIndex };

          try {
            // Vorhandene Centerline entfernen
            if (colorGroup.centerlineGroup) {
              item.geometry.remove(colorGroup.centerlineGroup);
              colorGroup.centerlineGroup = undefined;
            }
            colorGroup.centerlineStats = undefined;

            // Konvertiere zu API-Format (mit Path-Analyse für Holes)
            const polygonsForApi: { outer: THREE.Vector2[]; holes: THREE.Vector2[][] }[] = [];

            // Nutze pathAnalysis falls vorhanden
            if (item.pathAnalysis) {
              // Filtere Pfade nach Farbe und Rolle
              const colorPaths = item.pathAnalysis.paths.filter(
                p => (p.color?.toLowerCase() || '#000000') === colorGroup.color.toLowerCase()
              );

              for (const pathInfo of colorPaths) {
                const effectiveRole = pathInfo.userOverriddenRole ?? pathInfo.autoDetectedRole;
                // Nur Outer und Nested-Objects als eigenständige Polygone (nicht Holes)
                if (effectiveRole === 'hole') {
                  continue;
                }

                // Finde zugehörige Holes
                const holes: THREE.Vector2[][] = [];
                for (const childId of pathInfo.childPathIds) {
                  const childPath = item.pathAnalysis.paths.find(p => p.id === childId);
                  if (childPath) {
                    const childRole = childPath.userOverriddenRole ?? childPath.autoDetectedRole;
                    if (childRole === 'hole') {
                      holes.push(childPath.polygon);
                    }
                  }
                }

                polygonsForApi.push({
                  outer: pathInfo.polygon,
                  holes: holes
                });
              }
            } else {
              // Fallback: Nutze extractPolygonsWithColorsFromGroup ohne Hole-Erkennung
              const polygonsWithColors = extractPolygonsWithColorsFromGroup(item.geometry);
              const colorPolygons = polygonsWithColors.filter(
                p => p.color.toLowerCase() === colorGroup.color.toLowerCase()
              );

              for (const poly of colorPolygons) {
                polygonsForApi.push({
                  outer: poly.polygon,
                  holes: []
                });
              }
            }

            if (polygonsForApi.length === 0) {
              console.warn(`Keine äußeren Polygone für Farbe ${colorGroup.color} gefunden`);
              return;
            }

            // Backend aufrufen mit Optionen aus der Farbgruppe
            const result = await extractCenterlineBackend(
              polygonsForApi,
              colorGroup.centerlineOptions,
              0xff00ff  // Magenta
            );

            if (result && result.lines.length > 0) {
              // Gruppe erstellen
              const centerlineGroup = new THREE.Group();
              centerlineGroup.name = `CenterlineGroup_${colorGroup.color.replace('#', '')}`;

              result.lines.forEach((line, idx) => {
                line.name = `Centerline_${colorGroup.color.replace('#', '')}_Line${idx}`;
                line.userData = {
                  isCenterline: true,
                  colorGroup: colorGroup.color
                };
                centerlineGroup.add(line);
              });

              // Mit markRaw für Vue-Reaktivität
              colorGroup.centerlineGroup = markRaw(centerlineGroup);
              item.geometry.add(centerlineGroup);

              // Stats speichern
              colorGroup.centerlineStats = {
                totalLengthMm: result.stats.total_length_mm,
                numPolylines: result.stats.num_polylines,
                processingTimeMs: result.stats.processing_time_ms
              };

              console.log(`Centerline für Farbe ${colorGroup.color} generiert: ${result.lines.length} Linien, ${result.stats.total_length_mm}mm`);

              // Trigger scene update
              this.svgItems = [...this.svgItems];
            } else {
              console.warn(`Keine Centerline für Farbe ${colorGroup.color} generiert`);
            }
          } finally {
            // Clear loading state
            this.centerlineGenerating = null;
          }
        }
      }
    },

    // Centerline für eine Farbgruppe löschen
    deleteColorCenterline(svgIndex: number, colorIndex: number) {
      if (svgIndex >= 0 && svgIndex < this.svgItems.length) {
        const item = this.svgItems[svgIndex];
        if (colorIndex >= 0 && colorIndex < item.colorGroups.length) {
          const colorGroup = item.colorGroups[colorIndex];

          if (colorGroup.centerlineGroup) {
            // Aus Szene entfernen
            item.geometry.remove(colorGroup.centerlineGroup);
            colorGroup.centerlineGroup = undefined;
            colorGroup.centerlineStats = undefined;
            console.log(`Centerline für Farbe ${colorGroup.color} gelöscht`);

            // Trigger scene update
            this.svgItems = [...this.svgItems];
          }
        }
      }
    },

    // Centerline-Optionen für eine Farbe ändern
    updateCenterlineOptions(svgIndex: number, colorIndex: number, options: Partial<CenterlineOptions>) {
      if (svgIndex >= 0 && svgIndex < this.svgItems.length) {
        const item = this.svgItems[svgIndex];
        if (colorIndex >= 0 && colorIndex < item.colorGroups.length) {
          const colorGroup = item.colorGroups[colorIndex];
          colorGroup.centerlineOptions = { ...colorGroup.centerlineOptions, ...options };
          console.log(`Centerline-Optionen für Farbe ${colorGroup.color} aktualisiert:`, options);
        }
      }
    },

    // TSP-Optimierung für File-Level Infill
    async optimizeFileInfill(svgIndex: number) {
      if (svgIndex >= 0 && svgIndex < this.svgItems.length) {
        const item = this.svgItems[svgIndex];

        if (!item.infillGroup || item.infillGroup.children.length === 0) {
          console.warn('Kein Infill zum Optimieren vorhanden');
          return;
        }

        // Set loading state
        this.infillOptimizing = { svgIndex, colorIndex: null };

        try {
          // Extrahiere die Lines aus der Gruppe
          const lines = item.infillGroup.children.filter(c => c instanceof THREE.Line) as THREE.Line[];

          if (lines.length < 2) {
            console.log('Zu wenige Linien für Optimierung');
            return;
          }

          console.log(`Starte TSP-Optimierung für ${lines.length} Linien (File: ${item.fileName})...`);

          // Backend-Optimierung aufrufen
          const result = await optimizePathBackend(lines);

          if (result && result.lines.length > 0) {
            // Alte Geometrie aus Szene entfernen
            item.geometry.remove(item.infillGroup);

            // Neue optimierte Gruppe erstellen
            const optimizedGroup = new THREE.Group();
            optimizedGroup.name = `InfillGroup_${item.fileName}_optimized`;

            result.lines.forEach((line, idx) => {
              line.name = `Infill_File_Opt_Line${idx}`;
              line.userData = {
                isInfillLine: true,
                optimized: true
              };
              optimizedGroup.add(line);
            });

            // Mit markRaw für Vue-Reaktivität
            item.infillGroup = markRaw(optimizedGroup);
            item.geometry.add(optimizedGroup);

            // Stats aktualisieren
            const oldTravel = item.infillStats?.travelLengthMm || 0;
            const oldPenLifts = item.infillStats?.numPenLifts || 0;

            item.infillStats = {
              totalLengthMm: Math.round(result.stats.total_drawing_length_mm * 10) / 10,
              travelLengthMm: Math.round(result.stats.total_travel_length_mm * 10) / 10,
              numSegments: result.lines.length,
              numPenLifts: result.stats.num_pen_lifts,
              isOptimized: true,
              optimizationMethod: result.stats.optimization_method
            };

            // Log improvement
            const newTravel = item.infillStats.travelLengthMm;
            const newPenLifts = item.infillStats.numPenLifts;

            if (oldTravel > 0 && oldPenLifts > 0) {
              // Show improvement if we had previous stats
              const travelChange = ((newTravel - oldTravel) / oldTravel * 100).toFixed(1);
              const penLiftChange = ((newPenLifts - oldPenLifts) / oldPenLifts * 100).toFixed(1);
              const travelSign = Number(travelChange) > 0 ? '+' : '';
              const penLiftSign = Number(penLiftChange) > 0 ? '+' : '';
              console.log(`✅ TSP-Optimierung für ${item.fileName} (${result.stats.optimization_method}) abgeschlossen:`);
              console.log(`   Travel: ${oldTravel}mm → ${newTravel}mm (${travelSign}${travelChange}%)`);
              console.log(`   Pen-Lifts: ${oldPenLifts} → ${newPenLifts} (${penLiftSign}${penLiftChange}%)`);
            } else {
              // First time optimization
              console.log(`✅ TSP-Optimierung für ${item.fileName} (${result.stats.optimization_method}) abgeschlossen:`);
              console.log(`   Travel: ${newTravel}mm | Pen-Lifts: ${newPenLifts} | Linien: ${item.infillStats.numSegments}`);
            }

            // Trigger scene update
            this.svgItems = [...this.svgItems];
          } else {
            console.error('TSP-Optimierung fehlgeschlagen');
          }
        } finally {
          // Clear loading state
          this.infillOptimizing = null;
        }
      }
    },

    // ===== Queue System für Backend-Tasks =====

    // Task zur Queue hinzufügen
    queueTask(type: 'generate' | 'optimize', svgIndex: number, colorIndex: number | null, label: string) {
      const task: BackendTask = {
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        svgIndex,
        colorIndex,
        status: 'pending',
        label
      };
      this.taskQueue.push(task);

      // Starte Queue-Verarbeitung falls nicht bereits aktiv
      if (!this.isProcessingQueue) {
        this.processQueue();
      }

      return task.id;
    },

    // Queue verarbeiten
    async processQueue() {
      if (this.isProcessingQueue) return;
      this.isProcessingQueue = true;

      while (this.taskQueue.length > 0) {
        const task = this.taskQueue.find(t => t.status === 'pending');
        if (!task) break;

        task.status = 'running';
        console.log(`[Queue] Starte Task: ${task.label}`);

        try {
          if (task.type === 'generate') {
            if (task.colorIndex !== null) {
              await this.generateColorInfill(task.svgIndex, task.colorIndex);
            } else {
              // File-level generate wird separat in Sidebar.vue gemacht
              console.log('[Queue] File-level generate - handled externally');
            }
          } else if (task.type === 'optimize') {
            if (task.colorIndex !== null) {
              await this.optimizeColorInfill(task.svgIndex, task.colorIndex);
            } else {
              await this.optimizeFileInfill(task.svgIndex);
            }
          }
          task.status = 'completed';
          console.log(`[Queue] Task abgeschlossen: ${task.label}`);
        } catch (error) {
          task.status = 'failed';
          console.error(`[Queue] Task fehlgeschlagen: ${task.label}`, error);
        }

        // Entferne abgeschlossene/fehlgeschlagene Tasks aus der Queue
        this.taskQueue = this.taskQueue.filter(t => t.status === 'pending' || t.status === 'running');
      }

      this.isProcessingQueue = false;
    },

    // Alle pending Tasks aus der Queue entfernen
    clearQueue() {
      this.taskQueue = this.taskQueue.filter(t => t.status === 'running');
    },

    // ===== Workpiece Start Actions =====

    // Workpiece Start hinzufügen (mit Limits)
    // Parameter sind Slicer-Koordinaten (x = Slicer X = Maschine Y, y = Slicer Y = Maschine X)
    addWorkpieceStart(name: string, x: number, y: number) {
      // Limits anwenden (Slicer X → Maschine Y Limits, Slicer Y → Maschine X Limits)
      const clampedX = Math.max(WORKPIECE_LIMITS.MACHINE_Y_MIN, Math.min(WORKPIECE_LIMITS.MACHINE_Y_MAX, x));
      const clampedY = Math.max(WORKPIECE_LIMITS.MACHINE_X_MIN, Math.min(WORKPIECE_LIMITS.MACHINE_X_MAX, y));

      const id = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.workpieceStarts.push({ id, name, x: clampedX, y: clampedY });
      return id;
    },

    // Workpiece Start entfernen
    removeWorkpieceStart(id: string) {
      const index = this.workpieceStarts.findIndex(ws => ws.id === id);
      if (index >= 0) {
        this.workpieceStarts.splice(index, 1);
        // SVGs die diesen Start verwenden zurücksetzen
        this.svgItems.forEach(item => {
          if (item.workpieceStartId === id) {
            item.workpieceStartId = undefined;
            item.offsetX = 0;
            item.offsetY = 0;
          }
        });
      }
    },

    // Workpiece Start aktualisieren (mit Limits)
    // Parameter sind Slicer-Koordinaten (x = Slicer X = Maschine Y, y = Slicer Y = Maschine X)
    updateWorkpieceStart(id: string, x: number, y: number) {
      const ws = this.workpieceStarts.find(ws => ws.id === id);
      if (ws) {
        // Limits anwenden (Slicer X → Maschine Y Limits, Slicer Y → Maschine X Limits)
        const clampedX = Math.max(WORKPIECE_LIMITS.MACHINE_Y_MIN, Math.min(WORKPIECE_LIMITS.MACHINE_Y_MAX, x));
        const clampedY = Math.max(WORKPIECE_LIMITS.MACHINE_X_MIN, Math.min(WORKPIECE_LIMITS.MACHINE_X_MAX, y));

        ws.x = clampedX;
        ws.y = clampedY;
        // SVGs die diesen Start verwenden aktualisieren
        this.svgItems.forEach(item => {
          if (item.workpieceStartId === id) {
            item.offsetX = clampedX;
            item.offsetY = clampedY;
          }
        });
      }
    },

    // Workpiece Start Namen ändern
    updateWorkpieceStartName(id: string, name: string) {
      const ws = this.workpieceStarts.find(ws => ws.id === id);
      if (ws) {
        ws.name = name;
      }
    },

    // ===== SVG Offset Actions =====

    // SVG Offset manuell setzen
    updateSVGItemOffset(index: number, offsetX: number, offsetY: number) {
      if (index >= 0 && index < this.svgItems.length) {
        this.svgItems[index].offsetX = offsetX;
        this.svgItems[index].offsetY = offsetY;
        // Workpiece Start Referenz entfernen (manuelle Eingabe)
        this.svgItems[index].workpieceStartId = undefined;
      }
    },

    // SVG an einen Workpiece Start setzen
    setSVGItemWorkpieceStart(index: number, workpieceStartId: string | undefined) {
      if (index >= 0 && index < this.svgItems.length) {
        const item = this.svgItems[index];
        item.workpieceStartId = workpieceStartId;

        if (workpieceStartId) {
          const ws = this.workpieceStarts.find(ws => ws.id === workpieceStartId);
          if (ws) {
            item.offsetX = ws.x;
            item.offsetY = ws.y;
          }
        } else {
          // Kein Start ausgewählt -> Offset zurücksetzen
          item.offsetX = 0;
          item.offsetY = 0;
        }
      }
    },

    // ===== Path-Analyse (Hole Detection) Actions =====

    // Path-Analyse für ein SVG-Item durchführen (mit Farbinformation für Infill)
    analyzePathRelationshipsAction(index: number) {
      if (index >= 0 && index < this.svgItems.length) {
        const item = this.svgItems[index];
        const polygonsWithColors = extractPolygonsWithColorsFromGroup(item.geometry);

        if (polygonsWithColors.length > 0) {
          item.pathAnalysis = analyzePathRelationshipsWithColors(polygonsWithColors);
          item.isPathAnalyzed = true;
          console.log(`Path-Analyse für "${item.fileName}":`,
            `${item.pathAnalysis.outerPaths.length} outer,`,
            `${item.pathAnalysis.holes.length} holes,`,
            `${item.pathAnalysis.nestedObjects.length} nested objects`
          );
        } else {
          console.warn(`Keine Polygone in "${item.fileName}" gefunden`);
        }
      }
    },

    // Path-Rolle manuell überschreiben
    setPathRole(svgIndex: number, pathId: string, role: PathRole | null) {
      if (svgIndex >= 0 && svgIndex < this.svgItems.length) {
        const item = this.svgItems[svgIndex];
        if (item.pathAnalysis) {
          const path = item.pathAnalysis.paths.find(p => p.id === pathId);
          if (path) {
            path.userOverriddenRole = role;

            // Listen neu berechnen
            item.pathAnalysis.outerPaths = item.pathAnalysis.paths.filter(
              p => getEffectiveRole(p) === 'outer'
            );
            item.pathAnalysis.holes = item.pathAnalysis.paths.filter(
              p => getEffectiveRole(p) === 'hole'
            );
            item.pathAnalysis.nestedObjects = item.pathAnalysis.paths.filter(
              p => getEffectiveRole(p) === 'nested-object'
            );
          }
        }
      }
    },

    // Path-Analyse zurücksetzen
    resetPathAnalysis(index: number) {
      if (index >= 0 && index < this.svgItems.length) {
        this.svgItems[index].pathAnalysis = undefined;
        this.svgItems[index].isPathAnalyzed = false;
      }
    },

    // ===== Hole Editor Mode Actions =====

    // Hole Editor Modus togglen
    toggleHoleEditorMode() {
      this.holeEditorMode = !this.holeEditorMode;
      if (!this.holeEditorMode) {
        this.selectedPathId = null;  // Reset bei Deaktivierung
      }
    },

    // Path auswählen (für Highlighting)
    selectPath(pathId: string | null) {
      this.selectedPathId = pathId;
    },

    // Path-Rolle zyklisch durchschalten (Outer → Hole → Nested → Outer)
    cyclePathRole(svgIndex: number, pathId: string) {
      if (svgIndex < 0 || svgIndex >= this.svgItems.length) return;

      const item = this.svgItems[svgIndex];
      if (!item.pathAnalysis) return;

      const path = item.pathAnalysis.paths.find(p => p.id === pathId);
      if (!path) return;

      const current = path.userOverriddenRole ?? path.autoDetectedRole;
      const cycle: Record<string, PathRole> = {
        'outer': 'hole',
        'hole': 'nested-object',
        'nested-object': 'outer',
      };

      this.setPathRole(svgIndex, pathId, cycle[current] || 'outer');
    },

    // ===== Project Save/Load Actions =====

    /**
     * Serialize the current project state to a ProjectData object.
     * Used for saving to API or downloading as file.
     */
    getProjectData(projectName: string): ProjectData {
      const now = new Date().toISOString();

      // Helper to extract points from a THREE.Line
      const extractLinePoints = (line: THREE.Line): [number, number][] => {
        const geometry = line.geometry as THREE.BufferGeometry;
        const positionAttr = geometry.getAttribute('position');
        const points: [number, number][] = [];
        if (positionAttr) {
          for (let i = 0; i < positionAttr.count; i++) {
            points.push([positionAttr.getX(i), positionAttr.getY(i)]);
          }
        }
        return points;
      };

      // Helper to serialize infill group
      const serializeInfillGroup = (infillGroup: THREE.Group): SerializedInfillLine[] => {
        const lines: SerializedInfillLine[] = [];
        infillGroup.children.forEach((child) => {
          if (child instanceof THREE.Line) {
            const points = extractLinePoints(child);
            if (points.length >= 2) {
              const material = child.material as THREE.LineBasicMaterial;
              const color = material.color ? material.color.getHex() : 0x00ff00;
              lines.push({ points, color });
            }
          }
        });
        return lines;
      };

      const serializedItems: SerializedSVGItem[] = this.svgItems
        .filter(item => item.svgContent) // Only items with svgContent can be serialized
        .map(item => {
          // Serialize file-level infill if present
          let fileInfillLines: SerializedInfillLine[] | undefined = undefined;
          if (item.infillGroup && item.infillGroup.children.length > 0) {
            fileInfillLines = serializeInfillGroup(item.infillGroup);
            console.log(`Serialized ${fileInfillLines.length} file-level infill lines for ${item.fileName}`);
          }

          return {
            fileName: item.fileName,
            svgContent: item.svgContent!,
            dpi: item.dpi,
            toolNumber: item.toolNumber,
            infillToolNumber: item.infillToolNumber,
            penType: item.penType,
            feedrate: item.feedrate,
            drawingHeight: item.drawingHeight,
            offsetX: item.offsetX,
            offsetY: item.offsetY,
            workpieceStartId: item.workpieceStartId,
            infillOptions: { ...item.infillOptions },
            infillLines: fileInfillLines, // File-level infill
            colorGroups: item.colorGroups.map((cg): SerializedColorGroup => {
              const serialized: SerializedColorGroup = {
                color: cg.color,
                toolNumber: cg.toolNumber,
                lineCount: cg.lineCount,
                visible: cg.visible,
                useFileDefaults: cg.useFileDefaults,
                infillEnabled: cg.infillEnabled,
                infillToolNumber: cg.infillToolNumber,
                infillOptions: { ...cg.infillOptions },
              };
              // Serialize infill geometry if present
              if (cg.infillGroup && cg.infillGroup.children.length > 0) {
                serialized.infillLines = serializeInfillGroup(cg.infillGroup);
                console.log(`Serialized ${serialized.infillLines.length} infill lines for color ${cg.color}`);
              }
              return serialized;
            }),
            isAnalyzed: item.isAnalyzed,
          };
        });

      return {
        version: '1.1',
        name: projectName,
        createdAt: now,
        updatedAt: now,
        defaultDpi: this.defaultDpi,
        workpieceStarts: this.workpieceStarts.map(ws => ({ ...ws })),
        svgItems: serializedItems,
      };
    },

    /**
     * Load project data and restore the store state.
     * Parses SVG content and recreates THREE.js geometry objects.
     */
    async loadProjectData(projectData: ProjectData) {
      // Clear current state
      this.svgItems = [];
      this.lineGeometry = null;

      // Restore workpiece starts
      this.workpieceStarts = projectData.workpieceStarts.map(ws => ({ ...ws }));

      // Restore default DPI
      this.defaultDpi = projectData.defaultDpi || 72;

      // Restore SVG items (requires parsing SVG content)
      for (const serialized of projectData.svgItems) {
        try {
          // Parse SVG to create THREE.js geometry
          const geometry = await getThreejsObjectFromSvg(
            serialized.svgContent,
            0, // offset
            serialized.dpi
          );

          // Restore file-level infill geometry if present
          let fileInfillGroup: THREE.Group | undefined = undefined;
          if (serialized.infillLines && serialized.infillLines.length > 0) {
            fileInfillGroup = markRaw(deserializeInfillGroup(serialized.infillLines, '#00ff00'));
            geometry.add(fileInfillGroup);
            console.log(`Restored ${serialized.infillLines.length} file-level infill lines for ${serialized.fileName}`);
          }

          // Restore color groups with infill geometry
          const colorGroups: ColorGroup[] = serialized.colorGroups.map(cg => {
            let infillGroup: THREE.Group | undefined = undefined;

            // Reconstruct infill geometry if it was saved
            if (cg.infillLines && cg.infillLines.length > 0) {
              infillGroup = markRaw(deserializeInfillGroup(cg.infillLines, cg.color));
              // Add the infill group to the main geometry so it renders
              geometry.add(infillGroup);
              console.log(`Restored ${cg.infillLines.length} infill lines for color ${cg.color}`);
            }

            return {
              color: cg.color,
              toolNumber: cg.toolNumber,
              lineCount: cg.lineCount,
              visible: cg.visible,
              showOutlines: cg.showOutlines ?? true, // Default to true for backwards compatibility
              useFileDefaults: cg.useFileDefaults ?? false, // Default to false for backwards compatibility
              infillEnabled: cg.infillEnabled,
              infillToolNumber: cg.infillToolNumber,
              infillOptions: { ...cg.infillOptions },
              infillGroup,
              // Centerline defaults (not persisted yet)
              centerlineEnabled: false,
              centerlineOptions: { ...defaultCenterlineOptions },
            };
          });

          // Create the SVGItem with restored settings
          const item: SVGItem = {
            geometry: markRaw(geometry),
            toolNumber: serialized.toolNumber,
            infillToolNumber: serialized.infillToolNumber,
            fileName: serialized.fileName,
            penType: serialized.penType,
            feedrate: serialized.feedrate,
            drawingHeight: serialized.drawingHeight,
            infillOptions: { ...serialized.infillOptions },
            infillGroup: fileInfillGroup, // Restore file-level infill
            colorGroups,
            isAnalyzed: serialized.isAnalyzed,
            isPathAnalyzed: false, // Will be re-analyzed
            offsetX: serialized.offsetX,
            offsetY: serialized.offsetY,
            workpieceStartId: serialized.workpieceStartId,
            dpi: serialized.dpi,
            svgContent: serialized.svgContent,
          };

          this.svgItems.push(item);

          // Run path analysis for the new item
          const newIndex = this.svgItems.length - 1;
          this.analyzePathRelationshipsAction(newIndex);

          console.log(`Loaded SVG "${serialized.fileName}" from project`);
        } catch (error) {
          console.error(`Failed to load SVG "${serialized.fileName}":`, error);
        }
      }

      // Update lineGeometry for compatibility
      this.lineGeometry = this.svgItems.length > 0
        ? this.svgItems[this.svgItems.length - 1].geometry
        : null;

      console.log(`Project loaded: ${this.svgItems.length} SVGs, ${this.workpieceStarts.length} workpiece starts`);
    },

    /**
     * Clear all project data and reset to initial state.
     */
    clearProject() {
      this.svgItems = [];
      this.lineGeometry = null;
      this.workpieceStarts = [
        { id: 'default_start_1', name: 'Start 1', x: 100, y: 100 }
      ];
      this.defaultDpi = 72;
      console.log('Project cleared');
    }
  }
});