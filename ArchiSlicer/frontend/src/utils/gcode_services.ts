import * as THREE from 'three';
import { ref } from 'vue';

// Stift-Typ (mechanische Eigenschaften)
export type PenType = {
    id: string;           // z.B. "stabilo"
    displayName: string;  // z.B. "Stabilo Point 88"
    penUp: number;
    penDown: number;
}

// Tool-Konfiguration (pro Tool 1-9)
export type ToolConfig = {
    penType: string;      // ID des Stifttyps (z.B. "stabilo")
    color: string;        // Frei wählbare Hex-Farbe (z.B. "#ff0000")
}

const travelSpeed = 15000;

// Verfügbare Stift-Typen (nur mechanische Eigenschaften)
export const penTypes: { [key: string]: PenType } = {
    'stabilo':   { id: 'stabilo',   displayName: 'Stabilo Point 88', penDown: 13, penUp: 33 },
    'posca':     { id: 'posca',     displayName: 'POSCA Marker',     penDown: 13, penUp: 33 },
    'fineliner': { id: 'fineliner', displayName: 'Fineliner',        penDown: 15, penUp: 35 },
    'brushpen':  { id: 'brushpen',  displayName: 'Brushpen',         penDown: 8,  penUp: 33 },
    'marker':    { id: 'marker',    displayName: 'Marker (dick)',    penDown: 11, penUp: 36 },
};

// Liste aller verfügbaren Stift-Typen für UI-Auswahl
export const availablePenTypes = Object.keys(penTypes);

// Hilfsfunktion um PenType-Config zu bekommen
export function getPenTypeConfig(penTypeId: string): PenType | undefined {
    return penTypes[penTypeId];
}

// Standard-Tool-Konfiguration erstellen
export function createDefaultToolConfig(): ToolConfig {
    return {
        penType: 'stabilo',
        color: '#000000'
    };
}

// Alle PenType-Configs für UI
export function getAllPenTypes(): { [key: string]: PenType } {
    return penTypes;
}

export function createGcodeFromLineGroup(
    lineGeoGroup: THREE.Group,
    toolNumber: number = 1,
    toolConfig: ToolConfig = { penType: 'stabilo', color: '#000000' },
    customFeedrate: number = 3000,
    infillToolNumber: number = toolNumber,
    drawingHeight: number = 0,
    offsetX: number = 0,
    offsetY: number = 0
): string {

    // Verwende die benutzerdefinierte Feedrate anstelle des Standardwerts
    const drawingSpeed = customFeedrate;

    // Hole die PenType-Konfiguration (mechanische Eigenschaften)
    const penTypeId = toolConfig.penType;
    const penTypeConfig = penTypes[penTypeId] || penTypes['stabilo'];

    if (!penTypes[penTypeId]) {
        console.warn(`Stifttyp "${penTypeId}" nicht gefunden, verwende "stabilo"`);
    }

    const penUp = penTypeConfig.penUp;
    const penDown = penTypeConfig.penDown;
    
    // Wichtig: U und Z sind getrennte Achsen und sollten in separaten Befehlen gesteuert werden
    // Z-Achse ist für die Materialdicke (Höhenanpassung)
    // U-Achse ist nur für die Stift auf/ab Bewegung
    const moveUUp = `G1 U${penUp} F6000\n`;
    const moveUDown = `G1 U${penDown} F6000\n`;
    // Z-Offset für die Materialdicke, wird nach dem moveToDrawingHeight Makro angewendet
    // Verwendet relativen Modus (G91), um zur bestehenden Z-Höhe zu addieren
    const adjustMaterialHeight = drawingHeight > 0 
        ? `G91\nG1 Z${drawingHeight.toFixed(2)} F6000\nG90\n` 
        : '';
    
    // Analyse der SVG-Maße
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    // Sammle alle Lines inklusive Infill
    const allLines: THREE.Line[] = [];
    
    // Suche nach den Original-Linien (nicht Infill)
    lineGeoGroup.children.forEach((child) => {
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
    console.log(`Z-Höhe: ${drawingHeight.toFixed(2)}mm (Materialstärke)`);
    console.log(`Gesamtanzahl Linien: ${allLines.length + infillLines.length} (davon Infill: ${infillLines.length})`);
    
    let gCode = '';
    const startingGcode = 'G90\nG21\n'
    gCode += startingGcode;
    
    // Kommentar für die Zeichenhöhe
    if (drawingHeight > 0) {
        gCode += `; Material-/Zeichenhöhe: ${drawingHeight.toFixed(2)}mm\n`;
    }
    
    // Zuerst die äußeren Konturen zeichnen mit Werkzeug 1
    if (allLines.length > 0) {
        const grabTool = 'M98 P"/macros/grab_tool_' + toolNumber + '"\n'
        const placeTool = 'M98 P"/macros/place_tool_' + toolNumber + '"\n'
        // Makro-Name verwendet nur penTypeId (nicht Farbe)
        const moveToDrawingHeight = 'M98 P"/macros/move_to_drawingHeight_' + penTypeId + '"\n'

        gCode += grabTool;
        gCode += '; Stifttyp: ' + penTypeConfig.displayName + ', Farbe: ' + toolConfig.color + '\n';
        gCode += moveToDrawingHeight;
        
        // Füge den Z-Offset für die Materialstärke nach dem Makro hinzu
        if (drawingHeight > 0) {
            gCode += adjustMaterialHeight;
        }
        
        gCode += moveUUp;
        
        gCode += '\n; --- Konturen zeichnen mit Tool #' + toolNumber + ' ---\n';
        if (offsetX !== 0 || offsetY !== 0) {
            gCode += `; Offset: X+${offsetX.toFixed(2)}, Y+${offsetY.toFixed(2)}\n`;
        }
        allLines.forEach((lineGeo) => {
            const gcodeLine = createGcodeFromLine(lineGeo, moveUDown, drawingSpeed, offsetX, offsetY);
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
            // Makro-Name verwendet nur penTypeId (nicht Farbe)
            const moveToDrawingHeight = 'M98 P"/macros/move_to_drawingHeight_' + penTypeId + '"\n'

            gCode += grabInfillTool;
            gCode += '; Stifttyp für Infill: ' + penTypeConfig.displayName + '\n';
            gCode += moveToDrawingHeight;
            
            // Füge den Z-Offset für die Materialstärke nach dem Makro hinzu
            if (drawingHeight > 0) {
                gCode += adjustMaterialHeight;
            }
            
            gCode += moveUUp;
        }
        
        gCode += '\n; --- Infill zeichnen mit Tool #' + infillToolNumber + ' ---\n';
        infillLines.forEach((lineGeo) => {
            const gcodeLine = createGcodeFromLine(lineGeo, moveUDown, drawingSpeed, offsetX, offsetY);
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

// Interface für Farb-Tool-Zuordnung (Import aus store.ts vermeiden - eigene Definition)
interface ColorToolMapping {
    color: string;
    toolNumber: number;
    lineCount: number;
    visible: boolean;
}

// Neue Funktion für Multi-Color G-Code
export function createGcodeFromColorGroups(
    lineGeoGroup: THREE.Group,
    colorGroups: ColorToolMapping[],
    toolConfigs: ToolConfig[],
    customFeedrate: number = 3000,
    drawingHeight: number = 0,
    offsetX: number = 0,
    offsetY: number = 0
): string {
    // Map von Farbe zu Tool-Nummer erstellen
    const colorToTool = new Map<string, number>();
    colorGroups.forEach(cg => {
        colorToTool.set(cg.color, cg.toolNumber);
    });

    // Linien nach Tool gruppieren (für optimale Tool-Wechsel)
    const linesByTool = new Map<number, THREE.Line[]>();

    // Sammle alle Linien (außer Infill)
    lineGeoGroup.children.forEach((child) => {
        if (child instanceof THREE.Line && child.name.indexOf('Infill_') !== 0) {
            const strokeColor = child.userData?.strokeColor || '#000000';
            const toolNumber = colorToTool.get(strokeColor) || 1;

            if (!linesByTool.has(toolNumber)) {
                linesByTool.set(toolNumber, []);
            }
            linesByTool.get(toolNumber)!.push(child);
        }
    });

    // Infill-Linien sammeln (bekommen das erste Tool)
    const infillLines: THREE.Line[] = [];
    lineGeoGroup.children.forEach((child) => {
        if (child instanceof THREE.Group && child.name === "InfillGroup") {
            child.children.forEach((infillChild) => {
                if (infillChild instanceof THREE.Line) {
                    infillLines.push(infillChild);
                }
            });
        }
    });

    // G-Code generieren
    let gCode = '';
    gCode += 'G90\nG21\n'; // Absolute positioning, millimeters

    if (drawingHeight > 0) {
        gCode += `; Material-/Zeichenhöhe: ${drawingHeight.toFixed(2)}mm\n`;
    }

    // Z-Offset für die Materialdicke
    const adjustMaterialHeight = drawingHeight > 0
        ? `G91\nG1 Z${drawingHeight.toFixed(2)} F6000\nG90\n`
        : '';

    // Sortiere Tools für konsistente Reihenfolge
    const sortedTools = Array.from(linesByTool.keys()).sort((a, b) => a - b);

    // Für jedes Tool die Linien zeichnen
    sortedTools.forEach((toolNumber) => {
        const lines = linesByTool.get(toolNumber)!;
        if (lines.length === 0) return;

        // Tool-Konfiguration für dieses Tool (0-indexed)
        const toolConfig = toolConfigs[toolNumber - 1] || { penType: 'stabilo', color: '#000000' };
        const penTypeId = toolConfig.penType;
        const penTypeConfig = penTypes[penTypeId] || penTypes['stabilo'];

        const penUp = penTypeConfig.penUp;
        const penDown = penTypeConfig.penDown;
        const moveUUp = `G1 U${penUp} F6000\n`;
        const moveUDown = `G1 U${penDown} F6000\n`;

        // Tool wechseln
        gCode += `\n; === Tool #${toolNumber} (${penTypeConfig.displayName}, ${toolConfig.color}) ===\n`;
        gCode += `M98 P"/macros/grab_tool_${toolNumber}"\n`;
        // Makro-Name verwendet nur penTypeId (nicht Farbe)
        gCode += `M98 P"/macros/move_to_drawingHeight_${penTypeId}"\n`;

        if (drawingHeight > 0) {
            gCode += adjustMaterialHeight;
        }

        gCode += moveUUp;

        // Farben die diesem Tool zugeordnet sind
        const colorsForTool: string[] = [];
        colorGroups.forEach(cg => {
            if (cg.toolNumber === toolNumber) {
                colorsForTool.push(cg.color);
            }
        });
        gCode += `; Farben: ${colorsForTool.join(', ')}\n`;
        gCode += `; ${lines.length} Linien\n`;
        if (offsetX !== 0 || offsetY !== 0) {
            gCode += `; Offset: X+${offsetX.toFixed(2)}, Y+${offsetY.toFixed(2)}\n`;
        }

        // Linien zeichnen
        lines.forEach((lineGeo) => {
            const gcodeLine = createGcodeFromLine(lineGeo, moveUDown, customFeedrate, offsetX, offsetY);
            gCode += gcodeLine;
            gCode += moveUUp;
        });

        // Tool ablegen
        gCode += `M98 P"/macros/place_tool_${toolNumber}"\n`;
    });

    // Infill separat (mit Tool 1 oder separatem Infill-Tool)
    if (infillLines.length > 0) {
        const infillTool = 1; // Könnte später konfigurierbar sein
        const infillToolConfig = toolConfigs[infillTool - 1] || { penType: 'stabilo', color: '#000000' };
        const infillPenTypeId = infillToolConfig.penType;
        const infillPenTypeConfig = penTypes[infillPenTypeId] || penTypes['stabilo'];

        const penUp = infillPenTypeConfig.penUp;
        const penDown = infillPenTypeConfig.penDown;
        const moveUUp = `G1 U${penUp} F6000\n`;
        const moveUDown = `G1 U${penDown} F6000\n`;

        gCode += `\n; === Infill mit Tool #${infillTool} ===\n`;
        gCode += `M98 P"/macros/grab_tool_${infillTool}"\n`;
        // Makro-Name verwendet nur penTypeId (nicht Farbe)
        gCode += `M98 P"/macros/move_to_drawingHeight_${infillPenTypeId}"\n`;

        if (drawingHeight > 0) {
            gCode += adjustMaterialHeight;
        }

        gCode += moveUUp;
        gCode += `; ${infillLines.length} Infill-Linien\n`;

        infillLines.forEach((lineGeo) => {
            const gcodeLine = createGcodeFromLine(lineGeo, moveUDown, customFeedrate, offsetX, offsetY);
            gCode += gcodeLine;
            gCode += moveUUp;
        });

        gCode += `M98 P"/macros/place_tool_${infillTool}"\n`;
    }

    gCode += 'G1 Y0 F15000\n';

    console.log(`Multi-Color G-Code generiert: ${sortedTools.length} Tools verwendet`);

    return gCode;
}

// Helper function for creating G-code from a single line
function createGcodeFromLine(
    lineGeo: THREE.Line,
    moveUDown: string,
    customFeedrate: number = 3000,
    offsetX: number = 0,
    offsetY: number = 0
): string {
    let gcode = '';
    const first = ref(true);
    let speed = travelSpeed;

    // Erste und letzte Position für Logging
    const positions = lineGeo.geometry.attributes.position.array;
    if (positions.length > 0) {
        console.log(`Linie Startpunkt: X=${(positions[0] + offsetX).toFixed(2)}, Y=${(positions[1] + offsetY).toFixed(2)}`);
        const lastIndex = positions.length - 3;
        console.log(`Linie Endpunkt: X=${(positions[lastIndex] + offsetX).toFixed(2)}, Y=${(positions[lastIndex+1] + offsetY).toFixed(2)}`);
    }

    for (let index = 0; index < positions.length; index += 3) {
        // Offset auf Koordinaten anwenden
        const x = (positions[index] + offsetX).toFixed(2);
        const y = (positions[index + 1] + offsetY).toFixed(2);
        // Z-Wert wird nicht im Bewegungsbefehl gesetzt, da dieser bereits durch setMaterialHeight gesetzt wurde
        const gcodeLine = `G1 X${x} Y${y} F${speed}\n`;
        gcode += gcodeLine;
        if (first.value) {
            gcode += moveUDown;
            first.value = false;
            speed = customFeedrate; // Verwende benutzerdefinierte Feedrate
        }
    }

    return gcode;
}