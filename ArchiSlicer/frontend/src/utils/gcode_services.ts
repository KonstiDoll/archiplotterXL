import * as THREE from 'three';
import { ref } from 'vue';
import { InfillPatternType } from './threejs_services';

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

export function createGcodeFromLineGroup(
    lineGeoGroup: THREE.Group, 
    toolNumber: number = 1, 
    penType: string = 'stabilo', 
    customFeedrate: number = 3000,
    infillToolNumber: number = null
): string {
    // Wenn kein separates Infill-Werkzeug angegeben, verwende das Hauptwerkzeug
    if (infillToolNumber === null) {
        infillToolNumber = toolNumber;
    }

    // Verwende die benutzerdefinierte Feedrate anstelle des Standardwerts
    const drawingSpeed = customFeedrate;
    
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
    
    // Sammle alle Lines inklusive Infill
    const allLines: THREE.Line[] = [];
    
    // Suche nach den Original-Linien (nicht Infill)
    lineGeoGroup.children.forEach((child, idx) => {
        if (child instanceof THREE.Line && child.name.indexOf('Infill_') !== 0) {
            allLines.push(child);
            
            // Abmessungen berechnen
            const positions = child.geometry.attributes.position.array;
            for (let i = 0; i < positions.length; i += 3) {
                const x = positions[i];
                const y = positions[i + 1];
                
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    });
    
    // Infill-Gruppe finden und Linien hinzufügen
    let infillGroup: THREE.Group | undefined;
    lineGeoGroup.children.forEach((child) => {
        if (child instanceof THREE.Group && child.name === "InfillGroup") {
            infillGroup = child;
        }
    });
    
    // Wenn Infill-Gruppe gefunden, füge diese Linien hinzu
    const infillLines: THREE.Line[] = [];
    if (infillGroup) {
        infillGroup.children.forEach((child) => {
            if (child instanceof THREE.Line) {
                infillLines.push(child);
                
                // Abmessungen aktualisieren
                const positions = child.geometry.attributes.position.array;
                for (let i = 0; i < positions.length; i += 3) {
                    const x = positions[i];
                    const y = positions[i + 1];
                    
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        });
    }
    
    console.log('SVG Abmessungen für G-Code (inklusive Infill):');
    console.log(`X: Min=${minX.toFixed(2)}, Max=${maxX.toFixed(2)}, Breite=${(maxX - minX).toFixed(2)}`);
    console.log(`Y: Min=${minY.toFixed(2)}, Max=${maxY.toFixed(2)}, Höhe=${(maxY - minY).toFixed(2)}`);
    console.log(`Gesamtanzahl Linien: ${allLines.length + infillLines.length} (davon Infill: ${infillLines.length})`);
    
    let gCode = '';
    const startingGcode = 'G90\nG21\n'
    gCode += startingGcode;
    
    // Zuerst die äußeren Konturen zeichnen mit Werkzeug 1
    if (allLines.length > 0) {
        const grabTool = 'M98 P"/macros/grab_tool_' + toolNumber + '"\n'
        const placeTool = 'M98 P"/macros/place_tool_' + toolNumber + '"\n'
        const moveToDrawingHeight = 'M98 P"/macros/move_to_drawingHeight_' + penType + '"\n'
        
        gCode += grabTool;
        gCode += '; Stifttyp: ' + penType + '\n';
        gCode += moveToDrawingHeight + moveUUp;
        
        gCode += '\n; --- Konturen zeichnen mit Tool #' + toolNumber + ' ---\n';
        allLines.forEach((lineGeo) => {
            const gcodeLine = createGcodeFromLine(lineGeo, moveUDown, drawingSpeed);
            gCode += gcodeLine;
            gCode += moveUUp;
        });
        
        gCode += placeTool;
    }
    
    // Dann Infill mit separatem Werkzeug
    if (infillLines.length > 0) {
        // Nur wenn Infill ein anderes Werkzeug verwendet oder noch kein Werkzeug geholt wurde
        if (infillToolNumber !== toolNumber || allLines.length === 0) {
            const grabInfillTool = 'M98 P"/macros/grab_tool_' + infillToolNumber + '"\n'
            const placeInfillTool = 'M98 P"/macros/place_tool_' + infillToolNumber + '"\n'
            const moveToDrawingHeight = 'M98 P"/macros/move_to_drawingHeight_' + penType + '"\n'
            
            gCode += grabInfillTool;
            gCode += '; Stifttyp für Infill: ' + penType + '\n';
            gCode += moveToDrawingHeight + moveUUp;
        }
        
        gCode += '\n; --- Infill zeichnen mit Tool #' + infillToolNumber + ' ---\n';
        infillLines.forEach((lineGeo) => {
            const gcodeLine = createGcodeFromLine(lineGeo, moveUDown, drawingSpeed);
            gCode += gcodeLine;
            gCode += moveUUp;
        });
        
        // Nur wenn Infill ein anderes Werkzeug verwendet oder keine Konturen gezeichnet wurden
        if (infillToolNumber !== toolNumber || allLines.length === 0) {
            const placeInfillTool = 'M98 P"/macros/place_tool_' + infillToolNumber + '"\n'
            gCode += placeInfillTool;
        }
    }
    
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

function createGcodeFromLine(lineGeo: THREE.Line, moveUDown: string, customFeedrate: number = 3000): string {
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
            speed = customFeedrate; // Verwende benutzerdefinierte Feedrate
        }
    }
    
    return gcode;
}