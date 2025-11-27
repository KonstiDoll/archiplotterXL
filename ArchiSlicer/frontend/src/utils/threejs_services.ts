import * as THREE from 'three';
//@ts-ignore
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader';
import { computed } from 'vue';

// Enum für Füllmuster-Typen
export enum InfillPatternType {
  NONE = 'none',
  LINES = 'lines',
  GRID = 'grid',
  CONCENTRIC = 'concentric',
  ZIGZAG = 'zigzag',
  HONEYCOMB = 'honeycomb'
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
  [InfillPatternType.CONCENTRIC]: { min: 0.5, max: 10, step: 0.5, defaultValue: 2 }
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

// Generiere ein Zickzack-Muster
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
    
    // Array zum Speichern gültiger Liniensegmente innerhalb des Polygons
    type LineSegment = { start: THREE.Vector2, end: THREE.Vector2 };
    const segments: LineSegment[] = [];
    
    // Erstelle parallele Linien
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
        
        // Sortiere die Schnittpunkte entlang der Linie
        if (intersections.length >= 2) {
            intersections.sort((a, b) => {
                const dax = a.x - lineStart.x;
                const day = a.y - lineStart.y;
                const dbx = b.x - lineStart.x;
                const dby = b.y - lineStart.y;
                return (dax * dir.x + day * dir.y) - (dbx * dir.x + dby * dir.y);
            });
            
            // Erstelle Liniensegmente zwischen jeweils zwei aufeinanderfolgenden Schnittpunkten
            for (let j = 0; j < intersections.length; j += 2) {
                if (j + 1 < intersections.length) {
                    segments.push({
                        start: intersections[j],
                        end: intersections[j + 1]
                    });
                }
            }
        }
    }
    
    // Wenn keine gültigen Segmente gefunden wurden, breche ab
    if (segments.length === 0) {
        console.warn("Keine gültigen Liniensegmente für Zickzack-Muster gefunden");
        return infillLines;
    }
    
    // Sortiere die Segmente nach Y-Position (oder nach einem anderen Kriterium je nach Winkel)
    segments.sort((a, b) => {
        // Berechne Schwerpunkt der Segmente für zuverlässiges Sortieren
        const aMidY = (a.start.y + a.end.y) / 2;
        const bMidY = (b.start.y + b.end.y) / 2;
        return aMidY - bMidY;
    });
    
    // Zeichne die Segmente und verbinde benachbarte zu einem Zickzack
    const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
    
    // Füge alle Einzelsegmente hinzu
    for (let i = 0; i < segments.length; i++) {
        const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(segments[i].start.x, segments[i].start.y, 0),
            new THREE.Vector3(segments[i].end.x, segments[i].end.y, 0)
        ]);
        const line = new THREE.Line(geometry, material);
        infillLines.push(line);
        
        // Verbinde mit dem nächsten Segment, wenn es eins gibt
        if (i < segments.length - 1) {
            // Wechsle zwischen Anfang und Ende für Zickzack
            let connectStart, connectEnd;
            
            if (i % 2 === 0) {
                connectStart = segments[i].end;
                connectEnd = segments[i + 1].start;
            } else {
                connectStart = segments[i].end;
                connectEnd = segments[i + 1].end;
                // Tausche Start/Ende des nächsten Segments für korrektes Zickzack
                const temp = segments[i + 1].start;
                segments[i + 1].start = segments[i + 1].end;
                segments[i + 1].end = temp;
            }
            
            // Prüfe, ob die Verbindungslinie innerhalb des Polygons liegt
            const isInsidePolygon = isLineInsidePolygon(connectStart, connectEnd, polygon);
            
            if (isInsidePolygon) {
                const connGeometry = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(connectStart.x, connectStart.y, 0),
                    new THREE.Vector3(connectEnd.x, connectEnd.y, 0)
                ]);
                const connLine = new THREE.Line(connGeometry, material);
                infillLines.push(connLine);
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

// Generiere ein Honigwaben-Muster (Hexagons)
function generateHoneycombInfill(
    polygon: THREE.Vector2[],
    bounds: { minX: number, maxX: number, minY: number, maxY: number },
    options: InfillOptions
): THREE.Line[] {
    const infillLines: THREE.Line[] = [];
    
    // Berechne die Seitenlänge des Hexagons basierend auf der Dichte
    const hexSize = options.density * 1.5;
    
    // Die Höhe eines Hexagons ist sqrt(3) * Seitenlänge
    const hexHeight = Math.sqrt(3) * hexSize;
    // Die Breite eines Hexagons ist 2 * Seitenlänge
    const hexWidth = 2 * hexSize;
    
    // Berechne die Anzahl der Hexagons, die nötig sind, um das Polygon abzudecken
    const numCols = Math.ceil((bounds.maxX - bounds.minX) / (hexWidth * 0.75)) + 2;
    const numRows = Math.ceil((bounds.maxY - bounds.minY) / hexHeight) + 2;
    
    // Startpunkt (oben links vom Bounding Box mit Offset)
    const startX = bounds.minX - hexWidth;
    const startY = bounds.minY - hexHeight;
    
    console.log(`Erzeuge Honigwaben-Muster mit ${numRows} Reihen und ${numCols} Spalten, Hexagongröße: ${hexSize}`);
    
    // Erstelle das Honigwaben-Muster
    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            // Bestimme die Mitte des aktuellen Hexagons
            // In geraden Reihen werden die Hexagons verschoben
            const centerX = startX + col * (hexWidth * 0.75) + (row % 2 === 0 ? 0 : hexWidth * 0.375);
            const centerY = startY + row * hexHeight;
            
            // Erstelle die 6 Punkte des Hexagons
            const points: THREE.Vector2[] = [];
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i;
                const x = centerX + hexSize * Math.cos(angle);
                const y = centerY + hexSize * Math.sin(angle);
                points.push(new THREE.Vector2(x, y));
            }
            
            // Füge den ersten Punkt am Ende wieder hinzu, um das Hexagon zu schließen
            points.push(points[0].clone());
            
            // Prüfe, ob das Hexagon mit dem Polygon überlappt oder darin enthalten ist
            let hasIntersection = false;
            
            // Teste, ob das Zentrum des Hexagons im Polygon liegt
            const centerPoint = new THREE.Vector2(centerX, centerY);
            
            if (isPointInPolygon(centerPoint, polygon)) {
                hasIntersection = true;
            } else {
                // Prüfe auf Schnitte mit dem Polygon
                for (let i = 0; i < 6; i++) {
                    if (hasIntersection) break;
                    
                    const p1 = points[i];
                    const p2 = points[i + 1];
                    
                    for (let j = 0; j < polygon.length; j++) {
                        const polyP1 = polygon[j];
                        const polyP2 = polygon[(j + 1) % polygon.length];
                        
                        if (lineLineIntersection(p1, p2, polyP1, polyP2)) {
                            hasIntersection = true;
                            break;
                        }
                    }
                }
            }
            
            // Wenn das Hexagon mit dem Polygon überlappt, zeichne es
            if (hasIntersection) {
                // Zeichne nur die Segmente des Hexagons, die im Polygon liegen oder es schneiden
                for (let i = 0; i < 6; i++) {
                    const p1 = points[i];
                    const p2 = points[i + 1];
                    
                    // Prüfe, ob das Segment (oder Teile davon) im Polygon liegt
                    const midPoint = new THREE.Vector2(
                        (p1.x + p2.x) / 2,
                        (p1.y + p2.y) / 2
                    );
                    
                    let shouldDraw = isPointInPolygon(midPoint, polygon);
                    
                    if (!shouldDraw) {
                        // Prüfe auf Schnitte mit dem Polygon
                        for (let j = 0; j < polygon.length; j++) {
                            const polyP1 = polygon[j];
                            const polyP2 = polygon[(j + 1) % polygon.length];
                            
                            if (lineLineIntersection(p1, p2, polyP1, polyP2)) {
                                shouldDraw = true;
                                break;
                            }
                        }
                    }
                    
                    if (shouldDraw) {
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
    }
    
    console.log(`${infillLines.length} Honigwaben-Liniensegmente generiert`);
    return infillLines;
}

// Generiere ein konzentrisches Muster (Offsets der Außenlinie)
function generateConcentricInfill(
    polygon: THREE.Vector2[],
    bounds: { minX: number, maxX: number, minY: number, maxY: number },
    options: InfillOptions
): THREE.Line[] {
    const infillLines: THREE.Line[] = [];
    
    // Berechne die maximale Anzahl der konzentrischen Linien basierend auf der Dichte
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    const maxOffset = Math.min(width, height) / 2;
    const numOffsets = Math.floor(maxOffset / options.density);
    
    console.log(`Erzeuge bis zu ${numOffsets} konzentrische Linien mit Abstand ${options.density}`);
    
    // Material für die Linien
    const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
    
    // WICHTIG: Die äußere Kontur wird NICHT zum Infill hinzugefügt,
    // damit sie beim Löschen des Infills erhalten bleibt
    // Sie ist bereits Teil der Originalgeometrie
    
    // Generiere das Polygon als Form für die Innenringe
    const shape = new THREE.Shape();
    if (polygon.length > 0) {
        shape.moveTo(polygon[0].x, polygon[0].y);
        for (let i = 1; i < polygon.length; i++) {
            shape.lineTo(polygon[i].x, polygon[i].y);
        }
        shape.closePath();
    }
    
    // Generiere die inneren Ringe (ohne die Außenkontur)
    for (let i = 1; i <= numOffsets; i++) {
        const offset = options.density * i;
        
        try {
            // Gehe das Originalpolygon durch
            const newPoints: THREE.Vector3[] = [];
            const wallOffset = offset; // Offset-Abstand vom Rand
            
            // Für jedes Segment des Polygons
            for (let j = 0; j < polygon.length; j++) {
                const current = polygon[j];
                const next = polygon[(j + 1) % polygon.length];
                const prev = polygon[(j - 1 + polygon.length) % polygon.length];
                
                // Berechne Richtungsvektoren für aktuelle und vorherige Kante
                const edgeDir = new THREE.Vector2()
                    .subVectors(next, current)
                    .normalize();
                const prevEdgeDir = new THREE.Vector2()
                    .subVectors(current, prev)
                    .normalize();
                
                // Berechne Normalen (nach innen gerichtet)
                // Für eine geschlossene Kurve zeigt (dy, -dx) nach innen
                const normal = new THREE.Vector2(edgeDir.y, -edgeDir.x);
                const prevNormal = new THREE.Vector2(prevEdgeDir.y, -prevEdgeDir.x);
                
                // Gemittelte Normale für bessere Ecken
                const avgNormal = new THREE.Vector2()
                    .addVectors(normal, prevNormal)
                    .normalize();
                
                // Berechne Winkel zwischen den Kanten
                const dot = normal.dot(prevNormal);
                const angle = Math.acos(Math.min(1, Math.max(-1, dot))); // Sicherer acos
                
                // Berechne Skalierungsfaktor für Ecken
                // Bei spitzen Winkeln muss mehr verschoben werden
                let scaleFactor = 1.0;
                if (angle < Math.PI / 2) { // Spitzer Winkel < 90°
                    scaleFactor = 1.0 / Math.max(0.01, Math.sin(angle / 2));
                    scaleFactor = Math.min(3, scaleFactor); // Limitiere den Faktor
                }
                
                // Berechne neuen Punkt mit Offset
                // WICHTIG: Verwende NEGATIVES Offset (nach innen statt nach außen)
                const offsetPoint = new THREE.Vector2()
                    .copy(current)
                    .add(avgNormal.multiplyScalar(-wallOffset * scaleFactor));
                
                newPoints.push(new THREE.Vector3(offsetPoint.x, offsetPoint.y, 0));
            }
            
            // Überprüfen, ob das neue Polygon gültig ist (mindestens 3 Punkte)
            if (newPoints.length >= 3) {
                // Schließe die Schleife
                newPoints.push(newPoints[0].clone());
                
                // Erstelle die Line für den Offset
                const offsetGeometry = new THREE.BufferGeometry().setFromPoints(newPoints);
                const offsetLine = new THREE.Line(offsetGeometry, material.clone());
                offsetLine.name = `Infill_Concentric_${i}`;
                infillLines.push(offsetLine);
                
                console.log(`Konkave Linie ${i} mit ${newPoints.length} Punkten erstellt`);
            } else {
                console.log(`Überspringer Linie ${i}: Ungültiges Polygon`);
                break;
            }
        } catch (error) {
            console.error(`Fehler beim Erstellen der konzentrischen Linie ${i}:`, error);
            break;
        }
    }
    
    console.log(`${infillLines.length} konzentrische Linien erfolgreich generiert`);
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