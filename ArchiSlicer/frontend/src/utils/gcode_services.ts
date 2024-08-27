import * as THREE from 'three';
import { ref } from 'vue';

type Pen = {
    penUp: number,
    penDown: number
}
const drawingSpeed = 3000;
const travelSpeed = 15000;

const penDrawingHeightDict: { [key: string]: Pen } = { 'stabilo': { penDown: 13, penUp: 33 }};

export function createGcodeFromLineGroup(lineGeoGroup: THREE.Group, toolNumber: number = 1, penType: string = 'stabilo'): string {
    const penUp = penDrawingHeightDict[penType].penUp;
    const moveUUp = 'G1 U' + penUp + ' F6000\n'
    const penDown = penDrawingHeightDict[penType].penDown;
    const moveUDown = 'G1 U' + penDown + ' F6000\n'
    // debugger
    let gCode = '';
    const startingGcode = 'G90\nG21\n'
    const grabTool = 'M98 P"/macros/grab_tool_' + toolNumber + '"\n'
    const placeTool = 'M98 P"/macros/place_tool_' + toolNumber + '"\n'
    const moveToDrawingHeight = 'M98 P"/macros/move_to_drawingHeight_' + penType + '"\n'

    gCode += startingGcode + grabTool + moveToDrawingHeight + moveUUp;
    lineGeoGroup.children.forEach((lineGeo: THREE.Line) => {
        const gcodeLine = createGcodeFromLine(lineGeo, moveUDown);

        gCode += gcodeLine;
        gCode += moveUUp;
    });
    gCode += placeTool;
    gCode += 'G1 Y0 F15000\n';
    return gCode;
}
function createGcodeFromLine(lineGeo: THREE.Line, moveUDown: string): string {
    let gcode = '';
    const first = ref(true);
    let speed = travelSpeed;
    lineGeo.geometry.attributes.position.array.forEach((pos: any, index: number) => {
        if (index % 3 === 0) {
            const x = pos.toFixed(2);
            const y = lineGeo.geometry.attributes.position.array[index + 1].toFixed(2);
            const z = lineGeo.geometry.attributes.position.array[index + 2].toFixed(2);
            const gcodeLine = 'G1 X' + x + ' Y' + y + ' F' + speed + '\n';
            gcode += gcodeLine;
            if (first.value) {
                gcode += moveUDown;
                first.value = false;
                speed = drawingSpeed;
            }
        }
    });
    return gcode;
}