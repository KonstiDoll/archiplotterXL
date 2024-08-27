<template>
    <div id="mainContainer" class="relative flex flex-row h-full w-full p-2">
        <div id='sidebar'
            class="flex flex-col col h-full bg-slate-200 rounded-xl overflow-hidden p-2 space-y-4 shrink-0">
            <div class="text-slate-800 font-semibold text-lg text-center p-2">Image-Opencv-Plotter.tech</div>
            <button class="w-fit mx-auto rounded-xl p-2 bg-slate-400 hover:bg-slate-500 active:bg-slate-600 ">
                <PhotoIcon class="h-16" />
            </button>
            <button class="w-fit mx-auto rounded-xl p-2 bg-slate-400 hover:bg-slate-500 active:bg-slate-600 ">
                <CubeIcon class="h-16" />
            </button>
            <div class="w-full h-fit bg-slate-800 p-2 overflow-scroll">

                <!-- <div v-for="(pen, index) in pens" :key=index class="bg-slate-400 h-20 w-20 rounded-lg flex flex-col items-center justify-center hover:bg-slate-500 hover:cursor-pointer active:bg-orange-700" :class="activePenIndex==index?'!bg-orange-700':''  " @click="setActivePenIndex(index)">
                    <div>{{pen.name}}</div>
                </div> -->
                <div v-for="(tool, index) in tools" :key=index class="bg-slate-400 h-20 w-20 rounded-lg flex flex-col items-center justify-center hover:bg-slate-500 hover:cursor-pointer active:bg-orange-700" :class="activeToolIndex==index+1?'!bg-orange-700':''  " @click="setActiveToolIndex(index+1)">
                    <div>{{tool.name}}</div>
                </div>
            </div>

        </div>
        <div id="content" class="relative flex flex-col p-6 w-full bg-slate-200/0 rounded-xl">

            <div
                class="relative flex flex-col justify-center items-center text-center w-full !h-28 p-6 hover:bg-slate-200/80  outline-dashed outline-2 rounded-lg outline-slate-300 hover:outline-offset-4">
                <button>Datei
                    hochladen</button>
                <label class="text-slate-600">oder hier ablegen</label>
                <input class="opacity-0 absolute w-full h-full" type="file" @change="handleImageUpload" accept="*" />

            </div>
            <div id="controls">
                <button
                    class="flex w-fit flex-col items-center rounded-xl p-2 bg-sky-400/50  hover:bg-sky-400/70 active:bg-sky-400/90 "
                    @click="generateGcode">
                    <PhotoIcon class="h-16" />
                    <div>GCODE generieren</div>
                </button>
            </div>
            <div class="flex flex-row">
                <ThreejsScene :activeToolIndex = "activeToolIndex"/>
                <textarea class="h-[512px] w-[512px] ml-4 bg-slate-100" v-model="gCode" name="" id=""></textarea>
                <List_order></List_order>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { CubeIcon, PhotoIcon } from '@heroicons/vue/24/solid'
import { markRaw, ref } from 'vue';
import ThreejsScene from './ThreejsScene.vue';
import * as THREE from 'three';
import { getThreejsObjectFromSvg } from '../utils/threejs_services';
import { useMainStore } from '../store';
import { createGcodeFromLineGroup } from '../utils/gcode_services';
import List_order from './list_order.vue';
const store = useMainStore();
const loadedFile = ref<File>()
const uploadedFile = ref<File[]>([])
const gCode = ref<string>('')
const selected = ref(0)
const pens = [
    { name: 'STABILO'},
    { name: 'POSCA'},
    { name: 'PINSEL'},
]
const tools = [
    { name: '1'},
    { name: '2'},
    { name: '3'},
    { name: '4'},
    { name: '5'},
    { name: '6'},
    { name: '7'},
    { name: '8'},
    { name: '9'},
]
const activePenIndex = ref(0);
const activeToolIndex=ref(1)
// 
const setActivePenIndex=(index:number)=>{
    activePenIndex.value = index;
}
const setActiveToolIndex=(index:number)=>{
    activeToolIndex.value = index;
}

const handleImageUpload = (e: any) => {
    uploadedFile.value = e.target.files;
    if (uploadedFile.value.length > 0) {
        loadedFile.value = uploadedFile.value[0];
        const reader = new FileReader();
        reader.onload = async function (event) {
            const contents = event.target.result as string;
            const lineGeoGroup = await getThreejsObjectFromSvg(contents);
            store.setLineGeometry(markRaw(lineGeoGroup));
        };  
        reader.readAsText(loadedFile.value);      
    }
}
const generateGcode = () => {
    const lineGeoGroup = store.lineGeometry;
    if (lineGeoGroup) {
        const gcode = createGcodeFromLineGroup(lineGeoGroup, activeToolIndex.value);
        gCode.value = gcode;
    }
}

function loadSVG() {
    fetch('/public/test.svg') // Adjust the path to where your SVG is located
        .then(response => response.text())
        .then(svgContent => {
            // console.log(svgContent); // Log the SVG content to the
            //parse the SVG content
            const parser = new DOMParser();
            const svg = parser.parseFromString(svgContent, 'image/svg+xml').documentElement;
            // console.log(svg);
            // get all geometry from the SVG
            const paths = svg.querySelectorAll('path');
            // console.log(paths);
            paths.forEach((path: any) => {
                const gPath = { d: path.getAttribute('d') }
                const gParts = gPath.d.split(' ');
                const gcode = createGcodeFromPath_M(gParts);
                console.log(gcode)
            });
            const rects = svg.querySelectorAll('rect');
            console.log(rects);
        })
        .catch(error => console.error('Error loading SVG:', error));
}

const createGcodeFromPath_M = (pathParts: string[]): string => {
    // create Gcode from path
    const down = ref(false);
    const first = ref(true);
    const drawingSpeed = 'F3000';
    const travelingSpeed = 'F6000';
    let gCode = '';
    pathParts.forEach((part: string) => {
        if (part === 'M') {
            down.value = true;
        }
        else if (down.value) {
            if (part.split(',').length === 2) {
                const { x, y } = { x: part.split(',')[0], y: part.split(',')[1] };
                const GIndicator = first.value ? 'G0' : 'G1';
                const speed = first.value ? travelingSpeed : drawingSpeed;
                const gCodeLine = GIndicator + ' X' + x + ' Y' + y + ' ' + speed + '\n';

                // console.log(gCodeLine);
                gCode += gCodeLine;
                if (first.value) {
                    const debugLine = ';start drawing here' + '\n';
                    gCode += debugLine;
                }
                first.value = false;
            }
            else {
                console.log('unsuspected part:', part);
                debugger
            }
        }
    })
    return gCode
}

</script>
