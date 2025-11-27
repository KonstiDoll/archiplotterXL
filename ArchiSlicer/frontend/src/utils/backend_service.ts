// Backend service for API communication
// Currently not used - prepared for future image processing features

const BACKEND_URL = '/api';

/**
 * Upload an image to the backend for processing
 * @param image The image file to upload
 * @returns URL of the processed image
 */
export async function uploadImageForProcessing(image: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', image);

    const response = await fetch(`${BACKEND_URL}/process_image/`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
}

/**
 * Check if backend is available
 */
export async function checkBackendHealth(): Promise<boolean> {
    try {
        const response = await fetch(`${BACKEND_URL}/`);
        return response.ok;
    } catch {
        return false;
    }
}
