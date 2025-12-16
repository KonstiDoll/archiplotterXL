import { defineStore } from 'pinia'
import * as THREE from 'three';
import { markRaw } from 'vue';
import { InfillOptions, InfillPatternType, defaultInfillOptions, analyzeColorsInGroup, getThreejsObjectFromSvg, generateInfillForColor, analyzeAllPathsGlobally } from './utils/threejs_services';
import { PathAnalysisResult, PathRole, getEffectiveRole } from './utils/geometry/path-analysis';
import type { ProjectData, SerializedSVGItem, SerializedColorGroup, SerializedInfillLine } from './utils/project_services';
import { deserializeInfillGroup } from './utils/project_services';

// Interface für Farbgruppen (erkannte Farben mit Tool-Zuordnung)
export interface ColorGroup {
  color: string;           // Hex-Farbe z.B. "#ff0000"
  toolNumber: number;      // Zugeordnetes Tool für Konturen (1-9), default: 1
  lineCount: number;       // Anzahl Linien mit dieser Farbe
  visible: boolean;        // Sichtbarkeit in Vorschau
  // Infill-Einstellungen pro Farbe
  infillEnabled: boolean;           // Infill an/aus für diese Farbe
  infillToolNumber: number;         // Tool für Infill (kann anders sein als Kontur-Tool)
  infillOptions: InfillOptions;     // Pattern, Dichte, Winkel, etc.
  infillGroup?: THREE.Group;        // Generierte Infill-Geometrie (optional)
}

// Interface für Workpiece Starts (Platzierungspunkte)
export interface WorkpieceStart {
  id: string;              // Eindeutige ID
  name: string;            // Anzeigename z.B. "Start 1", "Mitte"
  x: number;               // X-Position in mm
  y: number;               // Y-Position in mm
}

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
    cameraTiltEnabled: false
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
        offsetX: 0,         // Kein Offset standardmäßig
        offsetY: 0,
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
          // Infill-Defaults - erben von Datei
          infillEnabled: false,
          infillToolNumber: defaultInfillTool,  // Erbe Infill-Tool von der Datei
          infillOptions: { ...defaultInfillOptions }
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

    // Infill für eine Farbgruppe generieren
    generateColorInfill(svgIndex: number, colorIndex: number) {
      if (svgIndex >= 0 && svgIndex < this.svgItems.length) {
        const item = this.svgItems[svgIndex];
        if (colorIndex >= 0 && colorIndex < item.colorGroups.length) {
          const colorGroup = item.colorGroups[colorIndex];

          // Vorhandenes Infill entfernen
          if (colorGroup.infillGroup) {
            item.geometry.remove(colorGroup.infillGroup);
            colorGroup.infillGroup = undefined;
          }

          // Sicherstellen dass Path-Analyse vorhanden ist (für globale Hole-Detection)
          if (!item.isPathAnalyzed || !item.pathAnalysis) {
            console.log('Führe globale Path-Analyse durch für farbübergreifende Hole-Detection...');
            this.analyzePathRelationshipsAction(svgIndex);
          }

          // Neues Infill generieren - mit globaler Path-Analyse für farbübergreifende Holes
          const infillGroup = generateInfillForColor(
            item.geometry,
            colorGroup.color,
            colorGroup.infillOptions,
            item.pathAnalysis  // Globale Analyse übergeben!
          );

          if (infillGroup.children.length > 0) {
            // Mit markRaw für Vue-Reaktivität
            colorGroup.infillGroup = markRaw(infillGroup);
            // Zur Szene hinzufügen
            item.geometry.add(infillGroup);
            console.log(`Infill für Farbe ${colorGroup.color} generiert: ${infillGroup.children.length} Linien`);
          } else {
            console.warn(`Kein Infill für Farbe ${colorGroup.color} generiert (keine geschlossenen Pfade?)`);
          }

          // Trigger scene update
          this.svgItems = [...this.svgItems];
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
            console.log(`Infill für Farbe ${colorGroup.color} gelöscht`);

            // Trigger scene update
            this.svgItems = [...this.svgItems];
          }
        }
      }
    },

    // ===== Workpiece Start Actions =====

    // Workpiece Start hinzufügen
    addWorkpieceStart(name: string, x: number, y: number) {
      const id = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.workpieceStarts.push({ id, name, x, y });
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

    // Workpiece Start aktualisieren
    updateWorkpieceStart(id: string, x: number, y: number) {
      const ws = this.workpieceStarts.find(ws => ws.id === id);
      if (ws) {
        ws.x = x;
        ws.y = y;
        // SVGs die diesen Start verwenden aktualisieren
        this.svgItems.forEach(item => {
          if (item.workpieceStartId === id) {
            item.offsetX = x;
            item.offsetY = y;
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

    // Path-Analyse für ein SVG-Item durchführen
    // Nutzt jetzt die GLOBALE Analyse über alle Farben hinweg,
    // damit Holes korrekt erkannt werden auch wenn sie andere Farben haben.
    analyzePathRelationshipsAction(index: number) {
      if (index >= 0 && index < this.svgItems.length) {
        const item = this.svgItems[index];

        // Nutze die neue globale Analyse, die Farbinformationen enthält
        const pathAnalysis = analyzeAllPathsGlobally(item.geometry);

        if (pathAnalysis.paths.length > 0) {
          item.pathAnalysis = pathAnalysis;
          item.isPathAnalyzed = true;
          console.log(`Globale Path-Analyse für "${item.fileName}":`,
            `${pathAnalysis.outerPaths.length} outer,`,
            `${pathAnalysis.holes.length} holes (farbübergreifend),`,
            `${pathAnalysis.nestedObjects.length} nested objects`
          );
        } else {
          console.warn(`Keine geschlossenen Polygone in "${item.fileName}" gefunden`);
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
              infillEnabled: cg.infillEnabled,
              infillToolNumber: cg.infillToolNumber,
              infillOptions: { ...cg.infillOptions },
              infillGroup,
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