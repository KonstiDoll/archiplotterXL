import { ref } from 'vue';
import * as THREE from 'three';
import type { SVGItem, ColorGroup, WorkpieceStart } from '../store';
import type { InfillOptions } from './threejs_services';

// API base URL - use env var for dev, empty for production (relative URLs)
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Project file version for format migrations
// v1.1: Added infill line data serialization
const PROJECT_VERSION = '1.1';

// Project file extension
export const PROJECT_FILE_EXTENSION = '.archislicer';

// --- Project Data Types ---

export interface ProjectData {
  version: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  defaultDpi: number;
  workpieceStarts: WorkpieceStart[];
  svgItems: SerializedSVGItem[];
}

// Serializable version of SVGItem (without THREE.js objects)
export interface SerializedSVGItem {
  fileName: string;
  svgContent: string;
  dpi: number;
  toolNumber: number;
  infillToolNumber: number;
  penType: string;
  feedrate: number;
  drawingHeight: number;
  offsetX: number;
  offsetY: number;
  workpieceStartId?: string;
  infillOptions: InfillOptions;
  infillLines?: SerializedInfillLine[]; // File-level infill (from FilePanel)
  colorGroups: SerializedColorGroup[];
  isAnalyzed: boolean;
}

// Serialized infill line (array of [x, y] points)
export interface SerializedInfillLine {
  points: [number, number][];
  color: number; // Hex color as number (e.g., 0x00ff00)
}

// Serializable version of ColorGroup (with infill line data)
export interface SerializedColorGroup {
  color: string;
  toolNumber: number;
  lineCount: number;
  visible: boolean;
  useFileDefaults?: boolean; // Optional for backwards compatibility
  infillEnabled: boolean;
  infillToolNumber: number;
  infillOptions: InfillOptions;
  // Serialized infill geometry (if generated)
  infillLines?: SerializedInfillLine[];
}

// API response types
export interface ProjectListItem {
  id: number;
  name: string;
  description: string | null;
  current_version: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectResponse extends ProjectListItem {
  project_data: ProjectData;
}

// Version-related types
export interface ProjectVersionListItem {
  id: number;
  version: number;
  message: string | null;
  created_at: string;
}

export interface ProjectVersionResponse extends ProjectVersionListItem {
  project_id: number;
  project_data: ProjectData;
}

// --- State ---

export const projectsLoading = ref(false);
export const projectsError = ref<string | null>(null);
export const currentProjectId = ref<number | null>(null);
export const currentProjectName = ref<string>('');

// --- Serialization Functions ---

/**
 * Extract points from a THREE.Line geometry as [x, y] tuples.
 */
function extractLinePoints(line: THREE.Line): [number, number][] {
  const geometry = line.geometry as THREE.BufferGeometry;
  const positionAttr = geometry.getAttribute('position');
  const points: [number, number][] = [];

  if (positionAttr) {
    for (let i = 0; i < positionAttr.count; i++) {
      points.push([positionAttr.getX(i), positionAttr.getY(i)]);
    }
  }

  return points;
}

/**
 * Serialize the infill geometry (THREE.Group of THREE.Line objects) to an array of line data.
 */
function serializeInfillGroup(infillGroup: THREE.Group): SerializedInfillLine[] {
  const lines: SerializedInfillLine[] = [];

  infillGroup.children.forEach((child) => {
    if (child instanceof THREE.Line) {
      const points = extractLinePoints(child);
      if (points.length >= 2) {
        // Get the color from the material
        const material = child.material as THREE.LineBasicMaterial;
        const color = material.color ? material.color.getHex() : 0x00ff00;

        lines.push({ points, color });
      }
    }
  });

  return lines;
}

/**
 * Serialize a ColorGroup to a format that can be stored as JSON.
 * Includes infill line data if generated.
 */
function serializeColorGroup(colorGroup: ColorGroup): SerializedColorGroup {
  const serialized: SerializedColorGroup = {
    color: colorGroup.color,
    toolNumber: colorGroup.toolNumber,
    lineCount: colorGroup.lineCount,
    visible: colorGroup.visible,
    infillEnabled: colorGroup.infillEnabled,
    infillToolNumber: colorGroup.infillToolNumber,
    infillOptions: { ...colorGroup.infillOptions },
  };

  // Serialize infill geometry if it exists
  if (colorGroup.infillGroup && colorGroup.infillGroup.children.length > 0) {
    serialized.infillLines = serializeInfillGroup(colorGroup.infillGroup);
    console.log(`Serialized ${serialized.infillLines.length} infill lines for color ${colorGroup.color}`);
  }

  return serialized;
}

/**
 * Serialize an SVGItem to a format that can be stored as JSON.
 * Removes THREE.js geometry objects but keeps svgContent for reconstruction.
 */
function serializeSVGItem(item: SVGItem): SerializedSVGItem | null {
  // Cannot serialize if we don't have the original SVG content
  if (!item.svgContent) {
    console.warn(`Cannot serialize SVG "${item.fileName}" - no svgContent available`);
    return null;
  }

  return {
    fileName: item.fileName,
    svgContent: item.svgContent,
    dpi: item.dpi,
    toolNumber: item.toolNumber,
    infillToolNumber: item.infillToolNumber,
    penType: item.penType,
    feedrate: item.feedrate,
    drawingHeight: item.drawingHeight,
    offsetX: item.offsetX,
    offsetY: item.offsetY,
    workpieceStartId: item.workpieceStartId,
    infillOptions: { ...item.infillOptions },
    colorGroups: item.colorGroups.map(serializeColorGroup),
    isAnalyzed: item.isAnalyzed,
  };
}

/**
 * Serialize the full project state to a ProjectData object.
 */
export function serializeProject(
  svgItems: SVGItem[],
  workpieceStarts: WorkpieceStart[],
  defaultDpi: number,
  projectName: string
): ProjectData {
  const now = new Date().toISOString();

  const serializedItems = svgItems
    .map(serializeSVGItem)
    .filter((item): item is SerializedSVGItem => item !== null);

  if (serializedItems.length !== svgItems.length) {
    console.warn(`Some SVG items could not be serialized (missing svgContent)`);
  }

  return {
    version: PROJECT_VERSION,
    name: projectName,
    createdAt: now,
    updatedAt: now,
    defaultDpi,
    workpieceStarts: workpieceStarts.map(ws => ({ ...ws })),
    svgItems: serializedItems,
  };
}

// --- File Download/Upload ---

/**
 * Download the project as a local .archislicer file.
 */
export function downloadProjectFile(projectData: ProjectData): void {
  const jsonString = JSON.stringify(projectData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectData.name}${PROJECT_FILE_EXTENSION}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Read and parse a project file from a File object.
 */
export async function readProjectFile(file: File): Promise<ProjectData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content) as ProjectData;

        // Validate version
        if (!data.version) {
          throw new Error('Invalid project file: missing version');
        }

        // Handle version migrations in the future
        if (data.version !== PROJECT_VERSION) {
          console.warn(`Project version ${data.version} differs from current ${PROJECT_VERSION}`);
          // Future: Add migration logic here
        }

        resolve(data);
      } catch (error) {
        reject(new Error(`Failed to parse project file: ${error}`));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// --- API Functions ---

/**
 * Fetch all projects from the API (list view, without full data).
 */
export async function fetchProjects(): Promise<ProjectListItem[]> {
  projectsLoading.value = true;
  projectsError.value = null;

  try {
    const response = await fetch(`${API_BASE_URL}/api/projects`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log(`Loaded ${data.length} projects from API`);
    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to fetch projects:', error);
    projectsError.value = message;
    throw error;
  } finally {
    projectsLoading.value = false;
  }
}

/**
 * Fetch a single project by ID (with full project_data).
 */
export async function fetchProject(projectId: number): Promise<ProjectResponse> {
  projectsLoading.value = true;
  projectsError.value = null;

  try {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Project not found');
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to fetch project:', error);
    projectsError.value = message;
    throw error;
  } finally {
    projectsLoading.value = false;
  }
}

/**
 * Save a new project to the API.
 */
export async function createProject(
  name: string,
  projectData: ProjectData,
  description?: string
): Promise<ProjectResponse> {
  projectsLoading.value = true;
  projectsError.value = null;

  try {
    const response = await fetch(`${API_BASE_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description: description || null,
        project_data: projectData,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Created project "${name}" with ID ${data.id}`);

    // Update current project tracking
    currentProjectId.value = data.id;
    currentProjectName.value = name;

    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to create project:', error);
    projectsError.value = message;
    throw error;
  } finally {
    projectsLoading.value = false;
  }
}

/**
 * Update an existing project.
 */
export async function updateProject(
  projectId: number,
  updates: {
    name?: string;
    description?: string;
    project_data?: ProjectData;
    version_message?: string;
  }
): Promise<ProjectResponse> {
  projectsLoading.value = true;
  projectsError.value = null;

  try {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Project not found');
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Updated project ${projectId}`);

    // Update name tracking if changed
    if (updates.name) {
      currentProjectName.value = updates.name;
    }

    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to update project:', error);
    projectsError.value = message;
    throw error;
  } finally {
    projectsLoading.value = false;
  }
}

/**
 * Delete a project from the API.
 */
export async function deleteProject(projectId: number): Promise<void> {
  projectsLoading.value = true;
  projectsError.value = null;

  try {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Project not found');
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log(`Deleted project ${projectId}`);

    // Clear current project if it was deleted
    if (currentProjectId.value === projectId) {
      currentProjectId.value = null;
      currentProjectName.value = '';
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to delete project:', error);
    projectsError.value = message;
    throw error;
  } finally {
    projectsLoading.value = false;
  }
}

/**
 * Clear current project tracking (for "New Project" action).
 */
export function clearCurrentProject(): void {
  currentProjectId.value = null;
  currentProjectName.value = '';
}

// --- Version API Functions ---

/**
 * Fetch all versions of a project.
 */
export async function fetchProjectVersions(projectId: number): Promise<ProjectVersionListItem[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/versions`);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Project not found');
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log(`Loaded ${data.length} versions for project ${projectId}`);
    return data;
  } catch (error) {
    console.error('Failed to fetch project versions:', error);
    throw error;
  }
}

/**
 * Fetch a specific version of a project (with full data).
 */
export async function fetchProjectVersion(
  projectId: number,
  version: number
): Promise<ProjectVersionResponse> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/projects/${projectId}/versions/${version}`
    );
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Project or version not found');
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch project version:', error);
    throw error;
  }
}

/**
 * Restore a project to a previous version.
 * The current state is archived before restoring.
 */
export async function restoreProjectVersion(
  projectId: number,
  version: number
): Promise<ProjectResponse> {
  projectsLoading.value = true;
  projectsError.value = null;

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/projects/${projectId}/versions/${version}/restore`,
      { method: 'POST' }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Project or version not found');
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Restored project ${projectId} to version ${version}`);
    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to restore project version:', error);
    projectsError.value = message;
    throw error;
  } finally {
    projectsLoading.value = false;
  }
}

// --- Deserialization Functions ---

/**
 * Reconstruct a THREE.Group from serialized infill line data.
 */
export function deserializeInfillGroup(
  infillLines: SerializedInfillLine[],
  color: string
): THREE.Group {
  const group = new THREE.Group();
  group.name = `InfillGroup_${color.replace('#', '')}`;

  infillLines.forEach((lineData, index) => {
    // Convert [x, y] tuples to THREE.Vector3
    const points = lineData.points.map(([x, y]) => new THREE.Vector3(x, y, 0));

    if (points.length >= 2) {
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color: lineData.color });
      const line = new THREE.Line(geometry, material);
      line.name = `Infill_${index}`;
      group.add(line);
    }
  });

  return group;
}
