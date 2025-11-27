import * as THREE from 'three';
//@ts-ignore
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader';
import { computed } from 'vue';
import { offsetPolygon, isValidPolygon, clipLineToPolygon } from './geometry/clipper-utils';
import { PathAnalysisResult, getPolygonsWithHoles } from './geometry/path-analysis';

// Enum für Füllmuster-Typen
export enum InfillPatternType {
  NONE = 'none',
  LINES = 'lines',
  GRID = 'grid',
  CONCENTRIC = 'concentric',
  ZIGZAG = 'zigzag',
  HONEYCOMB = 'honeycomb',
  // Neue Patterns
  SPIRAL = 'spiral',
  FERMAT_SPIRAL = 'fermat',
  CROSSHATCH = 'crosshatch',
  HILBERT = 'hilbert'
}

// Interface für Dichtebereiche je nach Muster-Typ
export interface DensityRange {
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

// Definiere empfohlene Dichtebereiche für jeden Muster-Typ
export const patternDensityRanges: { [key in InfillPatternType]: DensityRange } = {
  [InfillPatternType.NONE]: { min: 0, max: 10, step: 0.5, defaultValue: 2 },
  [InfillPatternType.LINES]: { min: 0.5, max: 10, step: 0.5, defaultValue: 2 },
  [InfillPatternType.GRID]: { min: 1, max: 20, step: 1, defaultValue: 5 },
  [InfillPatternType.ZIGZAG]: { min: 0.5, max: 15, step: 0.5, defaultValue: 3 },
  [InfillPatternType.HONEYCOMB]: { min: 1, max: 50, step: 1, defaultValue: 10 },
  [InfillPatternType.CONCENTRIC]: { min: 0.5, max: 10, step: 0.5, defaultValue: 2 },
  // Neue Patterns
  [InfillPatternType.SPIRAL]: { min: 1, max: 20, step: 0.5, defaultValue: 3 },
  [InfillPatternType.FERMAT_SPIRAL]: { min: 1, max: 20, step: 0.5, defaultValue: 3 },
  [InfillPatternType.CROSSHATCH]: { min: 0.5, max: 10, step: 0.5, defaultValue: 2 },
  [InfillPatternType.HILBERT]: { min: 1, max: 10, step: 0.5, defaultValue: 3 }
};

// Schnittstelle für Füllmuster-Parameter
export interface InfillOptions {
  patternType: InfillPatternType;
  density: number; // Abstand zwischen Linien in mm (variiert je nach Muster)
  angle: number;   // Winkel in Grad (0 - 180)
  outlineOffset: number; // Abstand zum Rand in mm
}

// Standardwerte für Füllmuster
export const defaultInfillOptions: InfillOptions = {
  patternType: InfillPatternType.LINES,
  density: patternDensityRanges[InfillPatternType.LINES].defaultValue,
  angle: 45,
  outlineOffset: 0.5
};

// Hilfsfunktion: CSS-Farbe zu Hex-String konvertieren
export function cssColorToHex(color: string): string {
    if (!color || color === 'none' || color === 'transparent') {
        return '#000000'; // Default: Schwarz
    }

    // Bereits Hex-Format
    if (color.startsWith('#')) {
        // 3-stelliges Hex zu 6-stelligem erweitern
        if (color.length === 4) {
            return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
        }
        return color.toLowerCase();
    }

    // RGB/RGBA Format
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
        const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
        const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
        const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }

    // Benannte Farben (häufigste)
    const namedColors: { [key: string]: string } = {
        'black': '#000000',
        'white': '#ffffff',
        'red': '#ff0000',
        'green': '#00ff00',
        'lime': '#00ff00',
        'blue': '#0000ff',
        'yellow': '#ffff00',
        'cyan': '#00ffff',
        'magenta': '#ff00ff',
        'orange': '#ffa500',
        'pink': '#ffc0cb',
        'purple': '#800080',
        'gray': '#808080',
        'grey': '#808080'
    };

    const lowerColor = color.toLowerCase();
    if (namedColors[lowerColor]) {
        return namedColors[lowerColor];
    }

    return '#000000'; // Fallback: Schwarz
}

// Funktion zum Extrahieren aller einzigartigen Farben aus SVG-Inhalt
export function extractColorsFromSVG(svgContent: string): string[] {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
    const colors = new Set<string>();

    // Alle Elemente mit stroke-Attribut finden
    const elements = svgDoc.querySelectorAll('[stroke]');
    elements.forEach(el => {
        const stroke = el.getAttribute('stroke');
        if (stroke && stroke !== 'none') {
            colors.add(cssColorToHex(stroke));
        }
    });

    // Auch style-Attribute prüfen
    const styledElements = svgDoc.querySelectorAll('[style]');
    styledElements.forEach(el => {
        const style = el.getAttribute('style') || '';
        const strokeMatch = style.match(/stroke:\s*([^;]+)/);
        if (strokeMatch && strokeMatch[1] !== 'none') {
            colors.add(cssColorToHex(strokeMatch[1].trim()));
        }
    });

    // Falls keine Farben gefunden wurden, Schwarz als Default
    if (colors.size === 0) {
        colors.add('#000000');
    }

    return Array.from(colors);
}

// Interface für Farb-Statistiken
export interface ColorInfo {
    color: string;      // Hex-Farbe z.B. "#ff0000"
    lineCount: number;  // Anzahl der Linien mit dieser Farbe
}

// Funktion zum Analysieren der Farben in einer THREE.Group
export function analyzeColorsInGroup(group: THREE.Group): ColorInfo[] {
    const colorCounts = new Map<string, number>();

    group.children.forEach(child => {
        if (child instanceof THREE.Line) {
            const strokeColor = child.userData?.strokeColor || '#000000';
            const count = colorCounts.get(strokeColor) || 0;
            colorCounts.set(strokeColor, count + 1);
        }
    });

    // Zu Array konvertieren und nach Anzahl sortieren
    const colorInfos: ColorInfo[] = [];
    colorCounts.forEach((count, color) => {
        colorInfos.push({ color, lineCount: count });
    });

    // Nach Linienanzahl absteigend sortieren
    colorInfos.sort((a, b) => b.lineCount - a.lineCount);

    return colorInfos;
}

export function getThreejsObjectFromSvg(svgContent: string, _offsetX: number = 0): Promise<THREE.Group> {
    console.log("--- SVG Analyse Start ---");
    // _offsetX parameter is kept for compatibility but not used anymore
    
    // SVG Metadaten extrahieren (viewBox, width, height, transform)
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
    const svgElement = svgDoc.querySelector('svg');
    
    // Standard-Werte
    let viewBox = {x: 0, y: 0, width: 1000, height: 1000};
    let svgWidth = 1000;
    let svgHeight = 1000;
    let svgTransform = null;
    
    if (svgElement) {
        console.log("SVG Metadaten:");
        const viewBoxAttr = svgElement.getAttribute('viewBox');
        console.log(`viewBox: ${viewBoxAttr}`);
        
        // ViewBox parsen
        if (viewBoxAttr) {
            const viewBoxParts = viewBoxAttr.split(' ').map(Number);
            if (viewBoxParts.length === 4) {
                viewBox = {
                    x: viewBoxParts[0],
                    y: viewBoxParts[1],
                    width: viewBoxParts[2],
                    height: viewBoxParts[3]
                };
            }
        }
        
        // Width und Height parsen
        const widthAttr = svgElement.getAttribute('width');
        const heightAttr = svgElement.getAttribute('height');
        if (widthAttr) svgWidth = parseFloat(widthAttr);
        if (heightAttr) svgHeight = parseFloat(heightAttr);
        
        console.log(`width: ${svgWidth}, height: ${svgHeight}`);
        
        // Transformationen in den Gruppen suchen
        const groupElement = svgDoc.querySelector('g');
        if (groupElement) {
            svgTransform = groupElement.getAttribute('transform');
            console.log(`Group transform: ${svgTransform}`);
        }
    }
    
    const loader = new SVGLoader();
    const svg = loader.parse(svgContent);
    
    console.log("SVG Loader Infos:");
    console.log(`SVG Paths gefunden: ${svg.paths.length}`);
    
    const paths: THREE.ShapePath[] = svg.paths;
    
    // Erstelle Gruppe für ThreeJS-Objekte
    const group = new THREE.Group();
    
    paths.forEach((shapePath) => {
        // Extrahiere die stroke-Farbe aus den SVG-Daten
        // SVGLoader speichert Style-Infos in userData.style
        //@ts-ignore
        const style = shapePath.userData?.style || {};
        const strokeColor = style.stroke;

        // Konvertiere die Farbe zu Hex
        const hexColor = cssColorToHex(strokeColor);
        const threeColor = new THREE.Color(hexColor);

        const material = new THREE.LineBasicMaterial({
            color: threeColor,
        });

        shapePath.subPaths.forEach((subPath: any) => {
            // Get points from the subPath
            const points: THREE.Vector2[] = subPath.getPoints();

            // Create a geometry from the points
            const geometry = new THREE.BufferGeometry().setFromPoints(points);

            // Create a line from the geometry and material
            const line = new THREE.Line(geometry, material);
            //@ts-ignore
            line.userData = { ...shapePath.userData };
            // Speichere die Original-Stroke-Farbe für spätere Verwendung
            line.userData.strokeColor = hexColor;
            
            if (subPath.curves.length > 1) {
                const isClosed = computed(() => {
                    if (subPath.autoClose) {
                        return true;
                    }
                    if (subPath.curves[0].v1.x === subPath.curves[subPath.curves.length - 1].v2.x && 
                        subPath.curves[0].v1.y === subPath.curves[subPath.curves.length - 1].v2.y) {
                        return true;
                    }
                    return false;
                });
                //@ts-ignore
                line.userData.isClosed = isClosed.value;
            }
            
            group.add(line);
        });
    });
    
    // Transformationen aus SVG extrahieren und anwenden
    if (svgTransform) {
        // Matrix-Transformation parsen (z.B. "matrix(0.5884,0,0,0.5884,30085.351,21950.855)")
        const matrixMatch = svgTransform.match(/matrix\(([\d.-]+),([\d.-]+),([\d.-]+),([\d.-]+),([\d.-]+),([\d.-]+)\)/);
        if (matrixMatch) {
            const a = parseFloat(matrixMatch[1]); // Skalierung X
            const b = parseFloat(matrixMatch[2]); // Schub Y
            const c = parseFloat(matrixMatch[3]); // Schub X
            const d = parseFloat(matrixMatch[4]); // Skalierung Y
            const e = parseFloat(matrixMatch[5]); // Translation X
            const f = parseFloat(matrixMatch[6]); // Translation Y
            
            console.log(`Matrix Transformation: Skalierung(${a}, ${d}), Translation(${e}, ${f})`);
            
            // Auf alle Linien anwenden
            group.children.forEach(child => {
                if (child instanceof THREE.Line) {
                    const positions = child.geometry.attributes.position.array;
                    for (let i = 0; i < positions.length; i += 3) {
                        // Anwenden der Transformation aus der SVG
                        // Zuerst die Viewbox-Offset berücksichtigen
                        let x = positions[i] - viewBox.x;
                        let y = positions[i + 1] - viewBox.y;
                        
                        // Dann die Matrix-Transformation anwenden
                        positions[i] = (a * x + c * y + e);
                        positions[i + 1] = (b * x + d * y + f);
                    }
                    child.geometry.attributes.position.needsUpdate = true;
                }
            });
        }
    } else {
        // Falls keine Transformation in der SVG gefunden wurde, 
        // nur ViewBox-Offset berücksichtigen
        group.children.forEach(child => {
            if (child instanceof THREE.Line) {
                const positions = child.geometry.attributes.position.array;
                for (let i = 0; i < positions.length; i += 3) {
                    positions[i] -= viewBox.x;
                    positions[i + 1] -= viewBox.y;
                }
                child.geometry.attributes.position.needsUpdate = true;
            }
        });
    }
    
    // Ermittle die Abmessungen der transformierten Gruppe
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    group.children.forEach((child) => {
        if (child instanceof THREE.Line) {
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
    
    console.log("Finale ThreeJS-Gruppe Abmessungen:");
    console.log(`X: Min=${minX.toFixed(2)}, Max=${maxX.toFixed(2)}, Breite=${(maxX - minX).toFixed(2)}`);
    console.log(`Y: Min=${minY.toFixed(2)}, Max=${maxY.toFixed(2)}, Höhe=${(maxY - minY).toFixed(2)}`);
    
    // Store the dimensions in userData for reference
    group.userData = { ...group.userData, minX, maxX, minY, maxY };
    
    console.log("--- SVG Analyse Ende ---");

    return Promise.resolve(group);
}

// Funktion zum Generieren von Fülllinien für geschlossene Pfade
export function generateInfillForGroup(group: THREE.Group, options: InfillOptions): THREE.Group {
    // Gruppe für Fülllinien erstellen
    const infillGroup = new THREE.Group();
    infillGroup.name = "InfillGroup";
    
    // Wenn kein Infill gewünscht ist, leere Gruppe zurückgeben
    if (options.patternType === InfillPatternType.NONE) {
        console.log("Kein Infill-Muster ausgewählt");
        return infillGroup;
    }
    
    // Finde alle geschlossenen Pfade
    const closedPaths: THREE.Line[] = [];
    
    group.children.forEach((child) => {
        if (child instanceof THREE.Line && child.userData && child.userData.isClosed) {
            closedPaths.push(child);
            console.log(`Geschlossener Pfad gefunden mit ${child.geometry.attributes.position.count} Punkten`);
        }
    });
    
    console.log(`Geschlossene Pfade gefunden: ${closedPaths.length}`);
    
    // Wenn keine Pfade gefunden wurden, leere Gruppe zurückgeben
    if (closedPaths.length === 0) {
        console.warn("Keine geschlossenen Pfade für Infill gefunden");
        return infillGroup;
    }
    
    // Generiere Fülllinien für jeden geschlossenen Pfad
    closedPaths.forEach((path, index) => {
        console.log(`Generiere Infill für Pfad ${index}`);
        
        // Extraktion der Pfadpunkte
        const points = extractPathPoints(path);
        console.log(`Extrahierte Punkte: ${points.length}`);
        
        if (points.length < 3) {
            console.warn(`Zu wenig Punkte für Pfad ${index}: ${points.length}`);
            return; // Skip this path
        }
        
        // Berechne Bounding Box
        const bounds = calculateBounds(points);
        console.log(`Bounding Box: X(${bounds.minX.toFixed(2)}, ${bounds.maxX.toFixed(2)}), Y(${bounds.minY.toFixed(2)}, ${bounds.maxY.toFixed(2)})`);
        
        // Generiere Infill basierend auf dem gewählten Muster
        let infillLines: THREE.Line[] = [];
        
        try {
            switch (options.patternType) {
                case InfillPatternType.LINES:
                    infillLines = generateLineInfill(points, bounds, options);
                    break;
                case InfillPatternType.GRID:
                    const linesA = generateLineInfill(points, bounds, { ...options, angle: 0 });
                    const linesB = generateLineInfill(points, bounds, { ...options, angle: 90 });
                    infillLines = [...linesA, ...linesB];
                    break;
                case InfillPatternType.ZIGZAG:
                    infillLines = generateZigzagInfill(points, bounds, options);
                    break;
                case InfillPatternType.HONEYCOMB:
                    infillLines = generateHoneycombInfill(points, bounds, options);
                    break;
                case InfillPatternType.CONCENTRIC:
                    infillLines = generateConcentricInfill(points, bounds, options);
                    break;
                case InfillPatternType.SPIRAL:
                    infillLines = generateSpiralInfill(points, bounds, options);
                    break;
                case InfillPatternType.FERMAT_SPIRAL:
                    infillLines = generateFermatSpiralInfill(points, bounds, options);
                    break;
                case InfillPatternType.CROSSHATCH:
                    const crossA = generateLineInfill(points, bounds, { ...options, angle: options.angle });
                    const crossB = generateLineInfill(points, bounds, { ...options, angle: options.angle + 45 });
                    infillLines = [...crossA, ...crossB];
                    break;
                case InfillPatternType.HILBERT:
                    infillLines = generateHilbertInfill(points, bounds, options);
                    break;
                default:
                    console.warn(`Unbekannter Infill-Typ: ${options.patternType}`);
                    break;
            }
        } catch (error) {
            console.error(`Fehler bei der Infill-Generierung für Pfad ${index}:`, error);
        }
        
        // Benenne die Linien und füge sie zur Gruppe hinzu
        infillLines.forEach((line, lineIndex) => {
            line.name = `Infill_Path${index}_Line${lineIndex}`;
            (line.material as THREE.LineBasicMaterial).color = new THREE.Color(0x4287f5);
            infillGroup.add(line);
        });
        
        console.log(`${infillLines.length} Infill-Linien generiert für Pfad ${index}`);
    });
    
    return infillGroup;
}

/**
 * Generiert Infill mit Hole-Clipping basierend auf PathAnalysis
 *
 * Diese Funktion verwendet die Path-Analyse um:
 * - Outer Paths korrekt zu füllen
 * - Holes (innere Löcher) auszusparen
 * - Nested Objects separat zu füllen
 */
export function generateInfillWithHoles(
    _group: THREE.Group,
    options: InfillOptions,
    pathAnalysis: PathAnalysisResult
): THREE.Group {
    const infillGroup = new THREE.Group();
    infillGroup.name = "InfillGroupWithHoles";

    if (options.patternType === InfillPatternType.NONE) {
        return infillGroup;
    }

    // Hole die Polygone mit ihren Holes
    const polygonsWithHoles = getPolygonsWithHoles(pathAnalysis);

    console.log(`Generiere Infill für ${polygonsWithHoles.length} Polygone mit Hole-Detection`);

    polygonsWithHoles.forEach((item, index) => {
        const { outer, holes } = item;

        console.log(`Polygon ${index}: ${outer.length} Punkte, ${holes.length} Holes`);

        if (outer.length < 3) {
            console.warn(`Zu wenig Punkte für Polygon ${index}`);
            return;
        }

        const bounds = calculateBounds(outer);
        let infillLines: THREE.Line[] = [];

        try {
            // Generiere Basis-Infill
            switch (options.patternType) {
                case InfillPatternType.LINES:
                    infillLines = generateLineInfill(outer, bounds, options);
                    break;
                case InfillPatternType.GRID:
                    const gridA = generateLineInfill(outer, bounds, { ...options, angle: 0 });
                    const gridB = generateLineInfill(outer, bounds, { ...options, angle: 90 });
                    infillLines = [...gridA, ...gridB];
                    break;
                case InfillPatternType.ZIGZAG:
                    infillLines = generateZigzagInfill(outer, bounds, options);
                    break;
                case InfillPatternType.HONEYCOMB:
                    infillLines = generateHoneycombInfill(outer, bounds, options);
                    break;
                case InfillPatternType.CONCENTRIC:
                    infillLines = generateConcentricInfill(outer, bounds, options);
                    break;
                case InfillPatternType.SPIRAL:
                    infillLines = generateSpiralInfill(outer, bounds, options);
                    break;
                case InfillPatternType.FERMAT_SPIRAL:
                    infillLines = generateFermatSpiralInfill(outer, bounds, options);
                    break;
                case InfillPatternType.CROSSHATCH:
                    const crossA = generateLineInfill(outer, bounds, { ...options, angle: options.angle });
                    const crossB = generateLineInfill(outer, bounds, { ...options, angle: options.angle + 45 });
                    infillLines = [...crossA, ...crossB];
                    break;
                case InfillPatternType.HILBERT:
                    infillLines = generateHilbertInfill(outer, bounds, options);
                    break;
            }

            // Wenn Holes vorhanden sind, müssen wir die Linien clippen
            if (holes.length > 0) {
                infillLines = clipInfillLinesToHoles(infillLines, holes);
            }

        } catch (error) {
            console.error(`Fehler bei der Infill-Generierung für Polygon ${index}:`, error);
        }

        // Füge Linien zur Gruppe hinzu
        infillLines.forEach((line, lineIndex) => {
            line.name = `Infill_Poly${index}_Line${lineIndex}`;
            (line.material as THREE.LineBasicMaterial).color = new THREE.Color(0x4287f5);
            infillGroup.add(line);
        });

        console.log(`${infillLines.length} Infill-Linien generiert für Polygon ${index}`);
    });

    return infillGroup;
}

/**
 * Clippt Infill-Linien um Holes herum
 *
 * Für jede Linie:
 * - Prüfe ob sie durch ein Hole geht
 * - Wenn ja, schneide sie an den Hole-Grenzen
 * - Behalte nur die Teile außerhalb der Holes
 */
function clipInfillLinesToHoles(
    lines: THREE.Line[],
    holes: THREE.Vector2[][]
): THREE.Line[] {
    const clippedLines: THREE.Line[] = [];

    for (const line of lines) {
        const positions = line.geometry.attributes.position.array;

        // Extrahiere alle Punkte der Linie (kann Polyline sein)
        const linePoints: THREE.Vector2[] = [];
        for (let i = 0; i < positions.length; i += 3) {
            linePoints.push(new THREE.Vector2(positions[i], positions[i + 1]));
        }

        // Für jedes Segment der Linie
        for (let i = 0; i < linePoints.length - 1; i++) {
            const start = linePoints[i];
            const end = linePoints[i + 1];

            // Starte mit dem vollen Segment
            let segments: { start: THREE.Vector2; end: THREE.Vector2 }[] = [
                { start: start.clone(), end: end.clone() }
            ];

            // Für jedes Hole, schneide die Segmente
            for (const hole of holes) {
                const newSegments: { start: THREE.Vector2; end: THREE.Vector2 }[] = [];

                for (const segment of segments) {
                    // Prüfe ob das Segment durch das Hole geht
                    const startInHole = isPointInPolygon(segment.start, hole);
                    const endInHole = isPointInPolygon(segment.end, hole);

                    if (startInHole && endInHole) {
                        // Segment ist vollständig im Hole - entfernen
                        continue;
                    }

                    if (!startInHole && !endInHole) {
                        // Prüfe ob das Segment das Hole kreuzt
                        const clipped = clipLineToPolygon(segment.start, segment.end, hole);

                        if (clipped.length === 0) {
                            // Segment ist außerhalb des Holes - behalten
                            newSegments.push(segment);
                        } else {
                            // Segment kreuzt das Hole - split
                            // Behalte nur die Teile außerhalb
                            const intersections: THREE.Vector2[] = [];
                            for (const c of clipped) {
                                intersections.push(c.start, c.end);
                            }

                            // Sortiere nach Distanz vom Start
                            intersections.sort((a, b) =>
                                a.distanceToSquared(segment.start) - b.distanceToSquared(segment.start)
                            );

                            // Erstelle Segmente außerhalb
                            let currentPoint = segment.start.clone();
                            for (let j = 0; j < intersections.length; j += 2) {
                                const enterHole = intersections[j];

                                // Segment vor dem Hole-Eintritt
                                if (currentPoint.distanceTo(enterHole) > 0.01) {
                                    newSegments.push({
                                        start: currentPoint,
                                        end: enterHole.clone()
                                    });
                                }

                                // Springe zum Hole-Austritt
                                if (j + 1 < intersections.length) {
                                    currentPoint = intersections[j + 1].clone();
                                }
                            }

                            // Letztes Segment nach dem Hole
                            if (currentPoint.distanceTo(segment.end) > 0.01) {
                                newSegments.push({
                                    start: currentPoint,
                                    end: segment.end.clone()
                                });
                            }
                        }
                    } else {
                        // Ein Ende im Hole, eines außen
                        const clipped = clipLineToPolygon(segment.start, segment.end, hole);

                        if (startInHole && clipped.length > 0) {
                            // Start ist im Hole, behalte Teil nach dem Hole
                            newSegments.push({
                                start: clipped[0].end.clone(),
                                end: segment.end.clone()
                            });
                        } else if (endInHole && clipped.length > 0) {
                            // Ende ist im Hole, behalte Teil vor dem Hole
                            newSegments.push({
                                start: segment.start.clone(),
                                end: clipped[0].start.clone()
                            });
                        }
                    }
                }

                segments = newSegments;
            }

            // Erstelle THREE.Line für jedes verbleibende Segment
            for (const segment of segments) {
                if (segment.start.distanceTo(segment.end) > 0.01) {
                    const geometry = new THREE.BufferGeometry().setFromPoints([
                        new THREE.Vector3(segment.start.x, segment.start.y, 0),
                        new THREE.Vector3(segment.end.x, segment.end.y, 0)
                    ]);
                    const material = new THREE.LineBasicMaterial({
                        color: (line.material as THREE.LineBasicMaterial).color
                    });
                    clippedLines.push(new THREE.Line(geometry, material));
                }
            }
        }
    }

    console.log(`Hole-Clipping: ${lines.length} Linien → ${clippedLines.length} geclippte Segmente`);
    return clippedLines;
}

// Extraktion der Pfadpunkte aus einer THREE.Line
function extractPathPoints(path: THREE.Line): THREE.Vector2[] {
    const positions = path.geometry.attributes.position.array;
    const points: THREE.Vector2[] = [];
    
    for (let i = 0; i < positions.length; i += 3) {
        points.push(new THREE.Vector2(positions[i], positions[i + 1]));
    }
    
    return points;
}

// Berechne die Grenzen eines Polygons
function calculateBounds(points: THREE.Vector2[]): { minX: number, maxX: number, minY: number, maxY: number } {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    points.forEach(p => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
    });
    
    return { minX, maxX, minY, maxY };
}

// Generiert ein Linienmuster für Infill
function generateLineInfill(
    polygon: THREE.Vector2[], 
    bounds: { minX: number, maxX: number, minY: number, maxY: number },
    options: InfillOptions
): THREE.Line[] {
    const infillLines: THREE.Line[] = [];
    
    // Berechne den Winkel in Radian
    const angleRad = options.angle * Math.PI / 180;
    
    // Berechne den Richtungsvektor
    const dir = new THREE.Vector2(Math.cos(angleRad), Math.sin(angleRad));
    
    // Berechne den Normalenvektor (senkrecht zum Richtungsvektor)
    const normal = new THREE.Vector2(-dir.y, dir.x);
    
    // Berechne die Breite und Höhe des Bereichs
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    
    // Berechne die diagonale Länge für die maximale Linienlänge
    const diagonal = Math.sqrt(width * width + height * height);
    
    // Berechne die Anzahl der Linien basierend auf der Dichte
    const center = new THREE.Vector2(
        (bounds.minX + bounds.maxX) / 2,
        (bounds.minY + bounds.maxY) / 2
    );
    
    // Berechne den Projektionsbereich für die Linien
    let projMin = Infinity;
    let projMax = -Infinity;
    
    // Projiziere alle Punkte auf die Normale
    polygon.forEach(p => {
        const relX = p.x - center.x;
        const relY = p.y - center.y;
        const proj = relX * normal.x + relY * normal.y;
        projMin = Math.min(projMin, proj);
        projMax = Math.max(projMax, proj);
    });
    
    // Berechne die Anzahl der Linien
    const projLength = projMax - projMin;
    const numLines = Math.ceil(projLength / options.density);
    
    // Sicherheitsprüfung
    if (numLines <= 0 || numLines > 1000) {
        console.warn(`Ungültige Anzahl von Linien: ${numLines}`);
        return infillLines;
    }
    
    console.log(`Erzeuge ${numLines} Linien mit Winkel ${options.angle}° und Abstand ${options.density}`);
    
    // Erstelle Linien
    for (let i = 0; i <= numLines; i++) {
        // Berechne den Versatz von der Mitte
        const t = i / numLines;
        const offset = projMin + t * projLength;
        
        // Berechne den Startpunkt der Linie relativ zur Mitte
        const lineCenter = new THREE.Vector2(
            center.x + normal.x * offset,
            center.y + normal.y * offset
        );
        
        // Erstelle eine Linie, die durch diesen Punkt in Richtung des Winkels verläuft
        const lineStart = new THREE.Vector2(
            lineCenter.x - dir.x * diagonal,
            lineCenter.y - dir.y * diagonal
        );
        
        const lineEnd = new THREE.Vector2(
            lineCenter.x + dir.x * diagonal,
            lineCenter.y + dir.y * diagonal
        );
        
        // Finde die Schnittpunkte mit dem Polygon
        const intersections = findPolygonIntersections(polygon, lineStart, lineEnd);
        
        // Wenn es mindestens 2 Schnittpunkte gibt, erstelle die Linien
        if (intersections.length >= 2) {
            // Sortiere die Schnittpunkte entlang der Linie
            intersections.sort((a, b) => {
                const dax = a.x - lineStart.x;
                const day = a.y - lineStart.y;
                const dbx = b.x - lineStart.x;
                const dby = b.y - lineStart.y;
                return (dax * dir.x + day * dir.y) - (dbx * dir.x + dby * dir.y);
            });
            
            // Erstelle Linien zwischen aufeinanderfolgenden Schnittpunkten
            for (let j = 0; j < intersections.length - 1; j += 2) {
                const p1 = intersections[j];
                const p2 = intersections[j + 1];
                
                if (p1 && p2) {
                    // Erstelle eine THREE.Line zwischen den beiden Punkten
                    const geometry = new THREE.BufferGeometry().setFromPoints([
                        new THREE.Vector3(p1.x, p1.y, 0),
                        new THREE.Vector3(p2.x, p2.y, 0)
                    ]);
                    
                    const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
                    const line = new THREE.Line(geometry, material);
                    
                    infillLines.push(line);
                }
            }
        }
    }
    
    console.log(`${infillLines.length} Infill-Linien generiert`);
    return infillLines;
}

// Finde alle Schnittpunkte einer Linie mit einem Polygon
function findPolygonIntersections(
    polygon: THREE.Vector2[],
    lineStart: THREE.Vector2,
    lineEnd: THREE.Vector2
): THREE.Vector2[] {
    const intersections: THREE.Vector2[] = [];
    
    // Prüfe jeden Abschnitt des Polygons
    for (let i = 0; i < polygon.length; i++) {
        const p1 = polygon[i];
        const p2 = polygon[(i + 1) % polygon.length];
        
        const intersection = lineLineIntersection(lineStart, lineEnd, p1, p2);
        if (intersection) {
            intersections.push(intersection);
        }
    }
    
    return intersections;
}

// Berechne den Schnittpunkt zweier Linien
function lineLineIntersection(
    p1: THREE.Vector2, p2: THREE.Vector2,
    p3: THREE.Vector2, p4: THREE.Vector2
): THREE.Vector2 | null {
    // Richtungsvektoren
    const dx1 = p2.x - p1.x;
    const dy1 = p2.y - p1.y;
    const dx2 = p4.x - p3.x;
    const dy2 = p4.y - p3.y;
    
    // Determinante
    const det = dx1 * dy2 - dy1 * dx2;
    
    // Wenn Determinante 0 ist, sind die Linien parallel
    if (Math.abs(det) < 1e-10) return null;
    
    // Parameter entlang der jeweiligen Linien
    const t1 = ((p3.x - p1.x) * dy2 - (p3.y - p1.y) * dx2) / det;
    const t2 = ((p3.x - p1.x) * dy1 - (p3.y - p1.y) * dx1) / det;
    
    // Überprüfe, ob der Schnittpunkt auf beiden Liniensegmenten liegt
    if (t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1) {
        return new THREE.Vector2(
            p1.x + t1 * dx1,
            p1.y + t1 * dy1
        );
    }
    
    return null;
}

/**
 * Generiere ein Zickzack-Muster
 * - 3-Phasen-Algorithmus: Sammeln → Sortieren/Umkehren → Zeichnen
 * - Korrekte Verbindungslogik für durchgehenden Pfad
 */
function generateZigzagInfill(
    polygon: THREE.Vector2[],
    bounds: { minX: number, maxX: number, minY: number, maxY: number },
    options: InfillOptions
): THREE.Line[] {
    const infillLines: THREE.Line[] = [];

    // Berechne den Winkel in Radian
    const angleRad = options.angle * Math.PI / 180;

    // Berechne den Richtungsvektor
    const dir = new THREE.Vector2(Math.cos(angleRad), Math.sin(angleRad));

    // Berechne den Normalenvektor (senkrecht zum Richtungsvektor)
    const normal = new THREE.Vector2(-dir.y, dir.x);

    // Berechne die Breite und Höhe des Bereichs
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;

    // Berechne die diagonale Länge für die maximale Linienlänge
    const diagonal = Math.sqrt(width * width + height * height);

    // Berechne die Anzahl der Linien basierend auf der Dichte
    const center = new THREE.Vector2(
        (bounds.minX + bounds.maxX) / 2,
        (bounds.minY + bounds.maxY) / 2
    );

    // Berechne den Projektionsbereich für die Linien
    let projMin = Infinity;
    let projMax = -Infinity;

    // Projiziere alle Punkte auf die Normale
    polygon.forEach(p => {
        const relX = p.x - center.x;
        const relY = p.y - center.y;
        const proj = relX * normal.x + relY * normal.y;
        projMin = Math.min(projMin, proj);
        projMax = Math.max(projMax, proj);
    });

    // Berechne die Anzahl der Linien
    const projLength = projMax - projMin;
    const numLines = Math.ceil(projLength / options.density);

    // Sicherheitsprüfung
    if (numLines <= 0 || numLines > 1000) {
        console.warn(`Ungültige Anzahl von Linien: ${numLines}`);
        return infillLines;
    }

    console.log(`Erzeuge ${numLines} Zickzack-Linien mit Winkel ${options.angle}° und Abstand ${options.density}`);

    // ========================================================================
    // PHASE 1: Alle Segments sammeln (ohne zu zeichnen!)
    // ========================================================================
    type LineSegment = { start: THREE.Vector2, end: THREE.Vector2 };
    const segments: LineSegment[] = [];

    for (let i = 0; i <= numLines; i++) {
        const t = i / numLines;
        const offset = projMin + t * projLength;

        const lineCenter = new THREE.Vector2(
            center.x + normal.x * offset,
            center.y + normal.y * offset
        );

        const lineStart = new THREE.Vector2(
            lineCenter.x - dir.x * diagonal,
            lineCenter.y - dir.y * diagonal
        );

        const lineEnd = new THREE.Vector2(
            lineCenter.x + dir.x * diagonal,
            lineCenter.y + dir.y * diagonal
        );

        const intersections = findPolygonIntersections(polygon, lineStart, lineEnd);

        if (intersections.length >= 2) {
            intersections.sort((a, b) => {
                const dax = a.x - lineStart.x;
                const day = a.y - lineStart.y;
                const dbx = b.x - lineStart.x;
                const dby = b.y - lineStart.y;
                return (dax * dir.x + day * dir.y) - (dbx * dir.x + dby * dir.y);
            });

            for (let j = 0; j < intersections.length; j += 2) {
                if (j + 1 < intersections.length) {
                    segments.push({
                        start: intersections[j].clone(),
                        end: intersections[j + 1].clone()
                    });
                }
            }
        }
    }

    if (segments.length === 0) {
        console.warn("Keine gültigen Liniensegmente für Zickzack-Muster gefunden");
        return infillLines;
    }

    // ========================================================================
    // PHASE 2: Sortieren und alternierend umkehren (VOR dem Zeichnen!)
    // ========================================================================

    // Sortiere nach Projektion auf die Normale
    segments.sort((a, b) => {
        const aMid = new THREE.Vector2(
            (a.start.x + a.end.x) / 2 - center.x,
            (a.start.y + a.end.y) / 2 - center.y
        );
        const bMid = new THREE.Vector2(
            (b.start.x + b.end.x) / 2 - center.x,
            (b.start.y + b.end.y) / 2 - center.y
        );
        const aProj = aMid.x * normal.x + aMid.y * normal.y;
        const bProj = bMid.x * normal.x + bMid.y * normal.y;
        return aProj - bProj;
    });

    // Kehre jedes zweite Segment um für korrektes Zickzack
    for (let i = 0; i < segments.length; i++) {
        if (i % 2 === 1) {
            const temp = segments[i].start;
            segments[i].start = segments[i].end;
            segments[i].end = temp;
        }
    }

    // ========================================================================
    // PHASE 3: Zeichnen und verbinden
    // ========================================================================
    const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });

    for (let i = 0; i < segments.length; i++) {
        // Zeichne das Segment
        const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(segments[i].start.x, segments[i].start.y, 0),
            new THREE.Vector3(segments[i].end.x, segments[i].end.y, 0)
        ]);
        infillLines.push(new THREE.Line(geometry, material.clone()));

        // Verbinde mit dem nächsten Segment
        if (i < segments.length - 1) {
            const connectStart = segments[i].end;
            const connectEnd = segments[i + 1].start;

            // Prüfe ob die Verbindung im Polygon liegt
            if (isLineInsidePolygon(connectStart, connectEnd, polygon)) {
                const connGeometry = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(connectStart.x, connectStart.y, 0),
                    new THREE.Vector3(connectEnd.x, connectEnd.y, 0)
                ]);
                infillLines.push(new THREE.Line(connGeometry, material.clone()));
            }
        }
    }

    console.log(`${infillLines.length} Zickzack-Linien und Verbindungen generiert`);
    return infillLines;
}

// Hilfsfunktion: Prüft, ob eine Linie innerhalb eines Polygons liegt
function isLineInsidePolygon(start: THREE.Vector2, end: THREE.Vector2, polygon: THREE.Vector2[]): boolean {
    // Eine einfache Methode ist, die Mittelpunkte mehrerer Punkte entlang der Linie zu prüfen
    const numPoints = 10; // Anzahl der zu prüfenden Punkte
    
    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const x = start.x + t * (end.x - start.x);
        const y = start.y + t * (end.y - start.y);
        
        if (!isPointInPolygon(new THREE.Vector2(x, y), polygon)) {
            return false;
        }
    }
    
    return true;
}

/**
 * Generiere ein Honigwaben-Muster (Hexagons)
 * - Korrekter Stagger-Offset (0.5 statt 0.375)
 * - Unterstützt Angle-Parameter durch Rotation
 * - Echtes Line-Clipping am Polygon-Rand
 */
function generateHoneycombInfill(
    polygon: THREE.Vector2[],
    bounds: { minX: number, maxX: number, minY: number, maxY: number },
    options: InfillOptions
): THREE.Line[] {
    const infillLines: THREE.Line[] = [];

    // Berechne die Seitenlänge des Hexagons basierend auf der Dichte
    // Direkte Zuordnung: density = Abstand zwischen Hexagon-Zentren
    const hexSize = options.density;

    // Die Höhe eines Hexagons ist sqrt(3) * Seitenlänge
    const hexHeight = Math.sqrt(3) * hexSize;
    // Die Breite eines Hexagons ist 2 * Seitenlänge
    const hexWidth = 2 * hexSize;

    // Rotation für Angle-Support
    const angleRad = options.angle * Math.PI / 180;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    // Rotations-Hilfsfunktion
    const rotatePoint = (x: number, y: number): THREE.Vector2 => {
        if (angleRad === 0) return new THREE.Vector2(x, y);
        const dx = x - centerX;
        const dy = y - centerY;
        return new THREE.Vector2(
            centerX + dx * Math.cos(angleRad) - dy * Math.sin(angleRad),
            centerY + dx * Math.sin(angleRad) + dy * Math.cos(angleRad)
        );
    };

    // Erweitere Bounds für Rotation
    const diagonal = Math.sqrt(Math.pow(bounds.maxX - bounds.minX, 2) + Math.pow(bounds.maxY - bounds.minY, 2));
    const extendedBounds = {
        minX: centerX - diagonal / 2 - hexWidth,
        maxX: centerX + diagonal / 2 + hexWidth,
        minY: centerY - diagonal / 2 - hexHeight,
        maxY: centerY + diagonal / 2 + hexHeight
    };

    // Berechne die Anzahl der Hexagons
    const numCols = Math.ceil((extendedBounds.maxX - extendedBounds.minX) / (hexWidth * 0.75)) + 2;
    const numRows = Math.ceil((extendedBounds.maxY - extendedBounds.minY) / hexHeight) + 2;

    // Startpunkt
    const startX = extendedBounds.minX;
    const startY = extendedBounds.minY;

    console.log(`Erzeuge Honigwaben-Muster mit ${numRows}x${numCols}, Hexagongröße: ${hexSize}, Winkel: ${options.angle}°`);

    // Erstelle das Honigwaben-Muster
    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            // Bestimme die Mitte des aktuellen Hexagons
            // KORRIGIERT: 0.5 statt 0.375 für korrekten Honeycomb-Stagger
            const rawCenterX = startX + col * (hexWidth * 0.75) + (row % 2 === 0 ? 0 : hexWidth * 0.5);
            const rawCenterY = startY + row * hexHeight * 0.5;

            // Erstelle die 6 Punkte des Hexagons (flat-top orientation)
            const hexPoints: THREE.Vector2[] = [];
            for (let i = 0; i < 6; i++) {
                // Start bei 30° für flat-top Hexagon
                const angle = (Math.PI / 3) * i + Math.PI / 6;
                const x = rawCenterX + hexSize * Math.cos(angle);
                const y = rawCenterY + hexSize * Math.sin(angle);
                // Rotiere den Punkt
                hexPoints.push(rotatePoint(x, y));
            }

            // Zeichne jedes Segment des Hexagons mit echtem Clipping
            for (let i = 0; i < 6; i++) {
                const p1 = hexPoints[i];
                const p2 = hexPoints[(i + 1) % 6];

                // Clippe das Segment am Polygon
                const clippedSegments = clipLineToPolygonSimple(p1, p2, polygon);

                for (const seg of clippedSegments) {
                    const geometry = new THREE.BufferGeometry().setFromPoints([
                        new THREE.Vector3(seg.start.x, seg.start.y, 0),
                        new THREE.Vector3(seg.end.x, seg.end.y, 0)
                    ]);

                    const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
                    const line = new THREE.Line(geometry, material);
                    infillLines.push(line);
                }
            }
        }
    }

    console.log(`${infillLines.length} Honigwaben-Liniensegmente generiert`);
    return infillLines;
}

/**
 * Einfaches Line-Clipping an Polygon-Grenze
 * Gibt alle Segmente zurück, die innerhalb des Polygons liegen
 */
function clipLineToPolygonSimple(
    lineStart: THREE.Vector2,
    lineEnd: THREE.Vector2,
    polygon: THREE.Vector2[]
): { start: THREE.Vector2; end: THREE.Vector2 }[] {
    const segments: { start: THREE.Vector2; end: THREE.Vector2 }[] = [];

    const startInside = isPointInPolygon(lineStart, polygon);
    const endInside = isPointInPolygon(lineEnd, polygon);

    // Beide Punkte innen → ganzes Segment
    if (startInside && endInside) {
        return [{ start: lineStart.clone(), end: lineEnd.clone() }];
    }

    // Finde alle Schnittpunkte mit dem Polygon
    const intersections: THREE.Vector2[] = [];
    for (let i = 0; i < polygon.length; i++) {
        const polyP1 = polygon[i];
        const polyP2 = polygon[(i + 1) % polygon.length];
        const intersection = lineLineIntersection(lineStart, lineEnd, polyP1, polyP2);
        if (intersection) {
            intersections.push(intersection);
        }
    }

    if (intersections.length === 0) {
        // Kein Schnittpunkt und nicht beide innen → außerhalb
        return [];
    }

    // Sortiere Schnittpunkte entlang der Linie
    const dir = new THREE.Vector2().subVectors(lineEnd, lineStart);
    intersections.sort((a, b) => {
        const ta = new THREE.Vector2().subVectors(a, lineStart).dot(dir);
        const tb = new THREE.Vector2().subVectors(b, lineStart).dot(dir);
        return ta - tb;
    });

    // Erstelle Segmente zwischen Schnittpunkten
    const allPoints: THREE.Vector2[] = [];
    if (startInside) allPoints.push(lineStart.clone());
    allPoints.push(...intersections);
    if (endInside) allPoints.push(lineEnd.clone());

    // Gehe durch Punktpaare und prüfe ob Segment innen ist
    for (let i = 0; i < allPoints.length - 1; i++) {
        const midpoint = new THREE.Vector2(
            (allPoints[i].x + allPoints[i + 1].x) / 2,
            (allPoints[i].y + allPoints[i + 1].y) / 2
        );
        if (isPointInPolygon(midpoint, polygon)) {
            segments.push({ start: allPoints[i], end: allPoints[i + 1] });
        }
    }

    return segments;
}

/**
 * Generiere ein konzentrisches Muster mit ClipperOffset
 * - Robustes Inward-Offsetting für alle Polygon-Formen
 * - Automatische Handhabung von Polygon-Kollaps
 * - Funktioniert auch für konkave und komplexe Formen
 */
function generateConcentricInfill(
    polygon: THREE.Vector2[],
    _bounds: { minX: number, maxX: number, minY: number, maxY: number },
    options: InfillOptions
): THREE.Line[] {
    const infillLines: THREE.Line[] = [];
    const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });

    // Generiere konzentrische Ringe mit ClipperOffset
    let currentPolygons = [polygon];
    const offsetAmount = -options.density; // Negativ für Inward-Offset
    const maxRings = 200; // Sicherheitslimit
    let ringCount = 0;

    while (currentPolygons.length > 0 && ringCount < maxRings) {
        const nextPolygons: THREE.Vector2[][] = [];

        for (const poly of currentPolygons) {
            // Offset nach innen
            const offsetResults = offsetPolygon(poly, offsetAmount, 'miter');

            for (const offsetPoly of offsetResults) {
                // Prüfe ob das Polygon noch gültig ist
                if (offsetPoly.length >= 3 && isValidPolygon(offsetPoly, 0.5)) {
                    // Erstelle Line für diesen Ring
                    const points = offsetPoly.map(p => new THREE.Vector3(p.x, p.y, 0));
                    // Schließe den Ring
                    points.push(points[0].clone());

                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    const line = new THREE.Line(geometry, material.clone());
                    line.name = `Infill_Concentric_${ringCount}`;
                    infillLines.push(line);

                    nextPolygons.push(offsetPoly);
                    ringCount++;
                }
            }
        }

        currentPolygons = nextPolygons;
    }

    console.log(`${infillLines.length} konzentrische Linien generiert (ClipperOffset)`);
    return infillLines;
}

export function createShapesForClosedPaths(paths: THREE.ShapePath[]): THREE.Mesh[] {
    //@ts-ignore
    return paths.filter(path => path.userData?.isClosed).map((path) => {
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const shapes = path.toShapes(true);
        const geometry = new THREE.ShapeGeometry(shapes);
        const mesh = new THREE.Mesh(geometry, material);
        return mesh;
    });
};


// Hilfsfunktion: Prüft, ob ein Punkt innerhalb eines Polygons liegt (Ray-Casting-Algorithmus)
function isPointInPolygon(point: THREE.Vector2, polygon: THREE.Vector2[]): boolean {
    if (polygon.length < 3) return false;

    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;

        const intersect = ((yi > point.y) !== (yj > point.y)) &&
            (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);

        if (intersect) inside = !inside;
    }

    return inside;
}

// ============================================================================
// NEUE PATTERNS: Contour Spiral, Hilbert
// ============================================================================

/**
 * Generiert ein Contour-Spiral-Muster
 * - Basiert auf konzentrischen Offset-Ringen (ClipperOffset)
 * - Ringe werden zu EINEM durchgehenden Pfad verbunden
 * - Funktioniert für ALLE Polygon-Formen (konvex, konkav, komplex)!
 * - EIN durchgehender Pfad = optimal für Plotter!
 */
function generateSpiralInfill(
    polygon: THREE.Vector2[],
    _bounds: { minX: number, maxX: number, minY: number, maxY: number },
    options: InfillOptions
): THREE.Line[] {
    return generateContourSpiral(polygon, options, false);
}

/**
 * Generiert ein Fermat-Spiral-Muster (Contour-basiert)
 * - Wie Spiral, aber geht raus UND zurück
 * - Kein Pen-Lift nötig!
 */
function generateFermatSpiralInfill(
    polygon: THREE.Vector2[],
    _bounds: { minX: number, maxX: number, minY: number, maxY: number },
    options: InfillOptions
): THREE.Line[] {
    return generateContourSpiral(polygon, options, true);
}

/**
 * Resample a polygon to have exactly targetCount points, evenly distributed
 */
function resamplePolygon(polygon: THREE.Vector2[], targetCount: number): THREE.Vector2[] {
    if (polygon.length < 2) return polygon;

    // Calculate total perimeter
    let totalLength = 0;
    for (let i = 0; i < polygon.length; i++) {
        const next = (i + 1) % polygon.length;
        totalLength += polygon[i].distanceTo(polygon[next]);
    }

    const segmentLength = totalLength / targetCount;
    const result: THREE.Vector2[] = [];

    let currentDist = 0;
    let edgeIndex = 0;
    let edgeProgress = 0;

    for (let i = 0; i < targetCount; i++) {
        const targetDist = i * segmentLength;

        // Walk along edges until we reach targetDist
        while (currentDist < targetDist && edgeIndex < polygon.length) {
            const nextIndex = (edgeIndex + 1) % polygon.length;
            const edgeLength = polygon[edgeIndex].distanceTo(polygon[nextIndex]);
            const remainingOnEdge = edgeLength * (1 - edgeProgress);

            if (currentDist + remainingOnEdge >= targetDist) {
                // Point is on this edge
                const needed = targetDist - currentDist;
                const t = edgeProgress + (needed / edgeLength);
                const p = polygon[edgeIndex].clone().lerp(polygon[nextIndex], t);
                result.push(p);
                edgeProgress = t;
                currentDist = targetDist;
                break;
            } else {
                currentDist += remainingOnEdge;
                edgeIndex = (edgeIndex + 1) % polygon.length;
                edgeProgress = 0;
            }
        }
    }

    // Ensure we have enough points
    while (result.length < targetCount && polygon.length > 0) {
        result.push(polygon[result.length % polygon.length].clone());
    }

    return result;
}

/**
 * Generiere eine echte Spirale durch Interpolation zwischen konzentrischen Ringen
 * @param polygon Das zu füllende Polygon
 * @param options Infill-Optionen (density = Abstand zwischen Ringen)
 * @param fermatStyle Wenn true: geht raus UND zurück (kein Pen-Lift am Ende)
 */
function generateContourSpiral(
    polygon: THREE.Vector2[],
    options: InfillOptions,
    fermatStyle: boolean
): THREE.Line[] {
    const infillLines: THREE.Line[] = [];

    // Sammle alle konzentrischen Ringe
    const rings: THREE.Vector2[][] = [polygon]; // Start mit dem Original-Polygon
    let currentPolygon = polygon;
    const offsetAmount = -options.density; // Negativ für Inward-Offset
    const maxRings = 200; // Sicherheitslimit

    // Generiere konzentrische Ringe mit ClipperOffset
    while (rings.length < maxRings) {
        const offsetResults = offsetPolygon(currentPolygon, offsetAmount, 'miter');

        let foundValid = false;
        for (const offsetPoly of offsetResults) {
            if (offsetPoly.length >= 3 && isValidPolygon(offsetPoly, 0.5)) {
                rings.push(offsetPoly);
                currentPolygon = offsetPoly;
                foundValid = true;
                break; // Nimm nur den ersten gültigen Ring
            }
        }

        if (!foundValid) break;
    }

    console.log(`Contour Spiral: ${rings.length} Ringe generiert`);

    if (rings.length < 2) {
        // Nicht genug Ringe für eine Spirale - gib die vorhandenen als normale Linien zurück
        for (const ring of rings) {
            const points = ring.map(p => new THREE.Vector3(p.x, p.y, 0));
            points.push(points[0].clone()); // Schließen
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
            infillLines.push(new THREE.Line(geometry, material));
        }
        return infillLines;
    }

    // Resample alle Ringe auf die gleiche Punktanzahl
    const pointsPerRing = Math.max(50, polygon.length * 2); // Genügend Punkte für Smoothness
    const resampledRings = rings.map(ring => resamplePolygon(ring, pointsPerRing));

    // Erstelle die Spirale durch Interpolation
    const spiralPoints: THREE.Vector3[] = [];
    const totalRings = resampledRings.length;

    // Für jeden Punkt um das Polygon herum
    for (let i = 0; i <= pointsPerRing * (totalRings - 1); i++) {
        // Berechne welcher Ring und welche Position
        const progress = i / (pointsPerRing * (totalRings - 1)); // 0 bis 1
        const ringProgress = progress * (totalRings - 1); // 0 bis (totalRings-1)
        const ringIndex = Math.min(Math.floor(ringProgress), totalRings - 2);
        const ringT = ringProgress - ringIndex; // Interpolation zwischen zwei Ringen

        const pointIndex = i % pointsPerRing;

        // Interpoliere zwischen den zwei Ringen
        const outerPoint = resampledRings[ringIndex][pointIndex];
        const innerPoint = resampledRings[ringIndex + 1][pointIndex];

        const x = outerPoint.x + (innerPoint.x - outerPoint.x) * ringT;
        const y = outerPoint.y + (innerPoint.y - outerPoint.y) * ringT;

        spiralPoints.push(new THREE.Vector3(x, y, 0));
    }

    // Fermat-Style: Gehe wieder nach außen
    if (fermatStyle && spiralPoints.length > 0) {
        // Füge den Rückweg hinzu (in umgekehrter Reihenfolge, aber mit Offset)
        const returnPoints: THREE.Vector3[] = [];

        for (let i = spiralPoints.length - 1; i >= 0; i--) {
            // Leicht versetzt für den Rückweg
            const progress = (spiralPoints.length - 1 - i) / (spiralPoints.length - 1);
            const ringProgress = progress * (totalRings - 1);
            const ringIndex = Math.min(Math.floor(ringProgress), totalRings - 2);
            const ringT = ringProgress - ringIndex + 0.5; // Versetzt um halbe Ring-Distanz

            const pointIndex = (spiralPoints.length - 1 - i + Math.floor(pointsPerRing / 2)) % pointsPerRing;

            if (ringIndex < resampledRings.length - 1) {
                const outerPoint = resampledRings[ringIndex][pointIndex];
                const innerPoint = resampledRings[ringIndex + 1][pointIndex];

                const effectiveT = Math.min(1, Math.max(0, ringT));
                const x = outerPoint.x + (innerPoint.x - outerPoint.x) * effectiveT;
                const y = outerPoint.y + (innerPoint.y - outerPoint.y) * effectiveT;

                returnPoints.push(new THREE.Vector3(x, y, 0));
            }
        }

        spiralPoints.push(...returnPoints);
    }

    // Erstelle die Linie
    if (spiralPoints.length >= 2) {
        const geometry = new THREE.BufferGeometry().setFromPoints(spiralPoints);
        const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
        const line = new THREE.Line(geometry, material);
        line.name = fermatStyle ? 'Infill_FermatSpiral' : 'Infill_Spiral';
        infillLines.push(line);
    }

    console.log(`Contour Spiral: ${spiralPoints.length} Punkte im Pfad`);
    return infillLines;
}

/**
 * Generiert ein Hilbert-Kurven-Muster
 * - Space-filling Fraktal
 * - EIN durchgehender Pfad
 * - Gleichmäßige Abdeckung
 */
function generateHilbertInfill(
    polygon: THREE.Vector2[],
    bounds: { minX: number, maxX: number, minY: number, maxY: number },
    options: InfillOptions
): THREE.Line[] {
    const infillLines: THREE.Line[] = [];

    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    const size = Math.max(width, height);

    // Berechne die Order basierend auf Dichte
    // Höhere Order = mehr Details = dichteres Muster
    // 2^order Segmente pro Seite, Abstand = size / 2^order
    const targetSpacing = options.density;
    const order = Math.max(1, Math.min(6, Math.round(Math.log2(size / targetSpacing))));

    console.log(`Hilbert: Order ${order}, Ziel-Abstand: ${targetSpacing}mm`);

    // Generiere Hilbert-Kurve
    const hilbertPoints = generateHilbertPoints(order);

    // Skaliere und positioniere die Punkte
    const n = Math.pow(2, order);
    const scaleFactor = size / n;

    // Zentrum für Rotation
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const angleRad = options.angle * Math.PI / 180;

    const transformedPoints: THREE.Vector3[] = [];

    for (const hp of hilbertPoints) {
        // Skaliere zur Zielgröße
        let x = bounds.minX + hp.x * scaleFactor + scaleFactor / 2;
        let y = bounds.minY + hp.y * scaleFactor + scaleFactor / 2;

        // Rotiere um Zentrum
        if (options.angle !== 0) {
            const dx = x - centerX;
            const dy = y - centerY;
            x = centerX + dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
            y = centerY + dx * Math.sin(angleRad) + dy * Math.cos(angleRad);
        }

        const point = new THREE.Vector2(x, y);

        if (isPointInPolygon(point, polygon)) {
            transformedPoints.push(new THREE.Vector3(x, y, 0));
        }
    }

    // Erstelle durchgehende Segmente (nur verbundene Punkte)
    if (transformedPoints.length >= 2) {
        const geometry = new THREE.BufferGeometry().setFromPoints(transformedPoints);
        const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
        const line = new THREE.Line(geometry, material);
        line.name = 'Infill_Hilbert';
        infillLines.push(line);
    }

    console.log(`Hilbert: ${transformedPoints.length} Punkte innerhalb des Polygons`);
    return infillLines;
}

/**
 * Generiert Hilbert-Kurven-Punkte rekursiv
 * Verwendet L-System Regeln
 */
function generateHilbertPoints(order: number): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = [];

    // Startposition
    let x = 0;
    let y = 0;

    // Füge Startpunkt hinzu
    points.push({ x, y });

    // Rekursive Hilbert-Generierung
    function hilbert(level: number, dx: number, dy: number) {
        if (level <= 0) return;

        // L-System für Hilbert: A -> -BF+AFA+FB-
        // Rotationen: + = links, - = rechts, F = vorwärts

        hilbert(level - 1, dy, dx);          // B mit gedrehten Richtungen
        move(dx, dy);                         // F
        hilbert(level - 1, dx, dy);          // A
        move(dy, -dx);                        // F nach links
        hilbert(level - 1, dx, dy);          // A
        move(-dx, -dy);                       // F
        hilbert(level - 1, -dy, -dx);        // B mit gedrehten Richtungen
    }

    function move(mdx: number, mdy: number) {
        x += mdx;
        y += mdy;
        points.push({ x, y });
    }

    // Starte Rekursion
    hilbert(order, 1, 0);

    return points;
}