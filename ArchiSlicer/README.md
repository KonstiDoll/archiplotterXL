# 🎨 ArchiSlicer

**Multi-Layer SVG Slicer for Plotters with Automatic Tool Changer**

ArchiSlicer is a modern web-based slicing application that converts SVG files into optimized G-Code for pen plotters and CNC machines. Designed specifically for machines with automatic tool changers, it enables complex multi-color, multi-layer artwork creation with intelligent path optimization and advanced pattern generation.

---

## 🚀 Vision

ArchiSlicer aims to be the definitive toolchain for artists and engineers working with pen plotters and CNC machines. By combining intuitive UI/UX with powerful slicing algorithms, it bridges the gap between digital designs and physical artwork.

**Core Philosophy:**
- 🎯 **Streamlined Workflow** - From SVG upload to G-Code export in seconds
- 🎨 **Multi-Tool Support** - Manage multiple pens/tools with individual settings
- 🧩 **Layer Intelligence** - Automatic layer-to-tool mapping and optimization
- 📐 **Pattern Generation** - Create hatching, fills, and artistic effects
- ⚡ **Path Optimization** - Minimize travel time and pen changes

---

## ✨ Features

### ✅ Currently Implemented

- **SVG Upload & Parsing**
  - Drag-and-drop SVG file upload
  - Real-time parsing with Three.js SVGLoader
  - Support for paths, shapes, and complex geometries

- **3D Visualization**
  - Interactive Three.js preview
  - OrbitControls for camera manipulation
  - Color-coded path visualization
  - Real-time scene updates

- **Tool Management**
  - 9-tool automatic tool changer support
  - Visual tool selection interface
  - Tool-specific G-Code generation

- **G-Code Generation**
  - RepRap-compatible G-Code output
  - Automatic tool change macros (`M98 P"/macros/grab_tool_X"`)
  - Pen height control via U-axis (configurable pen up/down positions)
  - Travel and drawing speed configuration
  - G90 (absolute positioning) and G21 (metric units)

- **Export**
  - Real-time G-Code preview
  - Copy-to-clipboard functionality
  - Download as `.gcode` file with auto-generated filename

### 🚧 In Development

- **Multi-Layer Processing**
  - Load SVGs with multiple layers/groups
  - Upload multiple SVG files sequentially
  - Layer-to-tool assignment interface
  - Visual layer management panel

- **Advanced Pen/Tool Management**
  - Create custom pen profiles
  - Per-pen settings: color, speed, height, width
  - Pen library with save/load functionality
  - Material presets (marker, technical pen, brush, etc.)

- **Path Processing & Optimization**
  - Traveling Salesman Problem (TSP) optimization
  - Minimize pen changes and travel distance
  - Path sorting strategies (nearest neighbor, optimal order)
  - Collision detection and avoidance

- **Fill Pattern Generation**
  - **Outlines** - Stroke generation from closed shapes
  - **Hatching** - Parallel line fills with configurable angle and spacing
  - **Cross-Hatching** - Dual-angle hatching patterns
  - **Stippling** - Dot-based fills with density control
  - **Custom Patterns** - User-defined fill algorithms

- **Enhanced UI/UX**
  - Complete interface redesign
  - Contextual tooltips and help system
  - Settings panels with real-time preview
  - Responsive workflow guides
  - Keyboard shortcuts

### 📋 Planned (Phase 2)

- **Image Processing (Backend)**
  - Bitmap-to-vector conversion using OpenCV
  - Edge detection and tracing
  - Halftone and dithering algorithms
  - Image filters and effects
  - Multi-format input (PNG, JPG, TIFF, etc.)

- **Advanced Features**
  - Project save/load functionality
  - Batch processing for multiple files
  - G-Code simulation and time estimation
  - Custom machine profiles
  - Cloud processing for heavy operations

---

## 🎯 Quick Start

### Prerequisites

- **Node.js** 20+ and npm
- **Python** 3.11+ (for backend, optional for current version)
- **Docker** and Docker Compose (for containerized deployment)

### Local Development

#### Frontend (Vue 3 + Three.js)

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server with HMR
npm run dev

# Access at http://localhost:5173
```

#### Backend (FastAPI) - Optional

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Start development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Access at http://localhost:8000
```

#### Production Build

```bash
# Build frontend
cd frontend
npm run build

# Serve with nginx or any static server
# Output directory: frontend/dist/
```

### Docker Deployment

```bash
# Build and start all services
docker compose up -d

# Access frontend at http://localhost
# Access backend API at http://localhost/api/

# View logs
docker compose logs -f

# Stop services
docker compose down
```

---

## 📖 User Guide

### Basic Workflow

1. **Upload SVG**
   - Click "Datei hochladen" or drag-and-drop an SVG file
   - File is parsed and visualized in 3D preview

2. **Select Tool**
   - Choose a tool/pen from the sidebar (1-9)
   - Visual feedback shows active tool

3. **Generate G-Code**
   - Click "GCODE generieren"
   - G-Code appears in the output textarea

4. **Export**
   - Copy G-Code from textarea
   - Transfer to your machine's controller
   - Start plotting!

### Planned Workflow (Future)

1. **Upload & Organize**
   - Upload single or multiple SVG files
   - Separate layers are automatically detected
   - Preview all layers in 3D view

2. **Configure Tools**
   - Assign layers to specific tools/pens
   - Set pen properties (color, speed, height)
   - Choose fill patterns for closed shapes

3. **Optimize**
   - Run path optimization algorithms
   - Preview optimized toolpath
   - Estimate plotting time

4. **Preview & Export**
   - Simulate plotting animation
   - Adjust settings if needed
   - Export optimized G-Code

---

## ⚙️ Configuration

### G-Code Settings

Current configuration (hardcoded in `frontend/src/utils/gcode_services.ts`):

```typescript
// Speeds
const drawingSpeed = 3000;   // mm/min while drawing
const travelSpeed = 15000;   // mm/min while traveling

// Pen heights (for 'stabilo' pen type)
const penUp = 33;     // U-axis position when pen is up
const penDown = 13;   // U-axis position when pen is down
```

### Machine Requirements

ArchiSlicer is designed for machines with the following capabilities:

- **Automatic Tool Changer** - 9 tool positions
- **U-Axis** - For pen height control (pen up/down)
- **G-Code Dialect** - RepRap firmware (Marlin, RepRapFirmware, etc.)
- **Macros** - Support for tool change macros:
  - `M98 P"/macros/grab_tool_1"` through `M98 P"/macros/grab_tool_9"`
  - `M98 P"/macros/place_tool_1"` through `M98 P"/macros/place_tool_9"`
  - `M98 P"/macros/move_to_drawingHeight_stabilo"` (or other pen types)

### Supported Input Formats

**Currently:**
- SVG (Scalable Vector Graphics)

**Planned:**
- DXF (AutoCAD Drawing Exchange Format)
- AI (Adobe Illustrator, via conversion)
- PNG/JPG (via backend image processing)

---

## 🔧 Technical Architecture

### Frontend Stack

- **Framework:** Vue 3 (Composition API with `<script setup>`)
- **Language:** TypeScript 5.2.2
- **Build Tool:** Vite 5.0.8
- **3D Rendering:** Three.js r163
- **State Management:** Pinia 2.1.7
- **Styling:** Tailwind CSS 3.4.1
- **UI Components:** Heroicons Vue
- **Animations:** GSAP 3.12.5
- **Debug UI:** lil-gui 0.19.1

### Backend Stack

- **Framework:** FastAPI 0.109.0
- **Server:** Uvicorn 0.25.0
- **Language:** Python 3.11
- **Image Processing:** OpenCV, Pillow, NumPy (for Phase 2)

### Project Structure

```
ArchiSlicer/
├── frontend/                   # Vue 3 + Three.js application
│   ├── src/
│   │   ├── components/
│   │   │   ├── App.vue               # Main layout container
│   │   │   ├── AppHeader.vue         # Header with logo/version
│   │   │   ├── Sidebar.vue           # Upload, SVG list, tools, settings
│   │   │   ├── ToolPanel.vue         # 9 tools with pen-type dropdowns
│   │   │   ├── SVGItemPanel.vue      # Individual SVG settings + infill
│   │   │   ├── GCodePanel.vue        # Generate, output, copy, download
│   │   │   └── ThreejsScene.vue      # 3D visualization
│   │   ├── utils/
│   │   │   ├── threejs_services.ts   # SVG → Three.js + infill patterns
│   │   │   ├── gcode_services.ts     # G-Code generation
│   │   │   └── backend_service.ts    # API communication
│   │   ├── store.ts                  # Pinia state management
│   │   └── main.ts
│   ├── public/                 # Static assets
│   ├── dist/                   # Production build output
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.js
│
├── backend/                    # FastAPI application
│   ├── main.py                 # API endpoints
│   ├── requirements.txt        # Python dependencies
│   └── Makefile
│
└── README.md                   # This file
```

### Key Algorithms

#### SVG to Three.js Conversion

Located in `frontend/src/utils/threejs_services.ts`:

1. Parse SVG content using Three.js `SVGLoader`
2. Extract paths and shapes
3. Convert to Three.js Line geometries
4. Detect closed paths for potential fill patterns
5. Assign random colors for visualization
6. Return Three.js Group object

#### G-Code Generation

Located in `frontend/src/utils/gcode_services.ts`:

1. **Initialization**
   - Set absolute positioning (`G90`)
   - Set metric units (`G21`)
   - Execute tool grab macro (`M98 P"/macros/grab_tool_X"`)
   - Move to drawing height macro

2. **Path Processing**
   - For each line in the Three.js Group:
     - Move to start point at travel speed (pen up)
     - Lower pen (`G1 U13`)
     - Draw path at drawing speed
     - Raise pen (`G1 U33`)

3. **Finalization**
   - Execute tool place macro
   - Return to origin (`G1 Y0`)

### State Management

Pinia store (`frontend/src/store.ts`) manages:

- **lineGeometry** - Current Three.js Group object from loaded SVG
- **setLineGeometry()** - Action to update geometry (used with `markRaw()` for non-reactive Three.js objects)

**Important:** Three.js objects MUST be wrapped with `markRaw()` to prevent Vue reactivity issues:

```typescript
import { markRaw } from 'vue';
store.setLineGeometry(markRaw(lineGeoGroup));
```

---

## 🛠️ Development

### Building for Production

```bash
# Frontend
cd frontend
npm run build
# Output: frontend/dist/

# Backend (if needed)
cd backend
# FastAPI is served directly, no build step
```

### Docker Build

```bash
# Build frontend image
docker build -t archislicer-frontend:latest -f ../frontend/Dockerfile .

# Build backend image
docker build -t archislicer-backend:latest -f ../backend/Dockerfile .
```

### Running Tests

```bash
# Frontend tests (if configured)
cd frontend
npm run test

# Backend tests (if configured)
cd backend
pytest
```

### Code Style

- **Frontend:** ESLint + Prettier (configured in Vite)
- **Backend:** Black + Flake8 (recommended)

---

## 🗺️ Roadmap

### Phase 1: SVG Processing (Current Focus)

- [x] Basic SVG upload and parsing
- [x] 3D preview with Three.js
- [x] Simple tool selection
- [x] Basic G-Code generation
- [ ] Multi-layer SVG support
- [ ] Multiple SVG file handling
- [ ] Advanced pen/tool management system
- [ ] Layer-to-tool assignment UI
- [ ] Path optimization (TSP)
- [ ] Fill pattern generation (hatching, cross-hatch)
- [ ] Outline generation for closed shapes
- [x] UI/UX redesign with modular components
- [ ] Tooltip system
- [ ] Settings panel with real-time preview
- [ ] G-Code simulation and preview
- [ ] Project save/load functionality
- [x] Export as `.gcode` file with auto-generated naming

### Phase 2: Image Processing (Backend)

- [ ] Backend API for image upload
- [ ] OpenCV integration for bitmap tracing
- [ ] Edge detection algorithms
- [ ] Halftone and dithering
- [ ] Multi-format image support (PNG, JPG, TIFF)
- [ ] Batch processing
- [ ] Cloud processing for heavy operations

### Phase 3: Advanced Features

- [ ] Custom machine profiles
- [ ] G-Code post-processing
- [ ] Time and material estimation
- [ ] Collision detection
- [ ] 3D surface plotting (height maps)
- [ ] Multi-pass drawing strategies
- [ ] Template library
- [ ] Community sharing platform

---

## 🐛 Troubleshooting

### Frontend Issues

**Problem:** Three.js scene not rendering

- Check browser console for WebGL errors
- Ensure browser supports WebGL 2.0
- Try disabling hardware acceleration and re-enabling

**Problem:** SVG not loading

- Verify SVG file is valid (open in browser or Inkscape)
- Check console for parsing errors
- Ensure SVG uses supported elements (paths, shapes)
- Complex SVGs with filters/effects may not be fully supported

**Problem:** G-Code output is empty

- Ensure an SVG is loaded and visible in preview
- Check that a tool is selected (1-9)
- Verify lineGeometry exists in Pinia store (check Vue DevTools)

### Backend Issues

**Problem:** Backend not starting

- Check Python version (`python --version` should be 3.11+)
- Verify all dependencies installed (`pip list`)
- Check port 8000 is not in use (`lsof -i :8000` on macOS/Linux)

**Problem:** CORS errors in browser

- Backend CORS is not configured yet (Phase 2)
- For now, frontend and backend should be served from same origin via nginx

### Docker Issues

**Problem:** Containers not starting

```bash
# Check container logs
docker compose logs

# Check specific service
docker compose logs archislicer-frontend
docker compose logs archislicer-backend

# Rebuild containers
docker compose build --no-cache
docker compose up -d
```

**Problem:** Frontend not connecting to backend

- Verify both containers are on same Docker network
- Check nginx configuration in `frontend/nginx.conf`
- Ensure backend is healthy: `docker compose ps`

---

## 🤝 Contributing

This project is open source and welcomes contributions from everyone! Whether you're fixing bugs, adding features, or improving documentation, we appreciate your help.

**Repository:** [https://github.com/KonstiDoll/archiplotterXL](https://github.com/KonstiDoll/archiplotterXL)

### Development Guidelines

1. **Code Style**
   - Follow existing patterns in the codebase
   - Use TypeScript for all frontend code
   - Add comments for complex algorithms
   - Keep components small and focused

2. **Git Workflow**
   - Create feature branches from `main`
   - Write descriptive commit messages
   - Test locally before pushing
   - Submit pull requests for review

3. **Testing**
   - Write tests for new features
   - Ensure existing tests pass
   - Test on actual hardware when possible

---

## 📄 License

**MIT License**

This project is open source and available to everyone. Feel free to use, modify, and distribute it as you see fit.

Copyright (c) 2025 ArchiSlicer Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

## 🙏 Acknowledgments

- **Three.js** - For powerful 3D rendering
- **Vue.js** - For reactive UI framework
- **FastAPI** - For modern Python backend
- **SVGLoader** - For SVG parsing capabilities

---

## 📞 Support & Contact

**GitHub Repository:** [archiplotterXL](https://github.com/KonstiDoll/archiplotterXL)

For questions, issues, or feature requests:
- **Open an Issue:** [GitHub Issues](https://github.com/KonstiDoll/archiplotterXL/issues)
- **Report a Bug:** [New Issue](https://github.com/KonstiDoll/archiplotterXL/issues/new)
- **Request a Feature:** [New Issue](https://github.com/KonstiDoll/archiplotterXL/issues/new)

We welcome all feedback and contributions from the community!

---

**Made with ❤️ for the plotting community**
