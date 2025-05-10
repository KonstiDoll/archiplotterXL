<template>
    <div id="mainContainer" class="relative flex flex-row h-screen w-full overflow-hidden">
        <div id='sidebar'
            class="flex flex-col w-1/4 h-full bg-slate-200 rounded-xl overflow-auto p-2 space-y-4 shrink-0">
            <div class="text-slate-800 font-semibold text-lg text-center p-2">Image-Opencv-Plotter.tech</div>
            <button class="w-fit mx-auto rounded-xl p-2 bg-slate-400 hover:bg-slate-500 active:bg-slate-600 ">
                <PhotoIcon class="h-16" />
            </button>
            <button class="w-fit mx-auto rounded-xl p-2 bg-slate-400 hover:bg-slate-500 active:bg-slate-600 ">
                <CubeIcon class="h-16" />
            </button>
            
            <!-- Tool-Auswahl -->
            <div class="w-full bg-slate-800 p-2 overflow-auto">
                <h3 class="text-white mb-2 text-center">Werkzeuge und Stift-Zuordnung</h3>
                <div class="space-y-3">
                    <div v-for="(tool, index) in tools" :key=index 
                        class="flex flex-row items-center space-x-2">
                        <!-- Tool-Button -->
                        <div 
                            class="bg-slate-400 h-14 !w-14 rounded-lg flex flex-col items-center justify-center hover:bg-slate-500 hover:cursor-pointer active:bg-orange-700" 
                            :class="activeToolIndex==index+1?'!bg-orange-700':''  " 
                            @click="setActiveToolIndex(index+1)">
                            <div>{{tool.name}}</div>
                        </div>
                        
                        <!-- Stift-Selektor für dieses Werkzeug -->
                        <select 
                            v-model="toolPenTypes[index]" 
                            class="p-1 flex-grow border rounded bg-white">
                            <option v-for="pen in availablePens" :key="pen" :value="pen">
                                {{ pen }}
                            </option>
                        </select>
                    </div>
                </div>
                <div class="mt-2 text-xs text-white p-1 bg-slate-700 rounded">
                    Hinweis: Die Stift-Zuordnung wirkt sich auf alle SVGs aus, die mit dem entsprechenden Werkzeug gezeichnet werden.
                </div>
            </div>

        </div>
        <div id="content" class="relative flex flex-col w-3/4 h-full p-6 bg-slate-200/0 rounded-xl overflow-auto">

            <div
                class="relative flex flex-col justify-center items-center text-center w-full !h-28 p-6 hover:bg-slate-200/80 outline-dashed outline-2 rounded-lg outline-slate-300 hover:outline-offset-4">
                <button>Datei
                    hochladen</button>
                <label class="text-slate-600">oder hier ablegen</label>
                <input class="opacity-0 absolute w-full h-full" type="file" @change="handleImageUpload" accept="*" />

            </div>
            
            <!-- Liste der geladenen SVGs -->
            <div class="my-4 p-3 bg-slate-100 rounded-lg" v-if="store.svgItems.length > 0">
                <h3 class="font-semibold mb-2">Geladene Dateien ({{ store.svgItems.length }})</h3>
                <ul class="space-y-2">
                    <li v-for="(item, index) in store.svgItems" :key="index" 
                        class="flex items-center justify-between p-2 bg-white rounded shadow-sm">
                        <div class="flex items-center grow">
                            <span class="truncate max-w-xs">{{ item.fileName }}</span>
                        </div>
                        
                        <!-- Tool-Auswahl für diesen SVG -->
                        <div class="mx-2 flex items-center">
                            <span class="text-sm mr-2">Tool:</span>
                            <select 
                                v-model="item.toolNumber" 
                                class="p-1 w-16 border rounded text-sm"
                                @change="changeToolNumber(index, item.toolNumber)">
                                <option v-for="i in 9" :key="i" :value="i">{{ i }}</option>
                            </select>
                        </div>
                        
                        <!-- Buttons zum Verschieben der Reihenfolge -->
                        <div class="flex items-center space-x-1 mr-2">
                            <button 
                                @click="store.moveItemUp(index)" 
                                class="bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded text-sm"
                                :disabled="index === 0"
                                :class="{'opacity-50 cursor-not-allowed': index === 0}">
                                ↑
                            </button>
                            <button 
                                @click="store.moveItemDown(index)" 
                                class="bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded text-sm"
                                :disabled="index === store.svgItems.length - 1"
                                :class="{'opacity-50 cursor-not-allowed': index === store.svgItems.length - 1}">
                                ↓
                            </button>
                        </div>
                        
                        <button @click="removeItem(index)" 
                            class="text-red-500 hover:text-red-700 px-2 ml-2">
                            &times;
                        </button>
                    </li>
                </ul>
                <div class="flex justify-end mt-3">
                    <button @click="store.clearSVGItems()" 
                        class="bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200">
                        Alle löschen
                    </button>
                </div>
            </div>
            
            <div id="controls" class="mb-4">
                <button
                    class="flex w-fit flex-col items-center rounded-xl p-2 bg-sky-400/50 hover:bg-sky-400/70 active:bg-sky-400/90"
                    @click="generateGcode">
                    <PhotoIcon class="h-16" />
                    <div>GCODE generieren</div>
                </button>
            </div>
            
            <div class="flex flex-row flex-grow h-full">
                <div class="w-1/2 h-full">
                    <ThreejsScene :activeToolIndex="activeToolIndex" class="h-full" />
                </div>
                <div class="w-1/2 pl-4 h-full">
                    <textarea class="h-full w-full bg-slate-100 p-2 rounded" v-model="gCode"></textarea>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { CubeIcon, PhotoIcon } from '@heroicons/vue/24/solid'
import { markRaw, ref, computed } from 'vue';
import ThreejsScene from './ThreejsScene.vue';
import * as THREE from 'three';
import { getThreejsObjectFromSvg } from '../utils/threejs_services';
import { useMainStore } from '../store';
import { createGcodeFromLineGroup, availablePens } from '../utils/gcode_services';
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
const activeToolIndex = ref(1);
// Jedes Werkzeug hat seinen eigenen Stift-Typ
const toolPenTypes = ref<string[]>(tools.map(() => 'stabilo'));

// Computed property für den aktiven Stift basierend auf dem aktiven Werkzeug
const activePenType = computed(() => {
    // Indizes sind um 1 verschoben: Werkzeug 1 ist an Index 0
    return toolPenTypes.value[activeToolIndex.value - 1];
});

// Stift-Typ für ein SVG-Item ändern
const changePenType = (index: number, penType: string) => {
    store.updateSVGItemPenType(index, penType);
}

// Werkzeug für ein SVG-Item ändern
const changeToolNumber = (index: number, toolNumber: number) => {
    store.updateSVGItemTool(index, toolNumber);
}

const setActivePenIndex=(index:number)=>{
    activePenIndex.value = index;
}
const setActiveToolIndex=(index:number)=>{
    activeToolIndex.value = index;
}

// Entfernt ein SVG-Item aus der Liste
const removeItem = (index: number) => {
    store.removeSVGItem(index);
}

const handleImageUpload = (e: any) => {
    uploadedFile.value = e.target.files;
    if (uploadedFile.value.length > 0) {
        loadedFile.value = uploadedFile.value[0];
        const fileName = loadedFile.value.name;
        const reader = new FileReader();
        reader.onload = async function (event) {
            if (event.target) {
                const contents = event.target.result as string;
                // Load SVG with original positions
                const lineGeoGroup = await getThreejsObjectFromSvg(contents);
                
                // Verwende den Stifttyp, der mit dem aktuellen Werkzeug verknüpft ist
                const currentPenType = toolPenTypes.value[activeToolIndex.value - 1];
                
                // Speichere die SVG mit dem aktuell ausgewählten Werkzeug und Stifttyp
                store.addSVGItem(markRaw(lineGeoGroup), activeToolIndex.value, fileName, currentPenType);
                
                console.log(`SVG "${fileName}" mit Tool #${activeToolIndex.value} und Stift "${currentPenType}" geladen`);
            }
        };  
        reader.readAsText(loadedFile.value);      
    }
}

const generateGcode = () => {
    // Generiert G-Code für alle geladenen SVGs
    if (store.svgItems.length === 0) {
        alert("Keine Dateien geladen!");
        return;
    }
    
    let combinedGcode = "";
    
    // G-Code für jede SVG mit entsprechendem Werkzeug in der angezeigten Reihenfolge generieren
    store.svgItems.forEach((item, index) => {
        // Verwende den aktuellen Stifttyp für das Werkzeug
        // Beachte: Tool-Nummern beginnen bei 1, Array-Indizes bei 0
        const currentPenType = toolPenTypes.value[item.toolNumber - 1];
        
        // Verwende den aktuellen Stifttyp anstelle des gespeicherten Stifttyps
        const svgGcode = createGcodeFromLineGroup(item.geometry, item.toolNumber, currentPenType);
        
        combinedGcode += `\n; --- SVG #${index+1}: ${item.fileName} mit Tool #${item.toolNumber} und Stift "${currentPenType}" ---\n`;
        combinedGcode += svgGcode;
    });
    
    gCode.value = combinedGcode;
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
