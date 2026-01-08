<template>
    <div class="relative overflow-hidden" id="threejs-map" ref="threejsMap"
        :style="{ background: currentBackground }">
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, markRaw, computed } from 'vue';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as THREE from 'three';
import { useMainStore } from '../store';
import { gradientPresets } from '../utils/background_presets';

// Props für Hintergrund
const props = defineProps<{
    activeToolIndex: number;
    backgroundPreset?: string;
    customColor?: string;
}>();

// Berechne den aktuellen Hintergrund
const currentBackground = computed(() => {
    const preset = props.backgroundPreset || 'paper';
    if (preset === 'custom' && props.customColor) {
        return props.customColor;
    }
    return gradientPresets[preset]?.css || gradientPresets['paper'].css;
});

const store = useMainStore();
const threejsMap = ref<HTMLElement>();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 15000);
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
// Transparenter Hintergrund, damit CSS-Gradient sichtbar ist
renderer.setClearColor(0x000000, 0);
const domElement = renderer.domElement;
camera.position.set(0, 0, 5000);
const controller = new OrbitControls(camera, domElement);
controller.enableDamping = true;
// Maustasten: Links = Bewegen, Rechts = Rotieren (besser für 2D-Platzierung)
controller.mouseButtons = {
    LEFT: THREE.MOUSE.PAN,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.ROTATE
};
// Kamera-Kippen standardmäßig deaktiviert (aus Store)
controller.enableRotate = store.cameraTiltEnabled;
controller.update();

// Watch für Kamera-Kippen Einstellung
watch(() => store.cameraTiltEnabled, (enabled) => {
    controller.enableRotate = enabled;
    console.log(`Kamera-Rotation ${enabled ? 'aktiviert' : 'deaktiviert'}`);
});
// Kein Three.js Hintergrund - CSS übernimmt
scene.background = null;

// Zeichenfläche erstellen (1200x1800mm)
const CANVAS_WIDTH = 1864;
const CANVAS_HEIGHT = 1210;

const createDrawingCanvas = () => {
    const canvasGroup = new THREE.Group();
    canvasGroup.name = 'drawingCanvas';

    // Rahmen der Zeichenfläche (dünne weiße Linie)
    const borderGeometry = new THREE.BufferGeometry();
    const borderPoints = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(CANVAS_WIDTH, 0, 0),
        new THREE.Vector3(CANVAS_WIDTH, CANVAS_HEIGHT, 0),
        new THREE.Vector3(0, CANVAS_HEIGHT, 0),
        new THREE.Vector3(0, 0, 0),
    ];
    borderGeometry.setFromPoints(borderPoints);
    const borderMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff,
        opacity: 0.6,
        transparent: true
    });
    const border = new THREE.Line(borderGeometry, borderMaterial);
    canvasGroup.add(border);

    // Startpunkt-Marker (0,0) - kleines Kreuz
    const markerSize = 20;
    const markerGeometry = new THREE.BufferGeometry();
    const markerPoints = [
        // Horizontale Linie
        new THREE.Vector3(-markerSize, 0, 0),
        new THREE.Vector3(markerSize, 0, 0),
        // Vertikale Linie (als separate Line)
    ];
    markerGeometry.setFromPoints(markerPoints);
    const markerMaterial = new THREE.LineBasicMaterial({ color: 0xff6b6b });
    const markerH = new THREE.Line(markerGeometry, markerMaterial);
    canvasGroup.add(markerH);

    const markerVGeometry = new THREE.BufferGeometry();
    markerVGeometry.setFromPoints([
        new THREE.Vector3(0, -markerSize, 0),
        new THREE.Vector3(0, markerSize, 0),
    ]);
    const markerV = new THREE.Line(markerVGeometry, markerMaterial);
    canvasGroup.add(markerV);

    // Kleiner Kreis am Startpunkt
    const circleGeometry = new THREE.BufferGeometry();
    const circlePoints: THREE.Vector3[] = [];
    const segments = 32;
    const radius = 10;
    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        circlePoints.push(new THREE.Vector3(
            Math.cos(theta) * radius,
            Math.sin(theta) * radius,
            0
        ));
    }
    circleGeometry.setFromPoints(circlePoints);
    const circle = new THREE.Line(circleGeometry, markerMaterial);
    canvasGroup.add(circle);

    return canvasGroup;
};

// Zeichenfläche zur Szene hinzufügen
const drawingCanvas = createDrawingCanvas();
scene.add(drawingCanvas);

// Workpiece Start Marker erstellen
const createWorkpieceStartMarker = (x: number, y: number, name: string) => {
    const markerGroup = new THREE.Group();
    markerGroup.name = `workpieceStart_${name}`;

    const markerSize = 15;
    const markerColor = 0x00d4ff; // Cyan

    // Kreuz
    const hGeometry = new THREE.BufferGeometry();
    hGeometry.setFromPoints([
        new THREE.Vector3(-markerSize, 0, 0),
        new THREE.Vector3(markerSize, 0, 0),
    ]);
    const markerMaterial = new THREE.LineBasicMaterial({ color: markerColor });
    const markerH = new THREE.Line(hGeometry, markerMaterial);
    markerGroup.add(markerH);

    const vGeometry = new THREE.BufferGeometry();
    vGeometry.setFromPoints([
        new THREE.Vector3(0, -markerSize, 0),
        new THREE.Vector3(0, markerSize, 0),
    ]);
    const markerV = new THREE.Line(vGeometry, markerMaterial);
    markerGroup.add(markerV);

    // Kreis
    const circleGeometry = new THREE.BufferGeometry();
    const circlePoints: THREE.Vector3[] = [];
    const segments = 24;
    const radius = 8;
    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        circlePoints.push(new THREE.Vector3(
            Math.cos(theta) * radius,
            Math.sin(theta) * radius,
            0
        ));
    }
    circleGeometry.setFromPoints(circlePoints);
    const circle = new THREE.Line(circleGeometry, markerMaterial);
    markerGroup.add(circle);

    markerGroup.position.set(x, y, 0);
    return markerGroup;
};

// Gruppe für alle Workpiece Start Marker
const workpieceStartMarkers = new THREE.Group();
workpieceStartMarkers.name = 'workpieceStartMarkers';
scene.add(workpieceStartMarkers);

// Watch für Workpiece Starts
watch(() => store.workpieceStarts, (newStarts) => {
    // Alte Marker entfernen
    while (workpieceStartMarkers.children.length > 0) {
        const child = workpieceStartMarkers.children[0];
        workpieceStartMarkers.remove(child);
    }

    // Neue Marker hinzufügen
    newStarts.forEach(ws => {
        const marker = createWorkpieceStartMarker(ws.x, ws.y, ws.name);
        workpieceStartMarkers.add(marker);
    });

    console.log(`Workpiece Starts aktualisiert: ${newStarts.length} Marker`);
}, { deep: true });

// Collection of objects added to scene
const addedObjects = ref<THREE.Group[]>([]);

// Watch for compatibility with old setup
watch(() => store.lineGeometry, (newVal) => {
    if (newVal) {
        // Dieser Code wird nur für Abwärtskompatibilität behalten
        console.log("Legacy lineGeometry changed - ignoring");
    }
});

// Track previous item count to detect adds/removes
let previousItemCount = 0;

// Watch for changes to the items array - but DON'T reset camera on every change
watch(() => store.svgItems, (newItems) => {
    // Entferne alle vorherigen Objekte
    addedObjects.value.forEach(obj => {
        scene.remove(obj);
    });

    addedObjects.value = [];

    // Füge alle SVGs aus dem Store zur Szene hinzu
    newItems.forEach(item => {
        const obj = markRaw(item.geometry);

        // NEW: Filter visibility by color if analyzed
        if (item.isAnalyzed && item.colorGroups.length > 0) {
            // Create visibility map
            const visibilityMap = new Map<string, boolean>();
            item.colorGroups.forEach(cg => {
                visibilityMap.set(cg.color.toLowerCase(), cg.visible);
            });

            // Traverse and hide invisible lines
            obj.traverse((child) => {
                if (child instanceof THREE.Line) {
                    const lineColor = (child.userData?.effectiveColor || '#000000').toLowerCase();
                    const isVisible = visibilityMap.get(lineColor) ?? true;
                    child.visible = isVisible;
                }
            });
        }

        // Offset anwenden (SVG-Ursprung an Workpiece Start setzen)
        obj.position.set(item.offsetX, item.offsetY, 0);
        scene.add(obj);
        addedObjects.value.push(obj);
    });

    console.log(`Szene aktualisiert: ${addedObjects.value.length} SVGs`);

    // NUR Kamera zurücksetzen wenn Items hinzugefügt oder entfernt wurden
    // NICHT bei Infill-Änderungen, Farb-Analyse, etc.
    const currentCount = newItems.length;
    if (currentCount !== previousItemCount) {
        // Neues Item wurde hinzugefügt - zoom auf das neue
        if (currentCount > previousItemCount && currentCount > 0) {
            const lastItem = newItems[currentCount - 1];
            zoomToGeometry(lastItem.geometry);
        } else if (currentCount === 0) {
            resetCameraToCanvas();
        }
        previousItemCount = currentCount;
    }
}, { deep: true });

// Funktion zum Zurücksetzen der Kamera auf die Zeichenfläche
const resetCameraToCanvas = () => {
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;
    const distance = Math.max(CANVAS_WIDTH, CANVAS_HEIGHT) * 1.5;

    camera.position.set(centerX, centerY, distance);
    camera.lookAt(new THREE.Vector3(centerX, centerY, 0));
    camera.updateProjectionMatrix();

    controller.target.set(centerX, centerY, 0);
    controller.update();
};

// Funktion zum Zoomen auf eine bestimmte Geometrie
const zoomToGeometry = (geometry: THREE.Group) => {
    const box = new THREE.Box3();

    geometry.traverse(child => {
        if (child instanceof THREE.Line) {
            box.expandByObject(child);
        }
    });

    // Fallback wenn Box leer ist
    if (box.isEmpty()) {
        resetCameraToCanvas();
        return;
    }

    // Kamera so positionieren, dass die Geometrie sichtbar ist
    const center = new THREE.Vector3();
    box.getCenter(center);

    const size = new THREE.Vector3();
    box.getSize(size);

    // Abstand berechnen (mit etwas Padding)
    const maxDim = Math.max(size.x, size.y);
    const distance = maxDim * 1.8; // Etwas mehr Abstand für bessere Übersicht

    // Kamera positionieren
    camera.position.set(center.x, center.y, distance);
    camera.lookAt(center);
    camera.updateProjectionMatrix();

    // Controller zurücksetzen
    controller.target.set(center.x, center.y, 0);
    controller.update();

    console.log(`Kamera auf Geometrie gezoomt: Center(${center.x.toFixed(1)}, ${center.y.toFixed(1)}), Distanz: ${distance.toFixed(1)}`);
};

onMounted(() => {
    threejsMap.value?.appendChild(domElement);
    window.addEventListener("resize", setSize);
    setSize();
    // Kamera initial auf die Zeichenfläche ausrichten
    resetCameraToCanvas();
    animate();
});

const divSize = ref({ width: 0, height: 0 });
const setSize = () => {
    divSize.value.width = threejsMap.value?.clientWidth || 0;
    divSize.value.height = threejsMap.value?.clientHeight || 0;
    camera.aspect = divSize.value.width / divSize.value.height;
    camera.updateProjectionMatrix();

    renderer.setSize(divSize.value.width, divSize.value.height);
    renderer.setPixelRatio(window.devicePixelRatio);
};

const animate = function () {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
    controller.update();
};  
</script>

<style>
/* Your component's styles go here */
</style>