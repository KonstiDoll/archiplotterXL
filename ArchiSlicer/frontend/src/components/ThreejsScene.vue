<template>
    <div class="relative h-[512px] w-[512px] overflow-hidden" id="threejs-map" ref="threejsMap">
    </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch, markRaw, shallowRef } from 'vue';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as THREE from 'three';
import { useMainStore } from '../store';
const store = useMainStore();
const addableObject = shallowRef<THREE.Group>();
watch(() => store.lineGeometry, (newVal) => {
    if (newVal) {
        addableObject.value = markRaw(newVal);
        addableObject.value.rotateX(Math.PI);
        scene.add(addableObject.value);
    }
})
const threejsMap = ref<HTMLElement>();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 20, 10000);
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
const domElement = renderer.domElement;
camera.position.set(0, 0, 5000);
const controller = new OrbitControls(camera, domElement);
controller.enableDamping = true;
controller.update();
const geometry = new THREE.BoxGeometry(100, 100, 100);
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
scene.background = new THREE.Color(0x051935);
// scene.add(cube);

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