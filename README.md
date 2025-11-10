# ArchiplotterXL

A large-scale, multi-tool automated drawing and plotting machine with automatic tool changing capabilities. The ArchiplotterXL is designed for creating large-format artwork, technical drawings, and creative visualizations using up to 8 different pens or drawing tools.

## Overview

ArchiplotterXL is a CNC-based plotting system with a working area of **1450mm x 1864mm** (approximately 1.45m x 1.86m). It features an automated 8-tool changer system, mesh bed compensation for surface flatness, and a comprehensive software ecosystem for converting digital artwork into physical drawings.

### Key Features

- **Large Working Area**: 1450mm x 1864mm drawing surface
- **8-Tool Automatic Tool Changer**: Switch between different pens, markers, or drawing tools automatically
- **Multi-Axis Control**: X, Y (dual motor), Z, and U axes with sensorless homing
- **Mesh Bed Compensation**: Automatic surface height mapping for consistent drawing quality
- **Web-Based Slicer**: ArchiSlicer for SVG to G-code conversion with real-time visualization
- **PrusaSlicer Integration**: Use PrusaSlicer's multi-material workflow for complex multi-color drawings
- **String Art Generation**: Built-in tools for creating circular string art patterns

## Hardware

### Controller
- **Duet WiFi** running RepRapFirmware 3.3
- Network-enabled with fixed IP configuration
- Sensorless homing on all axes

### Mechanical Specifications
- **Working Area**: 1450mm (X) × 1864mm (Y) × 70mm (Z)
- **Drive System**: Dual X-axis motors, microstepping up to 256
- **Positioning Accuracy**: Sub-millimeter precision with mesh compensation
- **Tool Capacity**: 8 tool positions with automatic changing

### Axes Configuration
- **X-axis**: Dual motor (synchronized), 1450mm travel
- **Y-axis**: 1864mm travel
- **Z-axis**: 70mm travel (bed height adjustment)
- **U-axis**: 34.6mm travel (pen up/down mechanism)

## Software Components

### ArchiSlicer

A web-based application for converting SVG files to G-code specifically formatted for the ArchiplotterXL.

**Features:**
- SVG file upload and parsing
- Real-time 3D visualization using Three.js
- Tool selection (1-8)
- Interactive tool order management with drag-and-drop
- Direct G-code generation and preview

**Technology Stack:**
- Frontend: Vue.js 3, TypeScript, Tailwind CSS, Three.js
- Backend: Python FastAPI
- Build Tool: Vite

**Usage:**
```bash
cd ArchiSlicer/frontend
npm install
npm run dev
```

Access the application at `http://localhost:5173`

### PrusaSlicer Workflow

For complex multi-color drawings, you can use PrusaSlicer with the included configuration bundle:

1. Load `PrusaSlicer/PrusaSlicer_8_colors_config_bundle.ini` in PrusaSlicer
2. Import your 3D model or use the provided `Archiplotter_8_Farben.3mf` template
3. Assign different colors to different tools (1-8)
4. Export G-code
5. Run postprocessing script to convert for ArchiplotterXL

### Postprocessing Scripts

The postprocessing scripts convert PrusaSlicer G-code to ArchiplotterXL-compatible format:

**Main Script**: `Postprocessing/ArchiplotterUpscale_postprocess_Prusaslicer.py`

**Features:**
- Coordinate upscaling (2x factor by default)
- Z-axis to U-axis conversion (pen up/down)
- Optional ink pump control at configurable intervals
- Custom homing sequences
- Tool-specific U-axis positioning

**Configuration:**
```python
hasHoming = False       # Enable/disable homing sequence
upscale = True          # Enable coordinate scaling
factor = 2              # Scaling factor
pump_distance = 0       # Distance between pumping actions (0 to disable)
```

**Usage:**
```bash
python3 Postprocessing/ArchiplotterUpscale_postprocess_Prusaslicer.py your_file.gcode
```

The script requires custom G-code in PrusaSlicer's start G-code:
```gcode
;uValueDown=13
;uValueUp=25
```

### String Art Generator

Generate circular string art patterns for the plotter:

```bash
cd stringart
python3 stringart.py
```

**Configuration:**
- `num_points`: Number of points around the circle (default: 288)
- `radius`: Circle radius in millimeters (default: 500mm)
- `origin`: Center point coordinates

Output is saved to `points.csv` for further processing.

## Directory Structure

```
archiplotterXL/
├── ArchiSlicer/          # Web-based SVG to G-code converter
│   ├── frontend/         # Vue.js application
│   └── backend/          # FastAPI server
├── Firmware/             # Controller firmware files
│   ├── Drucker/          # Printer firmware
│   └── Duet3Firmware_Mini5plus.uf2
├── Gcodes/               # Sample G-code files
├── Makros/               # G-code macros for tool operations
│   ├── grab_tool_*       # Tool pickup sequences
│   ├── place_tool_*      # Tool placement sequences
│   ├── open_grabber      # Grabber control
│   └── close_grabber
├── Postprocessing/       # PrusaSlicer postprocessing scripts
├── PrusaSlicer/          # PrusaSlicer configuration
│   └── PrusaSlicer_8_colors_config_bundle.ini
├── stringart/            # String art generation tools
└── SystemFolder/         # Duet controller configuration
    ├── config.g          # Main configuration
    ├── home*.g           # Homing sequences
    └── heightmap*.csv    # Mesh bed compensation data
```

## G-code Macros

The `Makros/` directory contains essential G-code macros:

### Tool Changing
- `grab_tool_[1-8]`: Pick up a specific tool
- `place_tool_[1-8]`: Return a tool to its holder
- `move_in_front_of_tools`: Position for tool access

### Pen Control
- `move_to_drawingHeight_stabilo`: Set pen to drawing height
- `open_grabber` / `close_grabber`: Tool grabber control

### Demo and Testing
- `demo.g`: Demonstration sequence
- `grabber_demo`: Grabber mechanism test

## Configuration

### Main Configuration (`SystemFolder/config.g`)

Key settings:
- Network: Fixed IP `192.168.3.126`
- Microstepping: 256 steps (X,Y,Z), 16 steps (U)
- Motor currents optimized for large-format plotting
- Mesh bed leveling enabled with 150mm grid spacing

### Mesh Bed Compensation

Multiple heightmaps are stored in `SystemFolder/` for different setups. Active heightmap is loaded with `G29 S1` in tool-change macros.

## Workflow

### Basic Drawing Workflow

1. **Prepare artwork**:
   - Create or convert artwork to SVG format
   - Optimize paths for continuous drawing where possible

2. **Generate G-code**:
   - **Option A**: Use ArchiSlicer web interface for SVG files
   - **Option B**: Use PrusaSlicer with postprocessing for complex multi-color work

3. **Load and configure**:
   - Transfer G-code to Duet controller
   - Ensure correct tools are loaded in positions 1-8
   - Verify mesh bed compensation is active

4. **Execute**:
   - Start the print job from Duet Web Control
   - Monitor tool changes and drawing progress

### Multi-Color Drawing with PrusaSlicer

1. Load the 8-color configuration bundle
2. Import your model or create 2D shapes
3. Assign colors to different regions (each color = one tool)
4. Export G-code with appropriate layer height (e.g., 0.4mm)
5. Run postprocessing script
6. Upload to ArchiplotterXL

## Safety and Maintenance

### Safety Precautions
- Ensure drawing surface is properly secured
- Verify tool positions before starting
- Monitor first tool change to ensure proper operation
- Keep fingers clear of moving axes

### Maintenance
- Regularly clean tool holders and grabber mechanism
- Check belt tension on X and Y axes
- Update mesh bed compensation when changing drawing surfaces
- Verify pen ink levels before long drawing jobs

## Technical Specifications

| Specification | Value |
|--------------|-------|
| Working Area | 1450mm × 1864mm |
| Maximum Speed (X,Y) | 20,000 mm/min |
| Maximum Speed (Z) | 1,000 mm/min |
| Maximum Speed (U) | 20,000 mm/min |
| Positioning Resolution | 256 microsteps |
| Tool Capacity | 8 tools |
| Controller | Duet WiFi (RRF 3.3) |
| Network | WiFi, Fixed IP |

## Contributing

Contributions are welcome! Areas for improvement:
- Enhanced SVG parsing in ArchiSlicer
- Additional pen profiles and settings
- Optimization algorithms for drawing path efficiency
- Support for additional file formats

## License

MIT License - see [LICENSE](LICENSE) file for details

Copyright (c) 2023 Knstdll

## Credits

Developed by KonstiDoll

ArchiSlicer includes components for SVG processing, Three.js visualization, and G-code generation specifically tailored for large-format multi-tool plotting applications.
