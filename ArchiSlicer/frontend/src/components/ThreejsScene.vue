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
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 20, 10000);
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
// Transparenter Hintergrund, damit CSS-Gradient sichtbar ist
renderer.setClearColor(0x000000, 0);
const domElement = renderer.domElement;
camera.position.set(0, 0, 5000);
const controller = new OrbitControls(camera, domElement);
controller.enableDamping = true;
controller.update();
// Kein Three.js Hintergrund - CSS übernimmt
scene.background = null;

// Collection of objects added to scene
const addedObjects = ref<THREE.Group[]>([]);

// Watch for compatibility with old setup
watch(() => store.lineGeometry, (newVal) => {
    if (newVal) {
        // Dieser Code wird nur für Abwärtskompatibilität behalten
        console.log("Legacy lineGeometry changed - ignoring");
    }
});

// Watch for changes to the items array
watch(() => store.svgItems, (newItems) => {
    // Entferne alle vorherigen Objekte
    addedObjects.value.forEach(obj => {
        scene.remove(obj);
    });
    
    addedObjects.value = [];
    
    // Füge alle SVGs aus dem Store zur Szene hinzu
    newItems.forEach(item => {
        const obj = markRaw(item.geometry);
        scene.add(obj);
        addedObjects.value.push(obj);
    });
    
    console.log(`Szene aktualisiert: ${addedObjects.value.length} SVGs`);
    
    // Kamera zurücksetzen, um alle Objekte zu sehen
    resetCamera();
}, { deep: true });

// Funktion zum Zurücksetzen der Kamera, um alle Objekte zu sehen
const resetCamera = () => {
    if (addedObjects.value.length === 0) return;
    
    // Berechne Bounding Box aller Objekte
    const box = new THREE.Box3();
    
    addedObjects.value.forEach(obj => {
        obj.traverse(child => {
            if (child instanceof THREE.Line) {
                box.expandByObject(child);
            }
        });
    });
    
    // Kamera so positionieren, dass alle Objekte sichtbar sind
    const center = new THREE.Vector3();
    box.getCenter(center);
    
    const size = new THREE.Vector3();
    box.getSize(size);
    
    // Abstand berechnen
    const maxDim = Math.max(size.x, size.y);
    const distance = maxDim * 2;
    
    // Kamera positionieren
    camera.position.set(center.x, center.y, distance);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
    
    // Controller zurücksetzen
    controller.target.set(center.x, center.y, 0);
    controller.update();
};

onMounted(() => {
    threejsMap.value?.appendChild(domElement);
    window.addEventListener("resize", setSize);
    setSize();
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