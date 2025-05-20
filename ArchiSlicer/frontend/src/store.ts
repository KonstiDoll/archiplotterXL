import { defineStore } from 'pinia'
import * as THREE from 'three';
import { InfillOptions, defaultInfillOptions, InfillPatternType } from './utils/threejs_services';

// Interface für SVG-Geometrien mit Werkzeug-Informationen
interface SVGItem {
  geometry: THREE.Group;
  toolNumber: number;       // Werkzeug für die Konturen
  infillToolNumber: number; // Werkzeug für das Infill (kann anders als für Konturen sein)
  fileName: string;
  penType: string;
  feedrate: number;         // Geschwindigkeit (mm/min)
  drawingHeight: number;    // Z-Höhe für verschiedene Materialstärken (mm)
  infillOptions: InfillOptions;  // Infill-Optionen für dieses SVG
  infillGroup?: THREE.Group;    // Optional: Generierte Infill-Gruppe
}

export const useMainStore = defineStore('main', {
  state: () => ({
    // Statt einzelner Geometrie eine Liste von SVG-Items
    svgItems: [] as SVGItem[],
    // Für Kompatibilität behalten wir lineGeometry bei
    lineGeometry: null as THREE.Group | null
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
      penType: string = 'stabilo',
      infillOptions: InfillOptions = { ...defaultInfillOptions },
      feedrate: number = 3000,  // Standard-Geschwindigkeit
      infillToolNumber: number = null,  // Standardmäßig das gleiche Werkzeug wie für Konturen
      drawingHeight: number = 0  // Standard-Zeichenhöhe (0 = Plattform)
    ) {
      // Wenn kein separates Infill-Werkzeug angegeben, verwende das Hauptwerkzeug
      if (infillToolNumber === null) {
        infillToolNumber = toolNumber;
      }
      
      this.svgItems.push({
        geometry,
        toolNumber,
        infillToolNumber,
        fileName,
        penType,
        feedrate,
        drawingHeight,
        infillOptions
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
        this.svgItems[index].infillGroup = infillGroup;
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
    }
  }
});