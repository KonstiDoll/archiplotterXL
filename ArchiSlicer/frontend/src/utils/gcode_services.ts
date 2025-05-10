import * as THREE from 'three';
import { ref } from 'vue';

type Pen = {
    penUp: number,
    penDown: number
}

const drawingSpeed = 3000;
const travelSpeed = 15000;

// Erweitere das Stift-Dictionary um mehrere Stifttypen mit verschiedenen Höhen
const penDrawingHeightDict: { [key: string]: Pen } = { 
    'stabilo': { penDown: 13, penUp: 33 },
    'posca': { penDown: 10, penUp: 35 },
    'fineliner': { penDown: 15, penUp: 35 },
    'brushpen': { penDown: 8, penUp: 33 },
    'marker': { penDown: 11, penUp: 36 }
};

// Liste aller verfügbaren Stifte für UI-Auswahl
export const availablePens = Object.keys(penDrawingHeightDict);

export function createGcodeFromLineGroup(lineGeoGroup: THREE.Group, toolNumber: number = 1, penType: string = 'stabilo'): string {
    // Fallback zum Standard-Stifttyp, falls nicht gefunden
    if (!penDrawingHeightDict[penType]) {
        console.warn(`Stifttyp "${penType}" nicht gefunden, verwende "stabilo"`);
        penType = 'stabilo';
    }
    
    const penUp = penDrawingHeightDict[penType].penUp;
    const moveUUp = 'G1 U' + penUp + ' F6000\n'
    const penDown = penDrawingHeightDict[penType].penDown;
    const moveUDown = 'G1 U' + penDown + ' F6000\n'
    
    // Analyse der SVG-Maße
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    // Alle Linien durchlaufen und Min/Max-Werte ermitteln
    lineGeoGroup.children.forEach((lineGeo: THREE.Line, idx: number) => {
        console.log(`Linie ${idx}, Anzahl Punkte: ${lineGeo.geometry.attributes.position.count}`);
        
        const positions = lineGeo.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i];
            const y = positions[i + 1];
            
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    });
    
    console.log('SVG Abmessungen für G-Code:');
    console.log(`X: Min=${minX.toFixed(2)}, Max=${maxX.toFixed(2)}, Breite=${(maxX - minX).toFixed(2)}`);
    console.log(`Y: Min=${minY.toFixed(2)}, Max=${maxY.toFixed(2)}, Höhe=${(maxY - minY).toFixed(2)}`);
    
    let gCode = '';
    const startingGcode = 'G90\nG21\n'
    const grabTool = 'M98 P"/macros/grab_tool_' + toolNumber + '"\n'
    const placeTool = 'M98 P"/macros/place_tool_' + toolNumber + '"\n'
    const moveToDrawingHeight = 'M98 P"/macros/move_to_drawingHeight_' + penType + '"\n'

    gCode += startingGcode + grabTool;
    
    // Füge Tool-Offset-Makro hinzu
    gCode += '; Stifttyp: ' + penType + '\n';
    gCode += moveToDrawingHeight + moveUUp;
    
    lineGeoGroup.children.forEach((lineGeo: THREE.Line) => {
        const gcodeLine = createGcodeFromLine(lineGeo, moveUDown);

        gCode += gcodeLine;
        gCode += moveUUp;
    });
    gCode += placeTool;
    gCode += 'G1 Y0 F15000\n';
    
    // Log der ersten und letzten G-Code-Zeilen
    const gcodeLines = gCode.split('\n');
    console.log(`G-Code Zeilen: ${gcodeLines.length}`);
    console.log('Erste 5 G-Code Befehle:');
    gcodeLines.slice(0, 10).forEach(line => console.log(line));
    console.log('...');
    console.log('Letzte 5 G-Code Befehle:');
    gcodeLines.slice(-10).forEach(line => console.log(line));
    
    return gCode;
}

function createGcodeFromLine(lineGeo: THREE.Line, moveUDown: string): string {
    let gcode = '';
    const first = ref(true);
    let speed = travelSpeed;
    
    // Erste und letzte Position für Logging
    const positions = lineGeo.geometry.attributes.position.array;
    if (positions.length > 0) {
        console.log(`Linie Startpunkt: X=${positions[0].toFixed(2)}, Y=${positions[1].toFixed(2)}`);
        const lastIndex = positions.length - 3;
        console.log(`Linie Endpunkt: X=${positions[lastIndex].toFixed(2)}, Y=${positions[lastIndex+1].toFixed(2)}`);
    }
    
    for (let index = 0; index < positions.length; index += 3) {
        const x = positions[index].toFixed(2);
        const y = positions[index + 1].toFixed(2);
        // Z-Wert wird nicht verwendet für G-Code
        const gcodeLine = 'G1 X' + x + ' Y' + y + ' F' + speed + '\n';
        gcode += gcodeLine;
        if (first.value) {
            gcode += moveUDown;
            first.value = false;
            speed = drawingSpeed;
        }
    }
    
    return gcode;
}