import * as THREE from 'three';
//@ts-ignore
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader';
import { offsetPolygon, isValidPolygon, clipLineToPolygon } from './geometry/clipper-utils';
import { PathAnalysisResult, getPolygonsWithHoles, analyzePathRelationships, analyzePathRelationshipsWithColors, getPolygonsWithHolesForColor, PolygonWithColor } from './geometry/path-analysis';

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
// Berücksichtigt sowohl stroke- als auch fill-Attribute
export function extractColorsFromSVG(svgContent: string): string[] {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
    const colors = new Set<string>();

    // Alle zeichenbaren SVG-Elemente finden
    const allElements = svgDoc.querySelectorAll(
        'path, line, polyline, polygon, rect, circle, ellipse'
    );

    allElements.forEach(el => {
        let strokeColor: string | null = null;
        let fillColor: string | null = null;

        // Direkte Attribute prüfen
        const strokeAttr = el.getAttribute('stroke');
        if (strokeAttr && strokeAttr !== 'none') {
            strokeColor = strokeAttr;
        }

        const fillAttr = el.getAttribute('fill');
        if (fillAttr && fillAttr !== 'none') {
            fillColor = fillAttr;
        }

        // Style-Attribut prüfen (überschreibt direkte Attribute)
        const style = el.getAttribute('style') || '';
        const strokeMatch = style.match(/stroke:\s*([^;]+)/);
        if (strokeMatch && strokeMatch[1].trim() !== 'none') {
            strokeColor = strokeMatch[1].trim();
        }

        const fillMatch = style.match(/fill:\s*([^;]+)/);
        if (fillMatch && fillMatch[1].trim() !== 'none') {
            fillColor = fillMatch[1].trim();
        }

        // Priorität anwenden: stroke > fill
        if (strokeColor) {
            colors.add(cssColorToHex(strokeColor));
        } else if (fillColor) {
            colors.add(cssColorToHex(fillColor));
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
            // Verwende effectiveColor (berücksichtigt stroke/fill Priorität)
            // Fallback auf strokeColor für Abwärtskompatibilität
            const color = child.userData?.effectiveColor
                       || child.userData?.strokeColor
                       || '#000000';
            const count = colorCounts.get(color) || 0;
            colorCounts.set(color, count + 1);
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

/**
 * Pre-process SVG content to resolve CSS class styles to inline styles.
 * THREE.js SVGLoader doesn't resolve <style> blocks with class selectors,
 * so we need to do it manually before parsing.
 */
function preprocessSvgStyles(svgContent: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');

    // Find all <style> elements and extract CSS rules
    const styleElements = doc.querySelectorAll('style');
    const classStyles = new Map<string, { [key: string]: string }>();

    styleElements.forEach(styleEl => {
        const cssText = styleEl.textContent || '';

        // Parse CSS rules (simple parser for class selectors)
        // Matches: .className { property: value; ... }
        const ruleRegex = /\.([a-zA-Z0-9_-]+)\s*\{([^}]+)\}/g;
        let match;

        while ((match = ruleRegex.exec(cssText)) !== null) {
            const className = match[1];
            const declarations = match[2];
            const styles: { [key: string]: string } = {};

            // Parse individual declarations
            declarations.split(';').forEach(decl => {
                const [prop, val] = decl.split(':').map(s => s.trim());
                if (prop && val) {
                    styles[prop] = val;
                }
            });

            classStyles.set(className, styles);
        }
    });

    if (classStyles.size > 0) {
        console.log(`Resolved ${classStyles.size} CSS class styles:`, Object.fromEntries(classStyles));
    }

    // Apply class styles to elements as inline styles
    classStyles.forEach((styles, className) => {
        const elements = doc.querySelectorAll(`.${className}`);
        elements.forEach(el => {
            // Get existing inline style
            const existingStyle = el.getAttribute('style') || '';
            const existingStyles: { [key: string]: string } = {};

            existingStyle.split(';').forEach(decl => {
                const [prop, val] = decl.split(':').map(s => s.trim());
                if (prop && val) {
                    existingStyles[prop] = val;
                }
            });

            // Merge: existing inline styles override class styles
            const mergedStyles = { ...styles, ...existingStyles };

            // Also set as direct attributes for SVGLoader compatibility
            if (mergedStyles['fill'] && !el.hasAttribute('fill')) {
                el.setAttribute('fill', mergedStyles['fill']);
            }
            if (mergedStyles['stroke'] && !el.hasAttribute('stroke')) {
                el.setAttribute('stroke', mergedStyles['stroke']);
            }
            if (mergedStyles['stroke-width'] && !el.hasAttribute('stroke-width')) {
                el.setAttribute('stroke-width', mergedStyles['stroke-width']);
            }

            // Build new style string
            const newStyle = Object.entries(mergedStyles)
                .map(([k, v]) => `${k}: ${v}`)
                .join('; ');

            if (newStyle) {
                el.setAttribute('style', newStyle);
            }
        });
    });

    // Serialize back to string
    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
}

export function getThreejsObjectFromSvg(svgContent: string, _offsetX: number = 0, dpi: number = 96): Promise<THREE.Group> {
    console.log("--- SVG Analyse Start ---");
    console.log(`DPI: ${dpi} (Skalierungsfaktor px→mm: ${(25.4 / dpi).toFixed(4)})`);
    // _offsetX parameter is kept for compatibility but not used anymore

    // Pre-process SVG to resolve CSS class styles
    const processedSvg = preprocessSvgStyles(svgContent);

    // SVG Metadaten extrahieren (viewBox, width, height, transform)
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(processedSvg, 'image/svg+xml');
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
    const svg = loader.parse(processedSvg);
    
    console.log("SVG Loader Infos:");
    console.log(`SVG Paths gefunden: ${svg.paths.length}`);
    
    const paths: THREE.ShapePath[] = svg.paths;
    
    // Erstelle Gruppe für ThreeJS-Objekte
    const group = new THREE.Group();
    
    paths.forEach((shapePath) => {
        // Extrahiere stroke- und fill-Farben aus den SVG-Daten
        // SVGLoader speichert Style-Infos in userData.style
        //@ts-ignore
        const style = shapePath.userData?.style || {};
        const strokeColor = style.stroke;
        const fillColor = style.fill;

        // Bestimme die effektive Farbe für diesen Pfad
        // Priorität: stroke > fill > schwarz
        let effectiveColor: string;
        if (strokeColor && strokeColor !== 'none') {
            effectiveColor = strokeColor;
        } else if (fillColor && fillColor !== 'none') {
            effectiveColor = fillColor;
        } else {
            effectiveColor = '#000000';
        }

        // Konvertiere die Farbe zu Hex
        const hexColor = cssColorToHex(effectiveColor);
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
            // Speichere alle Farbinformationen für spätere Verwendung
            line.userData.strokeColor = strokeColor && strokeColor !== 'none'
                ? cssColorToHex(strokeColor) : null;
            line.userData.fillColor = fillColor && fillColor !== 'none'
                ? cssColorToHex(fillColor) : null;
            line.userData.effectiveColor = hexColor;

            // Prüfe ob der Pfad geschlossen ist
            // Toleranz für "geschlossen" - größer für große SVGs
            const CLOSE_TOLERANCE = 1.0; // 1.0 Einheiten Toleranz (für große SVG-Koordinaten)

            // Methode 1: autoClose Flag vom SVG-Loader (Z-Befehl im SVG)
            let isClosed = subPath.autoClose === true;

            // Methode 2: Prüfe ob erster und letzter Punkt übereinstimmen (via curves)
            if (!isClosed && subPath.curves.length > 0) {
                const firstCurve = subPath.curves[0];
                const lastCurve = subPath.curves[subPath.curves.length - 1];
                // @ts-ignore - v1 und v2 existieren auf Bezier-Kurven
                if (firstCurve.v1 && lastCurve.v2) {
                    // @ts-ignore
                    const startX = firstCurve.v1.x;
                    // @ts-ignore
                    const startY = firstCurve.v1.y;
                    // @ts-ignore
                    const endX = lastCurve.v2.x;
                    // @ts-ignore
                    const endY = lastCurve.v2.y;
                    const gap = Math.sqrt((startX - endX) ** 2 + (startY - endY) ** 2);
                    if (gap < CLOSE_TOLERANCE) {
                        isClosed = true;
                    }
                }
            }

            // Methode 3: Prüfe direkt die Geometrie-Punkte
            if (!isClosed) {
                const positions = line.geometry.getAttribute('position');
                if (positions && positions.count >= 3) {
                    const firstX = positions.getX(0);
                    const firstY = positions.getY(0);
                    const lastX = positions.getX(positions.count - 1);
                    const lastY = positions.getY(positions.count - 1);
                    const gap = Math.sqrt((firstX - lastX) ** 2 + (firstY - lastY) ** 2);
                    if (gap < CLOSE_TOLERANCE) {
                        isClosed = true;
                    }
                }
            }

            line.userData.isClosed = isClosed;

            // Debug: Logge nicht-geschlossene Pfade mit der problematischen Farbe
            if (!isClosed && hexColor === '#1d1d1b') {
                const positions = line.geometry.getAttribute('position');
                if (positions && positions.count >= 3) {
                    const firstX = positions.getX(0);
                    const firstY = positions.getY(0);
                    const lastX = positions.getX(positions.count - 1);
                    const lastY = positions.getY(positions.count - 1);
                    const gap = Math.sqrt((firstX - lastX) ** 2 + (firstY - lastY) ** 2);
                    console.warn(`OFFENER Pfad #1d1d1b: ${positions.count} Punkte, Gap=${gap.toFixed(2)}, Start=(${firstX.toFixed(1)},${firstY.toFixed(1)}), End=(${lastX.toFixed(1)},${lastY.toFixed(1)})`);
                }
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
    
    // Ermittle die Abmessungen VOR der Koordinatentransformation
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

    console.log("SVG Abmessungen (vor Transformation):");
    console.log(`X: Min=${minX.toFixed(2)}, Max=${maxX.toFixed(2)}, Breite=${(maxX - minX).toFixed(2)}`);
    console.log(`Y: Min=${minY.toFixed(2)}, Max=${maxY.toFixed(2)}, Höhe=${(maxY - minY).toFixed(2)}`);

    // ============================================================
    // Koordinatentransformation: SVG → Slicer-Vorschau
    // SVG/Inkscape: Nullpunkt links oben, X nach rechts, Y nach unten
    // Slicer (Three.js): Nullpunkt links unten, X nach rechts, Y nach oben
    //
    // Transformation:
    //   X bleibt X (Offset vom Ursprung wird beibehalten)
    //   Y wird gespiegelt: Y_neu = viewBox.height - Y_alt
    //   → Abstand vom oberen Rand (Inkscape) = Abstand vom unteren Rand (Slicer)
    //
    // Hinweis: X↔Y Tausch für Maschine erfolgt im G-Code Export
    // ============================================================
    console.log(`Y-Spiegelung mit viewBox.height: ${viewBox.height}`);

    group.children.forEach((child) => {
        if (child instanceof THREE.Line) {
            const positions = child.geometry.attributes.position.array;
            for (let i = 0; i < positions.length; i += 3) {
                const x_alt = positions[i];
                const y_alt = positions[i + 1];

                // SVG → Slicer Koordinatentransformation (nur Y spiegeln)
                positions[i] = x_alt;                        // X bleibt (Offset beibehalten)
                positions[i + 1] = viewBox.height - y_alt;   // Y invertieren (Offset erhalten)
            }
            child.geometry.attributes.position.needsUpdate = true;
        }
    });

    // DPI-Skalierung anwenden: px → mm
    // Bei 96 DPI: 1 inch = 96 px, 1 inch = 25.4 mm → 1 px = 25.4/96 mm
    const dpiScale = 25.4 / dpi;
    console.log(`Wende DPI-Skalierung an: ${dpiScale.toFixed(4)} (${dpi} DPI)`);

    group.children.forEach((child) => {
        if (child instanceof THREE.Line) {
            const positions = child.geometry.attributes.position.array;
            for (let i = 0; i < positions.length; i += 3) {
                positions[i] *= dpiScale;      // X skalieren
                positions[i + 1] *= dpiScale;  // Y skalieren
            }
            child.geometry.attributes.position.needsUpdate = true;
        }
    });

    // Bounding Box nach Transformation neu berechnen
    let newMinX = Infinity, newMaxX = -Infinity;
    let newMinY = Infinity, newMaxY = -Infinity;

    group.children.forEach((child) => {
        if (child instanceof THREE.Line) {
            const positions = child.geometry.attributes.position.array;
            for (let i = 0; i < positions.length; i += 3) {
                const x = positions[i];
                const y = positions[i + 1];

                if (x < newMinX) newMinX = x;
                if (x > newMaxX) newMaxX = x;
                if (y < newMinY) newMinY = y;
                if (y > newMaxY) newMaxY = y;
            }
        }
    });

    // Aktualisiere die Werte für die userData
    minX = newMinX;
    maxX = newMaxX;
    minY = newMinY;
    maxY = newMaxY;

    console.log("Finale ThreeJS-Gruppe Abmessungen (nach SVG→Maschine Transformation):");
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
        let points = extractPathPoints(path);
        console.log(`Extrahierte Punkte: ${points.length}`);

        if (points.length < 3) {
            console.warn(`Zu wenig Punkte für Pfad ${index}: ${points.length}`);
            return; // Skip this path
        }

        // Outline Offset anwenden (Polygon nach innen versetzen)
        if (options.outlineOffset > 0) {
            const offsetResult = offsetPolygon(points, -options.outlineOffset, 'miter');
            if (offsetResult.length > 0 && offsetResult[0].length >= 3) {
                points = offsetResult[0];
                console.log(`Outline Offset ${options.outlineOffset}mm angewandt, neue Punktzahl: ${points.length}`);
            } else {
                console.warn(`Outline Offset zu groß - Polygon kollabiert`);
                return; // Skip this path
            }
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
        let { outer, holes } = item;

        console.log(`Polygon ${index}: ${outer.length} Punkte, ${holes.length} Holes`);

        if (outer.length < 3) {
            console.warn(`Zu wenig Punkte für Polygon ${index}`);
            return;
        }

        // Outline Offset anwenden (Polygon nach innen versetzen)
        if (options.outlineOffset > 0) {
            const offsetResult = offsetPolygon(outer, -options.outlineOffset, 'miter');
            if (offsetResult.length > 0 && offsetResult[0].length >= 3) {
                outer = offsetResult[0];
                console.log(`Outline Offset ${options.outlineOffset}mm angewandt, neue Punktzahl: ${outer.length}`);
            } else {
                console.warn(`Outline Offset zu groß - Polygon kollabiert`);
                return;
            }
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
 * Generiert Infill nur für geschlossene Pfade einer bestimmten Farbe
 *
 * Wenn eine globale Path-Analyse übergeben wird, werden Holes aller Farben berücksichtigt.
 * Dies ist wichtig für SVGs, bei denen Outer-Pfad und Hole unterschiedliche Farben haben
 * (z.B. bei Textpfaden aus Illustrator mit verschiedenen Schwarztönen).
 *
 * @param group Die THREE.Group mit allen SVG-Linien
 * @param color Die Hex-Farbe (z.B. "#ff0000") für die Infill generiert werden soll
 * @param options Infill-Optionen (Pattern, Dichte, etc.)
 * @param globalPathAnalysis Optional: Globale Path-Analyse für farbübergreifende Hole-Detection
 * @returns Eine neue THREE.Group mit den Infill-Linien für diese Farbe
 */
export function generateInfillForColor(
    group: THREE.Group,
    color: string,
    options: InfillOptions,
    globalPathAnalysis?: PathAnalysisResult
): THREE.Group {
    const infillGroup = new THREE.Group();
    infillGroup.name = `InfillGroup_${color.replace('#', '')}`;

    // Wenn kein Infill gewünscht ist, leere Gruppe zurückgeben
    if (options.patternType === InfillPatternType.NONE) {
        console.log(`Kein Infill für Farbe ${color} (Pattern: NONE)`);
        return infillGroup;
    }

    // Normalisiere die Zielfarbe für Vergleich
    const targetColor = color.toLowerCase();

    let polygonsWithHoles: { outer: THREE.Vector2[]; holes: THREE.Vector2[][] }[];

    // Wenn globale Analyse vorhanden: Nutze farbübergreifende Hole-Detection
    if (globalPathAnalysis) {
        polygonsWithHoles = getPolygonsWithHolesForColor(globalPathAnalysis, targetColor);
        console.log(`Infill für Farbe ${color}: ${polygonsWithHoles.length} Outer-Pfade (mit globaler Hole-Detection)`);

        // Zähle die Holes für besseres Logging
        const totalHoles = polygonsWithHoles.reduce((sum, p) => sum + p.holes.length, 0);
        console.log(`Farbe ${color}: ${polygonsWithHoles.length} Outer, ${totalHoles} Holes (farbübergreifend)`);
    } else {
        // Fallback: Alte Methode (nur Pfade dieser Farbe analysieren)
        const polygonsForColor: THREE.Vector2[][] = [];

        group.children.forEach((child) => {
            if (child instanceof THREE.Line && child.userData?.isClosed) {
                const pathColor = (child.userData?.effectiveColor || '#000000').toLowerCase();
                if (pathColor === targetColor) {
                    const points = extractPathPoints(child);
                    if (points.length >= 3) {
                        polygonsForColor.push(points);
                    }
                }
            }
        });

        console.log(`Infill für Farbe ${color}: ${polygonsForColor.length} geschlossene Pfade gefunden (lokale Analyse)`);

        if (polygonsForColor.length === 0) {
            return infillGroup;
        }

        // Path-Analyse für Hole-Detection NUR innerhalb dieser Farbgruppe
        const colorPathAnalysis = analyzePathRelationships(polygonsForColor);
        polygonsWithHoles = getPolygonsWithHoles(colorPathAnalysis);

        console.log(`Farbe ${color}: ${colorPathAnalysis.outerPaths.length} Outer, ${colorPathAnalysis.holes.length} Holes, ${colorPathAnalysis.nestedObjects.length} Nested (lokale Analyse)`);
    }

    if (polygonsWithHoles.length === 0) {
        return infillGroup;
    }

    // Generiere Infill für jedes Polygon (outer + nested objects) mit Hole-Clipping
    polygonsWithHoles.forEach((item, itemIndex) => {
        let { outer, holes } = item;

        console.log(`Polygon ${itemIndex} (Farbe ${color}): ${outer.length} Punkte, ${holes.length} Holes`);

        if (outer.length < 3) {
            console.warn(`Zu wenig Punkte für Polygon ${itemIndex}`);
            return;
        }

        // Outline Offset anwenden (Polygon nach innen versetzen)
        if (options.outlineOffset > 0) {
            const offsetResult = offsetPolygon(outer, -options.outlineOffset, 'miter');
            if (offsetResult.length > 0 && offsetResult[0].length >= 3) {
                outer = offsetResult[0];
            } else {
                console.warn(`Outline Offset zu groß für Polygon ${itemIndex} - überspringe`);
                return;
            }

            // Holes auch nach außen versetzen (damit Abstand zum Hole eingehalten wird)
            holes = holes.map(hole => {
                const holeOffset = offsetPolygon(hole, options.outlineOffset, 'miter');
                return holeOffset.length > 0 && holeOffset[0].length >= 3 ? holeOffset[0] : hole;
            });
        }

        // Berechne Bounding Box
        const bounds = calculateBounds(outer);

        // Generiere Infill basierend auf dem gewählten Muster
        let infillLines: THREE.Line[] = [];

        try {
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
                default:
                    console.warn(`Unbekannter Infill-Typ: ${options.patternType}`);
                    break;
            }
        } catch (error) {
            console.error(`Fehler bei der Infill-Generierung für Polygon ${itemIndex}:`, error);
        }

        // Hole-Clipping: Infill-Linien um Holes herum clippen
        if (holes.length > 0 && infillLines.length > 0) {
            console.log(`Clippe ${infillLines.length} Linien um ${holes.length} Holes`);
            infillLines = clipInfillLinesToHoles(infillLines, holes);
        }

        // Benenne die Linien und füge sie zur Gruppe hinzu
        infillLines.forEach((line, lineIndex) => {
            line.name = `Infill_${color.replace('#', '')}_Poly${itemIndex}_Line${lineIndex}`;
            (line.material as THREE.LineBasicMaterial).color = new THREE.Color(0x4287f5);
            line.userData = {
                ...line.userData,
                sourceColor: color,
                isInfill: true
            };
            infillGroup.add(line);
        });

        console.log(`${infillLines.length} Infill-Linien generiert für Polygon ${itemIndex} (Farbe: ${color})`);
    });

    console.log(`Insgesamt ${infillGroup.children.length} Infill-Linien für Farbe ${color}`);
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
export function extractPathPoints(path: THREE.Line): THREE.Vector2[] {
    const positions = path.geometry.attributes.position.array;
    const points: THREE.Vector2[] = [];

    for (let i = 0; i < positions.length; i += 3) {
        points.push(new THREE.Vector2(positions[i], positions[i + 1]));
    }

    return points;
}

/**
 * Extrahiert alle geschlossenen Polygone aus einer THREE.Group MIT Farbinformation.
 * Diese Funktion wird für die globale Path-Analyse verwendet, bei der alle Pfade
 * unabhängig von ihrer Farbe analysiert werden.
 *
 * @param group Die THREE.Group mit allen SVG-Linien
 * @returns Array von Polygonen mit Farbinformation
 */
export function extractAllPolygonsWithColorInfo(group: THREE.Group): PolygonWithColor[] {
    const result: PolygonWithColor[] = [];

    group.children.forEach((child) => {
        if (child instanceof THREE.Line && child.userData?.isClosed) {
            const color = (child.userData?.effectiveColor || '#000000').toLowerCase();
            const points = extractPathPoints(child);
            if (points.length >= 3) {
                result.push({ polygon: points, color });
            }
        }
    });

    return result;
}

/**
 * Führt eine globale Path-Analyse durch (über alle Farben hinweg).
 * Diese Funktion sollte einmal nach dem SVG-Laden aufgerufen werden.
 *
 * @param group Die THREE.Group mit allen SVG-Linien
 * @returns PathAnalysisResult mit Farbinformation in jedem PathInfo
 */
export function analyzeAllPathsGlobally(group: THREE.Group): PathAnalysisResult {
    const polygonsWithColors = extractAllPolygonsWithColorInfo(group);
    console.log(`Globale Path-Analyse: ${polygonsWithColors.length} geschlossene Pfade gefunden`);

    const result = analyzePathRelationshipsWithColors(polygonsWithColors);
    console.log(`Globale Analyse: ${result.outerPaths.length} Outer, ${result.holes.length} Holes, ${result.nestedObjects.length} Nested`);

    return result;
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
 * Generiere ein echtes V-Muster (Zigzag)
 * - Ein durchgehender Pfad der V-förmig hin und her geht
 * - Direkte Verbindung zwischen Scanlines (kein Verfahren entlang der Kante)
 */
function generateZigzagInfill(
    polygon: THREE.Vector2[],
    bounds: { minX: number, maxX: number, minY: number, maxY: number },
    options: InfillOptions
): THREE.Line[] {
    const infillLines: THREE.Line[] = [];

    // Berechne Richtungs- und Normalenvektor basierend auf Winkel
    const angleRad = options.angle * Math.PI / 180;
    const dir = new THREE.Vector2(Math.cos(angleRad), Math.sin(angleRad));
    const normal = new THREE.Vector2(-dir.y, dir.x);

    // Berechne Dimensionen
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    const diagonal = Math.sqrt(width * width + height * height);

    const center = new THREE.Vector2(
        (bounds.minX + bounds.maxX) / 2,
        (bounds.minY + bounds.maxY) / 2
    );

    // Berechne Projektionsbereich
    let projMin = Infinity;
    let projMax = -Infinity;

    polygon.forEach(p => {
        const relX = p.x - center.x;
        const relY = p.y - center.y;
        const proj = relX * normal.x + relY * normal.y;
        projMin = Math.min(projMin, proj);
        projMax = Math.max(projMax, proj);
    });

    const projLength = projMax - projMin;
    const numLines = Math.ceil(projLength / options.density);

    if (numLines <= 0 || numLines > 1000) {
        console.warn(`Ungültige Anzahl von Linien: ${numLines}`);
        return infillLines;
    }

    // Sammle alle Scanline-Segmente
    type LineSegment = { start: THREE.Vector2, end: THREE.Vector2, projValue: number };
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
            // Sortiere Intersections entlang der Linie
            intersections.sort((a, b) => {
                const dax = a.x - lineStart.x;
                const day = a.y - lineStart.y;
                const dbx = b.x - lineStart.x;
                const dby = b.y - lineStart.y;
                return (dax * dir.x + day * dir.y) - (dbx * dir.x + dby * dir.y);
            });

            // Für jedes Paar von Intersections ein Segment erstellen
            for (let j = 0; j < intersections.length; j += 2) {
                if (j + 1 < intersections.length) {
                    segments.push({
                        start: intersections[j].clone(),
                        end: intersections[j + 1].clone(),
                        projValue: offset
                    });
                }
            }
        }
    }

    if (segments.length === 0) {
        console.warn("Keine gültigen Liniensegmente für Zigzag gefunden");
        return infillLines;
    }

    // Sortiere Segmente nach Projektion
    segments.sort((a, b) => a.projValue - b.projValue);

    // Baue EINEN durchgehenden Pfad als V-Muster
    const pathPoints: THREE.Vector3[] = [];

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];

        if (i % 2 === 0) {
            // Gerade Linien: start → end
            pathPoints.push(new THREE.Vector3(seg.start.x, seg.start.y, 0));
            pathPoints.push(new THREE.Vector3(seg.end.x, seg.end.y, 0));
        } else {
            // Ungerade Linien: end → start (Richtung umkehren für V-Muster)
            pathPoints.push(new THREE.Vector3(seg.end.x, seg.end.y, 0));
            pathPoints.push(new THREE.Vector3(seg.start.x, seg.start.y, 0));
        }
    }

    // Erstelle eine einzelne Linie aus allen Punkten
    if (pathPoints.length >= 2) {
        const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
        const geometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
        infillLines.push(new THREE.Line(geometry, material));
    }

    console.log(`Zigzag V-Muster: ${segments.length} Segmente, ${pathPoints.length} Punkte`);
    return infillLines;
}

/**
 * Generiere ein Honigwaben-Muster (Hexagons)
 * - Korrekte Tessellation ohne Überlappung
 * - Zeichnet nur einzigartige Kanten (keine Duplikate)
 * - Unterstützt Angle-Parameter durch Rotation
 */
function generateHoneycombInfill(
    polygon: THREE.Vector2[],
    bounds: { minX: number, maxX: number, minY: number, maxY: number },
    options: InfillOptions
): THREE.Line[] {
    const infillLines: THREE.Line[] = [];

    // Hexagon-Geometrie (flat-top orientation)
    // hexSize = Radius (Abstand von Mitte zu Ecke)
    const hexSize = options.density;

    // Flat-top Hexagon:
    // - Breite (horizontal, Ecke zu Ecke) = 2 * hexSize
    // - Höhe (vertikal, Seite zu Seite) = sqrt(3) * hexSize
    const hexHeight = Math.sqrt(3) * hexSize;

    // Tessellation-Abstände:
    // - Horizontal: 3/2 * hexSize (= 0.75 * hexWidth)
    // - Vertikal: hexHeight
    // - Offset für ungerade Spalten: hexHeight / 2
    const colSpacing = hexSize * 1.5;
    const rowSpacing = hexHeight;

    // Rotation
    const angleRad = options.angle * Math.PI / 180;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    const rotatePoint = (x: number, y: number): THREE.Vector2 => {
        if (angleRad === 0) return new THREE.Vector2(x, y);
        const dx = x - centerX;
        const dy = y - centerY;
        return new THREE.Vector2(
            centerX + dx * Math.cos(angleRad) - dy * Math.sin(angleRad),
            centerY + dx * Math.sin(angleRad) + dy * Math.cos(angleRad)
        );
    };

    // Erweiterte Bounds für Rotation
    const diagonal = Math.sqrt(Math.pow(bounds.maxX - bounds.minX, 2) + Math.pow(bounds.maxY - bounds.minY, 2));
    const padding = hexSize * 2;
    const extBounds = {
        minX: centerX - diagonal / 2 - padding,
        maxX: centerX + diagonal / 2 + padding,
        minY: centerY - diagonal / 2 - padding,
        maxY: centerY + diagonal / 2 + padding
    };

    const numCols = Math.ceil((extBounds.maxX - extBounds.minX) / colSpacing) + 2;
    const numRows = Math.ceil((extBounds.maxY - extBounds.minY) / rowSpacing) + 2;

    // Set zum Vermeiden von Duplikaten (Kanten-Schlüssel)
    const drawnEdges = new Set<string>();
    const edgeKey = (p1: THREE.Vector2, p2: THREE.Vector2) => {
        const minX = Math.min(p1.x, p2.x).toFixed(2);
        const minY = Math.min(p1.y, p2.y).toFixed(2);
        const maxX = Math.max(p1.x, p2.x).toFixed(2);
        const maxY = Math.max(p1.y, p2.y).toFixed(2);
        return `${minX},${minY}-${maxX},${maxY}`;
    };

    console.log(`Honeycomb: ${numRows}x${numCols} Zellen, hexSize=${hexSize}mm`);

    for (let col = 0; col < numCols; col++) {
        for (let row = 0; row < numRows; row++) {
            // Hexagon-Zentrum
            // Ungerade Spalten sind um halbe Höhe versetzt
            const rawX = extBounds.minX + col * colSpacing;
            const rawY = extBounds.minY + row * rowSpacing + (col % 2 === 1 ? rowSpacing / 2 : 0);

            // Die 6 Ecken des Hexagons (flat-top: Start oben rechts, gegen Uhrzeiger)
            const corners: THREE.Vector2[] = [];
            for (let i = 0; i < 6; i++) {
                // 0° = rechts, dann gegen Uhrzeiger. Für flat-top starten wir bei 0°
                const angle = (Math.PI / 3) * i;
                const x = rawX + hexSize * Math.cos(angle);
                const y = rawY + hexSize * Math.sin(angle);
                corners.push(rotatePoint(x, y));
            }

            // Zeichne die 6 Kanten, aber überspringe Duplikate
            for (let i = 0; i < 6; i++) {
                const p1 = corners[i];
                const p2 = corners[(i + 1) % 6];

                const key = edgeKey(p1, p2);
                if (drawnEdges.has(key)) continue;
                drawnEdges.add(key);

                // Clippe an Polygon
                const clipped = clipLineToPolygonSimple(p1, p2, polygon);

                for (const seg of clipped) {
                    const geometry = new THREE.BufferGeometry().setFromPoints([
                        new THREE.Vector3(seg.start.x, seg.start.y, 0),
                        new THREE.Vector3(seg.end.x, seg.end.y, 0)
                    ]);
                    const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
                    infillLines.push(new THREE.Line(geometry, material));
                }
            }
        }
    }

    console.log(`${infillLines.length} Honeycomb-Segmente generiert (${drawnEdges.size} einzigartige Kanten)`);
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
 * Finde den Index des Punktes im Ring, der am nächsten zur angegebenen Winkelrichtung vom Zentrum liegt
 * Dies sorgt für konsistente "Naht"-Positionen bei allen Ringen
 */
function findPointAtAngle(ring: THREE.Vector2[], center: THREE.Vector2, targetAngle: number): number {
    let bestIdx = 0;
    let bestAngleDiff = Infinity;

    for (let i = 0; i < ring.length; i++) {
        const dx = ring[i].x - center.x;
        const dy = ring[i].y - center.y;
        const angle = Math.atan2(dy, dx);

        // Winkel-Differenz (normalisiert auf -PI bis PI)
        let diff = angle - targetAngle;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;

        if (Math.abs(diff) < Math.abs(bestAngleDiff)) {
            bestAngleDiff = diff;
            bestIdx = i;
        }
    }

    return bestIdx;
}

/**
 * Berechne das Zentrum eines Polygons
 */
function getPolygonCenter(polygon: THREE.Vector2[]): THREE.Vector2 {
    let cx = 0, cy = 0;
    for (const p of polygon) {
        cx += p.x;
        cy += p.y;
    }
    return new THREE.Vector2(cx / polygon.length, cy / polygon.length);
}

/**
 * Rotiere Ring so dass er bei startIndex beginnt
 */
function rotateRing(ring: THREE.Vector2[], startIndex: number): THREE.Vector2[] {
    if (startIndex === 0 || ring.length === 0) return ring;
    return [...ring.slice(startIndex), ...ring.slice(0, startIndex)];
}

/**
 * Generiere Spirale durch Verbinden von konzentrischen Ringen
 * OHNE Punkt-Interpolation - originale Ring-Geometrie wird beibehalten
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

    // Sammle alle konzentrischen Ringe mit ClipperOffset
    const rings: THREE.Vector2[][] = [polygon];
    let currentPolygon = polygon;
    const offsetAmount = -options.density;
    const maxRings = 200;

    while (rings.length < maxRings) {
        const offsetResults = offsetPolygon(currentPolygon, offsetAmount, 'miter');

        let foundValid = false;
        for (const offsetPoly of offsetResults) {
            if (offsetPoly.length >= 3 && isValidPolygon(offsetPoly, 0.5)) {
                rings.push(offsetPoly);
                currentPolygon = offsetPoly;
                foundValid = true;
                break;
            }
        }

        if (!foundValid) break;
    }

    console.log(`Contour Spiral: ${rings.length} Ringe generiert`);

    if (rings.length === 0) {
        return infillLines;
    }

    // Wenn nur ein Ring: gib ihn als geschlossene Linie zurück
    if (rings.length === 1) {
        const points = rings[0].map(p => new THREE.Vector3(p.x, p.y, 0));
        points.push(points[0].clone());
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
        infillLines.push(new THREE.Line(geometry, material));
        return infillLines;
    }

    // Berechne das gemeinsame Zentrum für konsistente Nahtpositionen
    const center = getPolygonCenter(polygon);

    // Nahtwinkel: Alle Ringe starten bei der gleichen Winkelposition
    // Wir wählen den Winkel des ersten Punkts des äußeren Polygons
    const seamAngle = Math.atan2(polygon[0].y - center.y, polygon[0].x - center.x);

    // Spirale erstellen: Ringe verbinden mit konsistenten Nahtpositionen
    const spiralPoints: THREE.Vector3[] = [];

    for (let ringIdx = 0; ringIdx < rings.length; ringIdx++) {
        const ring = rings[ringIdx];

        // Finde den Punkt bei der Nahtposition (gleicher Winkel für alle Ringe)
        const startIdx = findPointAtAngle(ring, center, seamAngle);

        // Rotiere den Ring so dass er bei der Nahtposition beginnt
        const rotatedRing = rotateRing(ring, startIdx);

        // Füge alle Punkte dieses Rings hinzu
        for (const p of rotatedRing) {
            spiralPoints.push(new THREE.Vector3(p.x, p.y, 0));
        }
    }

    // Fermat-Style: Gehe wieder nach außen (in umgekehrter Reihenfolge)
    if (fermatStyle && rings.length > 1) {
        // Nahtwinkel für den Rückweg: gegenüberliegende Seite (180° versetzt)
        const returnSeamAngle = seamAngle + Math.PI;

        // Starte bei rings.length - 2, da wir gerade am innersten Ring (rings.length - 1) sind
        for (let ringIdx = rings.length - 2; ringIdx >= 0; ringIdx--) {
            const ring = rings[ringIdx];

            // Starte auf der gegenüberliegenden Seite für den Rückweg
            const startIdx = findPointAtAngle(ring, center, returnSeamAngle);
            const rotatedRing = rotateRing(ring, startIdx);

            for (const p of rotatedRing) {
                spiralPoints.push(new THREE.Vector3(p.x, p.y, 0));
            }
        }
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

    // Berechne die Order basierend auf Dichte
    // Höhere Order = mehr Details = dichteres Muster
    // 2^order Segmente pro Seite
    const targetSpacing = options.density;
    const avgSize = (width + height) / 2;
    const order = Math.max(1, Math.min(6, Math.round(Math.log2(avgSize / targetSpacing))));

    console.log(`Hilbert: Order ${order}, Ziel-Abstand: ${targetSpacing}mm`);

    // Generiere Hilbert-Kurve
    const hilbertPoints = generateHilbertPoints(order);

    // Skaliere und positioniere die Punkte - SEPARATE X/Y Skalierung für Rechtecke
    const n = Math.pow(2, order);
    const scaleFactorX = width / n;
    const scaleFactorY = height / n;

    // Zentrum für Rotation
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const angleRad = options.angle * Math.PI / 180;

    // Transformiere alle Punkte
    const transformedPoints: THREE.Vector2[] = [];
    for (const hp of hilbertPoints) {
        let x = bounds.minX + hp.x * scaleFactorX + scaleFactorX / 2;
        let y = bounds.minY + hp.y * scaleFactorY + scaleFactorY / 2;

        if (options.angle !== 0) {
            const dx = x - centerX;
            const dy = y - centerY;
            x = centerX + dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
            y = centerY + dx * Math.sin(angleRad) + dy * Math.cos(angleRad);
        }

        transformedPoints.push(new THREE.Vector2(x, y));
    }

    // Segment-basiertes Clipping: Nur zusammenhängende Segmente innerhalb des Polygons
    // Statt alle Punkte zu filtern und dann zu verbinden
    const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
    let currentSegment: THREE.Vector3[] = [];
    let totalPoints = 0;

    for (let i = 0; i < transformedPoints.length; i++) {
        const point = transformedPoints[i];
        const isInside = isPointInPolygon(point, polygon);

        if (isInside) {
            currentSegment.push(new THREE.Vector3(point.x, point.y, 0));
            totalPoints++;
        } else {
            // Punkt ist außerhalb - aktuelles Segment beenden wenn vorhanden
            if (currentSegment.length >= 2) {
                const geometry = new THREE.BufferGeometry().setFromPoints(currentSegment);
                const line = new THREE.Line(geometry, material.clone());
                line.name = 'Infill_Hilbert';
                infillLines.push(line);
            }
            currentSegment = [];
        }
    }

    // Letztes Segment hinzufügen
    if (currentSegment.length >= 2) {
        const geometry = new THREE.BufferGeometry().setFromPoints(currentSegment);
        const line = new THREE.Line(geometry, material.clone());
        line.name = 'Infill_Hilbert';
        infillLines.push(line);
    }

    console.log(`Hilbert: ${totalPoints} Punkte, ${infillLines.length} Segmente`);
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