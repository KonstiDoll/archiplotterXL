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
import type { PathRole } from '../utils/geometry/path-analysis';
import { getEffectiveRole } from '../utils/geometry/path-analysis';

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

// ===== Hole Editor Mode: Raycaster und Overlays =====
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Gruppe für Hole-Editor Overlays
const holeEditorGroup = new THREE.Group();
holeEditorGroup.name = 'holeEditorOverlays';
scene.add(holeEditorGroup);

// Farben für die verschiedenen Path-Rollen
const ROLE_COLORS: Record<PathRole, number> = {
  'outer': 0x22c55e,        // Grün
  'hole': 0xef4444,         // Rot
  'nested-object': 0x3b82f6 // Blau
};

// Hole Editor Overlays erstellen
const createHoleEditorOverlays = () => {
  clearHoleEditorOverlays();

  store.svgItems.forEach((item, svgIndex) => {
    if (!item.pathAnalysis) return;

    item.pathAnalysis.paths.forEach(path => {
      const role = getEffectiveRole(path);

      // Shape aus Polygon erstellen
      const shape = new THREE.Shape();
      if (path.polygon.length > 0) {
        shape.moveTo(path.polygon[0].x, path.polygon[0].y);
        for (let i = 1; i < path.polygon.length; i++) {
          shape.lineTo(path.polygon[i].x, path.polygon[i].y);
        }
        shape.closePath();
      }

      const geometry = new THREE.ShapeGeometry(shape);
      const material = new THREE.MeshBasicMaterial({
        color: ROLE_COLORS[role],
        opacity: 0.35,
        transparent: true,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData = { pathId: path.id, svgIndex };
      // Z-Position basierend auf Verschachtelungstiefe: Innere Pfade weiter vorne
      // damit sie beim Klick priorisiert werden (Raycaster trifft nähere Objekte zuerst)
      const zOffset = 0.1 + path.containmentDepth * 0.05;
      mesh.position.set(item.offsetX, item.offsetY, zOffset);

      // Gelber Rand wenn Override vorhanden
      if (path.userOverriddenRole) {
        const edgeGeometry = new THREE.EdgesGeometry(geometry);
        const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xfbbf24 });
        const edge = new THREE.LineSegments(edgeGeometry, edgeMaterial);
        mesh.add(edge);
      }

      holeEditorGroup.add(mesh);
    });
  });
};

// Hole Editor Overlays entfernen
const clearHoleEditorOverlays = () => {
  while (holeEditorGroup.children.length > 0) {
    const child = holeEditorGroup.children[0];
    // Dispose geometry and material
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (child.material instanceof THREE.Material) {
        child.material.dispose();
      }
      // Dispose edge children
      child.children.forEach(c => {
        if (c instanceof THREE.LineSegments) {
          c.geometry.dispose();
          if (c.material instanceof THREE.Material) {
            c.material.dispose();
          }
        }
      });
    }
    holeEditorGroup.remove(child);
  }
};

// Click-Handler für Hole Editor
const onCanvasClick = (event: MouseEvent) => {
  if (!store.holeEditorMode) return;
  if (!threejsMap.value) return;

  const rect = threejsMap.value.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  // Intersect mit Overlay-Meshes
  const intersects = raycaster.intersectObjects(holeEditorGroup.children);
  if (intersects.length > 0) {
    const pathId = intersects[0].object.userData.pathId as string;
    const svgIndex = intersects[0].object.userData.svgIndex as number;
    store.cyclePathRole(svgIndex, pathId);
  }
};

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

// Watch für Hole Editor Mode
watch(() => store.holeEditorMode, (enabled) => {
    if (enabled) {
        createHoleEditorOverlays();
    } else {
        clearHoleEditorOverlays();
    }
});

// Watch für pathAnalysis-Änderungen (wenn Rolle geändert wird)
watch(() => store.svgItems.map(i => i.pathAnalysis), () => {
    if (store.holeEditorMode) {
        createHoleEditorOverlays();
    }
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

        // Filter visibility by color if analyzed
        if (item.isAnalyzed && item.colorGroups.length > 0) {
            // Create visibility and showOutlines maps
            const visibilityMap = new Map<string, boolean>();
            const showOutlinesMap = new Map<string, boolean>();
            item.colorGroups.forEach(cg => {
                visibilityMap.set(cg.color.toLowerCase(), cg.visible);
                showOutlinesMap.set(cg.color.toLowerCase(), cg.showOutlines);
            });

            // Traverse and hide invisible lines / outlines
            obj.traverse((child) => {
                if (child instanceof THREE.Line) {
                    const lineColor = (child.userData?.effectiveColor || '#000000').toLowerCase();
                    const isVisible = visibilityMap.get(lineColor) ?? true;
                    const showOutlines = showOutlinesMap.get(lineColor) ?? true;

                    // Check if this is an infill line (name starts with "Infill_")
                    const isInfillLine = child.name.startsWith('Infill_');

                    if (!isVisible) {
                        // Color completely hidden
                        child.visible = false;
                    } else if (!showOutlines && !isInfillLine) {
                        // Outlines hidden, but this is a contour line (not infill)
                        child.visible = false;
                    } else {
                        child.visible = true;
                    }
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
        // Neues Item wurde hinzugefügt - zoom auf das neue (mit Offset)
        if (currentCount > previousItemCount && currentCount > 0) {
            const lastItem = newItems[currentCount - 1];
            zoomToGeometry(lastItem.geometry, lastItem.offsetX, lastItem.offsetY);
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

// Funktion zum Zoomen auf eine bestimmte Geometrie (mit Offset-Berücksichtigung)
const zoomToGeometry = (geometry: THREE.Group, offsetX: number = 0, offsetY: number = 0) => {
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

    // Offset hinzufügen (Workpiece Start Position)
    center.x += offsetX;
    center.y += offsetY;

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
    // Click-Handler für Hole Editor
    domElement.addEventListener('click', onCanvasClick);
    setSize();
    // Kamera initial auf die Zeichenfläche ausrichten
    resetCameraToCanvas();
    // Initiale Workpiece Start Marker erstellen
    store.workpieceStarts.forEach(ws => {
        const marker = createWorkpieceStartMarker(ws.x, ws.y, ws.name);
        workpieceStartMarkers.add(marker);
    });
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