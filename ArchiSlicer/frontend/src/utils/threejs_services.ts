import * as THREE from 'three';
//@ts-ignore
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader';
import { computed } from 'vue';

export function getThreejsObjectFromSvg(svgContent: string, offsetX: number = 0): Promise<THREE.Group> {
    console.log("--- SVG Analyse Start ---");
    // offsetX parameter is kept for compatibility but not used anymore
    
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
        const randomColor = Math.floor(Math.random() * 0xffffff);
        const material = new THREE.LineBasicMaterial({
            color: randomColor,
        });
        shapePath.subPaths.forEach((subPath: any) => {
            // Get points from the subPath
            const points: THREE.Vector2[] = subPath.getPoints();
            
            // Create a geometry from the points
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            
            // Create a line from the geometry and material
            const line = new THREE.Line(geometry, material);
            //@ts-ignore
            line.userData = shapePath.userData;
            
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