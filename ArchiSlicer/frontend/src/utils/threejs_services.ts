import * as THREE from 'three';
//@ts-ignore
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader';
import { computed } from 'vue';

export function getThreejsObjectFromSvg(svgContent: string): Promise<THREE.Group> {
    const loader = new SVGLoader();
    const svg = loader.parse(svgContent);

    const paths: THREE.ShapePath[] = svg.paths;
    const group = new THREE.Group();
    paths.forEach((shapePath) => {
        const randomColor = Math.floor(Math.random() * 0xffffff);
        const material = new THREE.LineBasicMaterial({
            color: randomColor,
        });
        shapePath.subPaths.forEach((subPath: THREE.Line) => {
            // Get points from the subPath
            // If the subPath contains curves, you might want to get more points for a smoother line
            const points: THREE.Vector2[] = subPath.getPoints();
            // Create a geometry from the points
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            // Create a line from the geometry and material
            const line = new THREE.Line(geometry, material);
            line.userData = shapePath.userData;
            if (subPath.curves.length > 1) {
                const isClosed = computed(() => {
                    if (subPath.autoClose) {
                        return true;
                    }
                    if (subPath.curves[0].v1.x === subPath.curves[subPath.curves.length - 1].v2.x && subPath.curves[0].v1.y === subPath.curves[subPath.curves.length - 1].v2.y) {
                        return true;
                    }
                })
                line.userData.isClosed = isClosed.value;
            }
            group.add(line);
        });
    });
    //chech for closedPaths and create shapes from them
    
    const closedPaths = paths.filter((path) => path.userData.isClosed);
    const closedShapes = createShapesForClosedPaths(closedPaths);
    closedShapes.forEach((shape) => {
        // group.add(shape);
    });

    return group;
}
export function createShapesForClosedPaths(paths: THREE.ShapePath[]): THREE.Mesh[] {

    return paths.map((path) => {
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