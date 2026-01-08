import * as THREE from 'three';
import { ref, reactive } from 'vue';

// API base URL - use env var for dev, empty for production (relative URLs)
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Stift-Typ (mechanische Eigenschaften + Pump-Einstellungen)
export type PenType = {
    id: string;           // z.B. "stabilo"
    displayName: string;  // z.B. "Stabilo Point 88"
    penUp: number;
    penDown: number;
    pumpDistanceThreshold: number;  // mm, 0 = disabled
    pumpHeight: number;             // mm
}

// Tool-Konfiguration (pro Tool 1-9)
export type ToolConfig = {
    penType: string;      // ID des Stifttyps (z.B. "stabilo")
    color: string;        // Frei wählbare Hex-Farbe (z.B. "#ff0000")
}

const travelSpeed = 15000;

// End-G-Code für sicheres Beenden
// Hinweis: U-Achse wird nicht bewegt, da Tool-Ablage-Makros dies handhaben
// X wird nicht auf 0 gefahren (Kollisionsgefahr mit Werkzeughalter)
function generateEndGcode(): string {
    return `
; === END G-CODE ===
G1 Y0 F${travelSpeed}        ; Y zur Ausgangsposition
M400                 ; Warten bis alle Bewegungen fertig
; === ENDE ===
`;
}

// Fallback pen types (used when API is unavailable)
const fallbackPenTypes: { [key: string]: PenType } = {
    'stabilo':   { id: 'stabilo',   displayName: 'Stabilo Point 88', penDown: 13, penUp: 33, pumpDistanceThreshold: 0, pumpHeight: 50 },
    'posca':     { id: 'posca',     displayName: 'POSCA Marker',     penDown: 13, penUp: 33, pumpDistanceThreshold: 0, pumpHeight: 50 },
    'fineliner': { id: 'fineliner', displayName: 'Fineliner',        penDown: 15, penUp: 35, pumpDistanceThreshold: 0, pumpHeight: 50 },
    'brushpen':  { id: 'brushpen',  displayName: 'Brushpen',         penDown: 8,  penUp: 33, pumpDistanceThreshold: 0, pumpHeight: 50 },
    'marker':    { id: 'marker',    displayName: 'Marker (dick)',    penDown: 11, penUp: 36, pumpDistanceThreshold: 0, pumpHeight: 50 },
};

// Reactive pen types store (loaded from API)
export const penTypes = reactive<{ [key: string]: PenType }>({ ...fallbackPenTypes });

// Loading state for pen types
export const penTypesLoading = ref(false);
export const penTypesError = ref<string | null>(null);

// Fetch pen types from API
export async function fetchPenTypes(): Promise<void> {
    penTypesLoading.value = true;
    penTypesError.value = null;

    try {
        const response = await fetch(`${API_BASE_URL}/api/pen-types`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Clear existing and add fetched pen types
        Object.keys(penTypes).forEach(key => delete penTypes[key]);
        data.forEach((pt: any) => {
            penTypes[pt.id] = {
                id: pt.id,
                displayName: pt.display_name,
                penUp: pt.pen_up,
                penDown: pt.pen_down,
                pumpDistanceThreshold: pt.pump_distance_threshold,
                pumpHeight: pt.pump_height,
            };
        });

        console.log(`Loaded ${data.length} pen types from API`);
    } catch (error) {
        console.error('Failed to fetch pen types from API, using fallback:', error);
        penTypesError.value = error instanceof Error ? error.message : 'Unknown error';

        // Restore fallback pen types
        Object.keys(penTypes).forEach(key => delete penTypes[key]);
        Object.assign(penTypes, fallbackPenTypes);
    } finally {
        penTypesLoading.value = false;
    }
}

// API functions for pen type management
export async function createPenType(penType: Omit<PenType, 'id'> & { id: string }): Promise<PenType> {
    const response = await fetch(`${API_BASE_URL}/api/pen-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: penType.id,
            display_name: penType.displayName,
            pen_up: penType.penUp,
            pen_down: penType.penDown,
            pump_distance_threshold: penType.pumpDistanceThreshold,
            pump_height: penType.pumpHeight,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create pen type');
    }

    await fetchPenTypes(); // Refresh the list
    return await response.json();
}

export async function updatePenType(id: string, updates: Partial<PenType>): Promise<PenType> {
    const body: any = {};
    if (updates.displayName !== undefined) body.display_name = updates.displayName;
    if (updates.penUp !== undefined) body.pen_up = updates.penUp;
    if (updates.penDown !== undefined) body.pen_down = updates.penDown;
    if (updates.pumpDistanceThreshold !== undefined) body.pump_distance_threshold = updates.pumpDistanceThreshold;
    if (updates.pumpHeight !== undefined) body.pump_height = updates.pumpHeight;

    const response = await fetch(`${API_BASE_URL}/api/pen-types/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update pen type');
    }

    await fetchPenTypes(); // Refresh the list
    return await response.json();
}

export async function deletePenType(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/pen-types/${id}`, {
        method: 'DELETE',
    });

    if (!response.ok && response.status !== 204) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete pen type');
    }

    await fetchPenTypes(); // Refresh the list
}

// Liste aller verfügbaren Stift-Typen für UI-Auswahl (computed from reactive penTypes)
export function getAvailablePenTypes(): string[] {
    return Object.keys(penTypes);
}

// For backwards compatibility
export const availablePenTypes = Object.keys(fallbackPenTypes);

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

// --- Tool Presets ---

export type ToolPreset = {
    id: number;
    name: string;
    tool_configs: ToolConfig[];
};

// Reactive store for tool presets
export const toolPresets = reactive<ToolPreset[]>([]);
export const toolPresetsLoading = ref(false);
export const toolPresetsError = ref<string | null>(null);

export async function fetchToolPresets(): Promise<void> {
    toolPresetsLoading.value = true;
    toolPresetsError.value = null;

    try {
        const response = await fetch(`${API_BASE_URL}/api/tool-presets`);
        if (!response.ok) {
            throw new Error('Failed to fetch tool presets');
        }
        const data = await response.json();
        toolPresets.length = 0;
        toolPresets.push(...data);
    } catch (e) {
        toolPresetsError.value = e instanceof Error ? e.message : 'Unknown error';
    } finally {
        toolPresetsLoading.value = false;
    }
}

export async function createToolPreset(name: string, configs: ToolConfig[]): Promise<ToolPreset> {
    const response = await fetch(`${API_BASE_URL}/api/tool-presets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, tool_configs: configs }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create tool preset');
    }

    const created = await response.json();
    await fetchToolPresets();
    return created;
}

export async function updateToolPreset(id: number, name: string, configs: ToolConfig[]): Promise<ToolPreset> {
    const response = await fetch(`${API_BASE_URL}/api/tool-presets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, tool_configs: configs }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update tool preset');
    }

    const updated = await response.json();
    await fetchToolPresets();
    return updated;
}

export async function deleteToolPreset(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/tool-presets/${id}`, {
        method: 'DELETE',
    });

    if (!response.ok && response.status !== 204) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete tool preset');
    }

    await fetchToolPresets();
}

// Calculate line length from positions array
function calculateLineLength(positions: ArrayLike<number>): number {
    let length = 0;
    for (let i = 3; i < positions.length; i += 3) {
        const dx = positions[i] - positions[i - 3];
        const dy = positions[i + 1] - positions[i - 2];
        length += Math.sqrt(dx * dx + dy * dy);
    }
    return length;
}

// Generate pump G-code
// pumpTravel is the distance in mm to move Z down (relative) for pumping
// WICHTIG: Stift muss bereits unten (penDown) sein!
function generatePumpGcode(pumpTravel: number): string {
    return `; === PUMP ACTION ===
G91 ; relative positioning
G1 Z-${pumpTravel.toFixed(2)} F6000
G1 Z${pumpTravel.toFixed(2)} F6000
G90 ; back to absolute positioning
; === END PUMP ===
`;
}

export function createGcodeFromLineGroup(
    lineGeoGroup: THREE.Group,
    toolNumber: number = 1,
    toolConfig: ToolConfig = { penType: 'stabilo', color: '#000000' },
    customFeedrate: number = 3000,
    infillToolNumber: number = toolNumber,
    infillToolConfig: ToolConfig = toolConfig,  // Separate Konfiguration für Infill-Tool
    drawingHeight: number = 0,
    offsetX: number = 0,
    offsetY: number = 0
): string {

    // Verwende die benutzerdefinierte Feedrate anstelle des Standardwerts
    const drawingSpeed = customFeedrate;

    // Hole die PenType-Konfiguration für Konturen
    const penTypeId = toolConfig.penType;
    const penTypeConfig = penTypes[penTypeId] || penTypes['stabilo'];

    // Hole die PenType-Konfiguration für Infill
    const infillPenTypeId = infillToolConfig.penType;
    const infillPenTypeConfig = penTypes[infillPenTypeId] || penTypes['stabilo'];

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
    // Unterstützt verschiedene Namen: "InfillGroup", "InfillGroupWithHoles", "InfillGroup_<color>"
    let infillGroup: THREE.Group | undefined;
    lineGeoGroup.children.forEach((child) => {
        if (child instanceof THREE.Group && child.name.startsWith("InfillGroup")) {
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

        // Pump context for this tool
        const pumpCtx: PumpContext = {
            accumulatedDistance: 0,
            pumpDistanceThreshold: penTypeConfig.pumpDistanceThreshold || 0,
            pumpHeight: penTypeConfig.pumpHeight || 50,
        };

        allLines.forEach((lineGeo) => {
            // Pass pumpCtx to enable pumping DURING drawing (important for polylines!)
            const { gcode: gcodeLine } = createGcodeFromLine(lineGeo, moveUDown, drawingSpeed, offsetX, offsetY, pumpCtx);
            gCode += gcodeLine;

            // Check if we need to pump at the END of this line (after drawing finished)
            gCode += checkAndGeneratePump(pumpCtx);

            // Now lift pen
            gCode += moveUUp;
        });

        // Tool nur ablegen wenn kein Infill oder Infill anderes Tool verwendet
        if (infillLines.length === 0 || infillToolNumber !== toolNumber) {
            gCode += placeTool;
        }
    }

    // Dann Infill
    if (infillLines.length > 0) {
        // Pen-Bewegungen für Infill-Tool
        const infillPenUp = infillPenTypeConfig.penUp;
        const infillPenDown = infillPenTypeConfig.penDown;
        const moveInfillUUp = `G1 U${infillPenUp} F6000\n`;
        const moveInfillUDown = `G1 U${infillPenDown} F6000\n`;

        // Tool-Wechsel nur wenn anderes Werkzeug oder noch kein Werkzeug geholt wurde
        if (infillToolNumber !== toolNumber || allLines.length === 0) {
            const grabInfillTool = 'M98 P"/macros/grab_tool_' + infillToolNumber + '"\n'
            const moveToDrawingHeight = 'M98 P"/macros/move_to_drawingHeight_' + infillPenTypeId + '"\n'

            gCode += grabInfillTool;
            gCode += '; Stifttyp für Infill: ' + infillPenTypeConfig.displayName + '\n';
            gCode += moveToDrawingHeight;

            // Füge den Z-Offset für die Materialstärke nach dem Makro hinzu
            if (drawingHeight > 0) {
                gCode += adjustMaterialHeight;
            }

            gCode += moveInfillUUp;
        }

        // Pump context for infill tool
        const infillPumpCtx: PumpContext = {
            accumulatedDistance: 0,
            pumpDistanceThreshold: infillPenTypeConfig.pumpDistanceThreshold || 0,
            pumpHeight: infillPenTypeConfig.pumpHeight || 50,
        };

        gCode += '\n; --- Infill zeichnen mit Tool #' + infillToolNumber + ' ---\n';
        infillLines.forEach((lineGeo) => {
            // Pass pumpCtx to enable pumping DURING drawing (important for polylines!)
            const { gcode: gcodeLine } = createGcodeFromLine(lineGeo, moveInfillUDown, drawingSpeed, offsetX, offsetY, infillPumpCtx);
            gCode += gcodeLine;

            // Check if we need to pump at the END of this line (after drawing finished)
            gCode += checkAndGeneratePump(infillPumpCtx);

            // Now lift pen
            gCode += moveInfillUUp;
        });

        // Tool ablegen (immer das Infill-Tool, da es das letzte verwendete ist)
        const placeInfillTool = 'M98 P"/macros/place_tool_' + infillToolNumber + '"\n'
        gCode += placeInfillTool;
    }

    gCode += generateEndGcode();

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
    offsetY: number = 0,
    infillToolNumber: number = 1,  // Tool-Nummer für File-Level Infill
    fileToolNumber: number = 1  // NEW: Fallback tool for contours
): string {
    // Map von Farbe zu Tool-Nummer und Sichtbarkeit erstellen
    const colorToTool = new Map<string, number>();
    const colorVisibility = new Map<string, boolean>();
    colorGroups.forEach(cg => {
        // Use file defaults if useFileDefaults is true
        const effectiveTool = cg.useFileDefaults ? fileToolNumber : cg.toolNumber;
        colorToTool.set(cg.color, effectiveTool);
        colorVisibility.set(cg.color, cg.visible);
    });

    // Linien nach Tool gruppieren (für optimale Tool-Wechsel)
    const linesByTool = new Map<number, THREE.Line[]>();

    // Sammle alle Linien (außer Infill)
    lineGeoGroup.children.forEach((child) => {
        if (child instanceof THREE.Line && child.name.indexOf('Infill_') !== 0) {
            // Verwende effectiveColor (berücksichtigt stroke/fill Priorität)
            const color = child.userData?.effectiveColor
                       || child.userData?.strokeColor
                       || '#000000';

            // NEW: Skip invisible colors
            const isVisible = colorVisibility.get(color) ?? true;
            if (!isVisible) {
                return; // Skip this line if color is hidden
            }

            const toolNumber = colorToTool.get(color) || 1;

            if (!linesByTool.has(toolNumber)) {
                linesByTool.set(toolNumber, []);
            }
            linesByTool.get(toolNumber)!.push(child);
        }
    });

    // Infill-Linien sammeln (bekommen das erste Tool)
    // Unterstützt verschiedene Namen: "InfillGroup", "InfillGroupWithHoles", "InfillGroup_<color>"
    const infillLines: THREE.Line[] = [];
    lineGeoGroup.children.forEach((child) => {
        if (child instanceof THREE.Group && child.name.startsWith("InfillGroup")) {
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

    // Tracking für Tool-Wechsel Optimierung
    let lastToolNumber: number | null = null;

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

        gCode += `\n; === Tool #${toolNumber} (${penTypeConfig.displayName}, ${toolConfig.color}) ===\n`;

        // Tool-Wechsel nur wenn nötig
        if (lastToolNumber !== toolNumber) {
            if (lastToolNumber !== null) {
                gCode += `M98 P"/macros/place_tool_${lastToolNumber}"\n`;
            }
            gCode += `M98 P"/macros/grab_tool_${toolNumber}"\n`;
            gCode += `M98 P"/macros/move_to_drawingHeight_${penTypeId}"\n`;
            if (drawingHeight > 0) {
                gCode += adjustMaterialHeight;
            }
            lastToolNumber = toolNumber;
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

        // Pump context for this tool
        const pumpCtx: PumpContext = {
            accumulatedDistance: 0,
            pumpDistanceThreshold: penTypeConfig.pumpDistanceThreshold || 0,
            pumpHeight: penTypeConfig.pumpHeight || 50,
        };

        // Linien zeichnen
        lines.forEach((lineGeo) => {
            // Pass pumpCtx to enable pumping DURING drawing (important for polylines!)
            const { gcode: gcodeLine } = createGcodeFromLine(lineGeo, moveUDown, customFeedrate, offsetX, offsetY, pumpCtx);
            gCode += gcodeLine;

            // Check if we need to pump at the END of this line (after drawing finished)
            gCode += checkAndGeneratePump(pumpCtx);

            // Now lift pen
            gCode += moveUUp;
        });
    });

    // Infill separat (mit konfiguriertem Infill-Tool)
    if (infillLines.length > 0) {
        const infillToolConfig = toolConfigs[infillToolNumber - 1] || { penType: 'stabilo', color: '#000000' };
        const infillPenTypeId = infillToolConfig.penType;
        const infillPenTypeConfig = penTypes[infillPenTypeId] || penTypes['stabilo'];

        const penUp = infillPenTypeConfig.penUp;
        const penDown = infillPenTypeConfig.penDown;
        const moveUUp = `G1 U${penUp} F6000\n`;
        const moveUDown = `G1 U${penDown} F6000\n`;

        gCode += `\n; === Infill mit Tool #${infillToolNumber} ===\n`;

        // Tool-Wechsel nur wenn nötig
        if (lastToolNumber !== infillToolNumber) {
            if (lastToolNumber !== null) {
                gCode += `M98 P"/macros/place_tool_${lastToolNumber}"\n`;
            }
            gCode += `M98 P"/macros/grab_tool_${infillToolNumber}"\n`;
            gCode += `M98 P"/macros/move_to_drawingHeight_${infillPenTypeId}"\n`;
            if (drawingHeight > 0) {
                gCode += adjustMaterialHeight;
            }
            lastToolNumber = infillToolNumber;
        }

        // Pump context for infill tool
        const infillPumpCtx: PumpContext = {
            accumulatedDistance: 0,
            pumpDistanceThreshold: infillPenTypeConfig.pumpDistanceThreshold || 0,
            pumpHeight: infillPenTypeConfig.pumpHeight || 50,
            penUp: penUp,
        };

        gCode += moveUUp;
        gCode += `; ${infillLines.length} Infill-Linien\n`;

        infillLines.forEach((lineGeo) => {
            // Pass pumpCtx to enable pumping DURING drawing (important for polylines!)
            const { gcode: gcodeLine } = createGcodeFromLine(lineGeo, moveUDown, customFeedrate, offsetX, offsetY, infillPumpCtx);
            gCode += gcodeLine;

            // Check if we need to pump at the END of this line (after drawing finished)
            gCode += checkAndGeneratePump(infillPumpCtx);

            // Now lift pen
            gCode += moveUUp;
        });
    }

    // Letztes Tool ablegen
    if (lastToolNumber !== null) {
        gCode += `M98 P"/macros/place_tool_${lastToolNumber}"\n`;
    }

    gCode += generateEndGcode();

    console.log(`Multi-Color G-Code generiert: ${sortedTools.length} Tools verwendet`);

    return gCode;
}

// Interface für ColorGroup mit Infill-Einstellungen
interface ColorGroupWithInfill {
    color: string;
    toolNumber: number;
    lineCount: number;
    visible: boolean;
    infillEnabled: boolean;
    infillToolNumber: number;
    infillOptions: {
        patternType: string;
        density: number;
        angle: number;
        outlineOffset: number;
    };
}

/**
 * Generiert G-Code mit farb-basiertem Infill
 *
 * Reihenfolge pro Farbe:
 * 1. Konturen dieser Farbe (mit Kontur-Tool)
 * 2. Infill dieser Farbe (mit Infill-Tool, falls aktiviert)
 * 3. Nächste Farbe...
 *
 * @param lineGeoGroup Die THREE.Group mit allen SVG-Linien
 * @param colorGroups ColorGroups mit Infill-Einstellungen
 * @param infillGroups Map von Farbe → Infill-Gruppe
 * @param toolConfigs Tool-Konfigurationen (Index 0 = Tool 1)
 * @param customFeedrate Zeichengeschwindigkeit
 * @param drawingHeight Z-Höhe für Materialstärke
 * @param offsetX X-Offset
 * @param offsetY Y-Offset
 */
export function createGcodeWithColorInfill(
    lineGeoGroup: THREE.Group,
    colorGroups: ColorGroupWithInfill[],
    infillGroups: Map<string, THREE.Group>,
    toolConfigs: ToolConfig[],
    customFeedrate: number = 3000,
    drawingHeight: number = 0,
    offsetX: number = 0,
    offsetY: number = 0,
    fileToolNumber: number = 1,  // NEW: Fallback tool for contours
    fileInfillToolNumber: number = 1  // NEW: Fallback tool for infill
): string {
    let gCode = 'G90\nG21\n'; // Absolute positioning, millimeters

    if (drawingHeight > 0) {
        gCode += `; Material-/Zeichenhöhe: ${drawingHeight.toFixed(2)}mm\n`;
    }

    // Z-Offset für die Materialdicke
    const adjustMaterialHeight = drawingHeight > 0
        ? `G91\nG1 Z${drawingHeight.toFixed(2)} F6000\nG90\n`
        : '';

    // Gruppiere Konturen nach Farbe
    const linesByColor = new Map<string, THREE.Line[]>();

    lineGeoGroup.children.forEach((child) => {
        if (child instanceof THREE.Line && !child.name.startsWith('Infill_')) {
            const color = (child.userData?.effectiveColor || '#000000').toLowerCase();
            if (!linesByColor.has(color)) {
                linesByColor.set(color, []);
            }
            linesByColor.get(color)!.push(child);
        }
    });

    let lastToolNumber: number | null = null;

    // Verarbeite jede Farbgruppe
    for (const colorGroup of colorGroups) {
        // Überspringe unsichtbare Farben
        if (!colorGroup.visible) continue;

        const color = colorGroup.color.toLowerCase();
        const contourLines = linesByColor.get(color) || [];
        const infillGroup = infillGroups.get(color);
        const hasInfill = colorGroup.infillEnabled && infillGroup && infillGroup.children.length > 0;

        // Überspringe wenn weder Konturen noch Infill vorhanden
        if (contourLines.length === 0 && !hasInfill) continue;

        gCode += `\n; === Farbe ${colorGroup.color} ===\n`;

        // --- KONTUREN ---
        if (contourLines.length > 0) {
            // Use file defaults if useFileDefaults is true
            const contourTool = colorGroup.useFileDefaults ? fileToolNumber : colorGroup.toolNumber;
            const toolConfig = toolConfigs[contourTool - 1] || { penType: 'stabilo', color: '#000000' };
            const penTypeConfig = penTypes[toolConfig.penType] || penTypes['stabilo'];

            // Tool-Wechsel falls nötig
            if (lastToolNumber !== contourTool) {
                // Vorheriges Tool ablegen
                if (lastToolNumber !== null) {
                    gCode += `M98 P"/macros/place_tool_${lastToolNumber}"\n`;
                }
                // Neues Tool holen
                gCode += `M98 P"/macros/grab_tool_${contourTool}"\n`;
                gCode += `M98 P"/macros/move_to_drawingHeight_${toolConfig.penType}"\n`;
                if (drawingHeight > 0) {
                    gCode += adjustMaterialHeight;
                }
                lastToolNumber = contourTool;
            }

            const moveUUp = `G1 U${penTypeConfig.penUp} F6000\n`;
            const moveUDown = `G1 U${penTypeConfig.penDown} F6000\n`;

            // Pump context for contour tool
            const contourPumpCtx: PumpContext = {
                accumulatedDistance: 0,
                pumpDistanceThreshold: penTypeConfig.pumpDistanceThreshold || 0,
                pumpHeight: penTypeConfig.pumpHeight || 50,
            };

            gCode += moveUUp;
            gCode += `; Konturen (${contourLines.length} Linien) mit Tool #${contourTool}\n`;

            contourLines.forEach((lineGeo) => {
                // Pass pumpCtx to enable pumping DURING drawing (important for polylines!)
                const { gcode: gcodeLine } = createGcodeFromLine(lineGeo, moveUDown, customFeedrate, offsetX, offsetY, contourPumpCtx);
                gCode += gcodeLine;

                // Check if we need to pump at the END of this line (after drawing finished)
                gCode += checkAndGeneratePump(contourPumpCtx);

                // Now lift pen
                gCode += moveUUp;
            });
        }

        // --- INFILL ---
        if (hasInfill) {
            // Use file defaults if useFileDefaults is true
            const infillTool = colorGroup.useFileDefaults ? fileInfillToolNumber : colorGroup.infillToolNumber;
            const toolConfig = toolConfigs[infillTool - 1] || { penType: 'stabilo', color: '#000000' };
            const penTypeConfig = penTypes[toolConfig.penType] || penTypes['stabilo'];

            // Tool-Wechsel falls nötig
            if (lastToolNumber !== infillTool) {
                // Vorheriges Tool ablegen
                if (lastToolNumber !== null) {
                    gCode += `M98 P"/macros/place_tool_${lastToolNumber}"\n`;
                }
                // Neues Tool holen
                gCode += `M98 P"/macros/grab_tool_${infillTool}"\n`;
                gCode += `M98 P"/macros/move_to_drawingHeight_${toolConfig.penType}"\n`;
                if (drawingHeight > 0) {
                    gCode += adjustMaterialHeight;
                }
                lastToolNumber = infillTool;
            }

            const moveUUp = `G1 U${penTypeConfig.penUp} F6000\n`;
            const moveUDown = `G1 U${penTypeConfig.penDown} F6000\n`;

            // Pump context for infill tool
            const infillPumpCtx: PumpContext = {
                accumulatedDistance: 0,
                pumpDistanceThreshold: penTypeConfig.pumpDistanceThreshold || 0,
                pumpHeight: penTypeConfig.pumpHeight || 50,
            };

            gCode += moveUUp;
            gCode += `; Infill (${colorGroup.infillOptions.patternType}, ${infillGroup!.children.length} Linien) mit Tool #${infillTool}\n`;

            infillGroup!.children.forEach((child) => {
                if (child instanceof THREE.Line) {
                    // Pass pumpCtx to enable pumping DURING drawing (important for polylines!)
                    const { gcode: gcodeLine } = createGcodeFromLine(child, moveUDown, customFeedrate, offsetX, offsetY, infillPumpCtx);
                    gCode += gcodeLine;

                    // Check if we need to pump at the END of this line (after drawing finished)
                    gCode += checkAndGeneratePump(infillPumpCtx);

                    // Now lift pen
                    gCode += moveUUp;
                }
            });
        }
    }

    // Letztes Tool ablegen
    if (lastToolNumber !== null) {
        gCode += `M98 P"/macros/place_tool_${lastToolNumber}"\n`;
    }

    gCode += generateEndGcode();

    console.log(`G-Code mit farb-basiertem Infill generiert`);

    return gCode;
}

// Context for pump tracking during G-code generation
interface PumpContext {
    accumulatedDistance: number;
    pumpDistanceThreshold: number;  // 0 = disabled
    pumpHeight: number;  // relative Z travel distance for pumping (moves down then back up)
}

// Helper function for creating G-code from a single line
// Returns { gcode, lineLength } for pump tracking
// Can pump during drawing if pumpCtx is provided (for polylines)
function createGcodeFromLine(
    lineGeo: THREE.Line,
    moveUDown: string,
    customFeedrate: number = 3000,
    offsetX: number = 0,
    offsetY: number = 0,
    pumpCtx?: PumpContext
): { gcode: string; lineLength: number } {
    let gcode = '';
    let first = true;
    let speed = travelSpeed;

    // Erste und letzte Position für Logging
    const positions = lineGeo.geometry.attributes.position.array;
    if (positions.length > 0) {
        console.log(`Linie Startpunkt: X=${(positions[0] + offsetX).toFixed(2)}, Y=${(positions[1] + offsetY).toFixed(2)}`);
        const lastIndex = positions.length - 3;
        console.log(`Linie Endpunkt: X=${(positions[lastIndex] + offsetX).toFixed(2)}, Y=${(positions[lastIndex+1] + offsetY).toFixed(2)}`);
    }

    for (let index = 0; index < positions.length; index += 3) {
        // Koordinaten im Slicer-System (X horizontal, Y vertikal)
        const slicerX = positions[index] + offsetX;
        const slicerY = positions[index + 1] + offsetY;

        // Transformation zum Maschinen-System: X↔Y tauschen
        // Maschine: X vertikal (nach oben), Y horizontal (nach rechts)
        // Slicer:   X horizontal (nach rechts), Y vertikal (nach oben)
        const machineX = slicerY.toFixed(2);  // Slicer Y → Maschine X (vertikal)
        const machineY = slicerX.toFixed(2);  // Slicer X → Maschine Y (horizontal)

        const gcodeLine = `G1 X${machineX} Y${machineY} F${speed}\n`;
        gcode += gcodeLine;

        if (first) {
            gcode += moveUDown;
            first = false;
            speed = customFeedrate; // Verwende benutzerdefinierte Feedrate
        } else if (pumpCtx) {
            // Calculate segment length (distance from previous point)
            const prevX = positions[index - 3];
            const prevY = positions[index - 2];
            const segmentLength = Math.sqrt(
                Math.pow(slicerX - (prevX + offsetX), 2) +
                Math.pow(slicerY - (prevY + offsetY), 2)
            );

            // Track distance and pump if threshold reached (WITHIN the polyline)
            if (pumpCtx.pumpDistanceThreshold > 0) {
                pumpCtx.accumulatedDistance += segmentLength;

                if (pumpCtx.accumulatedDistance >= pumpCtx.pumpDistanceThreshold) {
                    pumpCtx.accumulatedDistance = 0;
                    gcode += generatePumpGcode(pumpCtx.pumpHeight);
                }
            }
        }
    }

    const lineLength = calculateLineLength(positions);
    return { gcode, lineLength };
}

// Helper to check and generate pump action if needed
// Returns pump G-code if threshold reached, otherwise empty string
// WICHTIG: Muss BEVOR Stift hochgefahren wird aufgerufen werden!
function checkAndGeneratePump(pumpCtx: PumpContext): string {
    if (pumpCtx.pumpDistanceThreshold <= 0) {
        return ''; // Pump disabled
    }

    if (pumpCtx.accumulatedDistance >= pumpCtx.pumpDistanceThreshold) {
        pumpCtx.accumulatedDistance = 0; // Reset counter
        // pumpHeight is now used as relative travel distance (Z moves down by this amount, then back up)
        return generatePumpGcode(pumpCtx.pumpHeight);
    }

    return '';
}