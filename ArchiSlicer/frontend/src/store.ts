import { defineStore } from 'pinia'
import * as THREE from 'three';
import { InfillOptions, defaultInfillOptions, analyzeColorsInGroup } from './utils/threejs_services';

// Interface für Farbgruppen (erkannte Farben mit Tool-Zuordnung)
export interface ColorGroup {
  color: string;           // Hex-Farbe z.B. "#ff0000"
  toolNumber: number;      // Zugeordnetes Tool (1-9), default: 1
  lineCount: number;       // Anzahl Linien mit dieser Farbe
  visible: boolean;        // Sichtbarkeit in Vorschau
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
  // Platzierung / Offset
  offsetX: number;             // X-Offset für Platzierung (mm)
  offsetY: number;             // Y-Offset für Platzierung (mm)
  workpieceStartId?: string;   // Optional: Referenz zum gewählten Workpiece Start
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
    ] as WorkpieceStart[]
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
      drawingHeight: number = 0  // Standard-Zeichenhöhe (0 = Plattform)
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
        offsetX: 0,         // Kein Offset standardmäßig
        offsetY: 0
      });

      // Update auch lineGeometry für Kompatibilität
      this.lineGeometry = geometry;
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

    // ===== NEU: Farb-Analyse Actions =====

    // Farbanalyse für ein SVG-Item durchführen
    analyzeColors(index: number) {
      if (index >= 0 && index < this.svgItems.length) {
        const item = this.svgItems[index];
        const colorInfos = analyzeColorsInGroup(item.geometry);

        // ColorGroups erstellen mit Default Tool 1
        item.colorGroups = colorInfos.map(info => ({
          color: info.color,
          toolNumber: 1,  // Default: alle Farben bekommen Tool 1
          lineCount: info.lineCount,
          visible: true
        }));

        item.isAnalyzed = true;
        console.log(`Farbanalyse für "${item.fileName}": ${item.colorGroups.length} Farben gefunden`);
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
    }
  }
});