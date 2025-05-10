import { defineStore } from 'pinia'
import * as THREE from 'three';

// Interface für SVG-Geometrien mit Werkzeug-Informationen
interface SVGItem {
  geometry: THREE.Group;
  toolNumber: number;
  fileName: string;
  penType: string;  // Stifttyp hinzugefügt
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
    addSVGItem(geometry: THREE.Group, toolNumber: number, fileName: string, penType: string = 'stabilo') {
      this.svgItems.push({
        geometry,
        toolNumber,
        fileName,
        penType
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
    }
  }
});