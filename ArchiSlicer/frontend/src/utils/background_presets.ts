// Gradient-Presets für den 3D-Vorschau-Hintergrund (flashy!)
export const gradientPresets: { [key: string]: { name: string; css: string } } = {
    'paper': { name: '📄 Papier', css: '#f5f5f5' },
    'dark': { name: '🌙 Dunkel', css: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' },
    'sunset': { name: '🌅 Sunset', css: 'linear-gradient(135deg, #ff6b6b 0%, #feca57 50%, #ff9ff3 100%)' },
    'ocean': { name: '🌊 Ocean', css: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)' },
    'forest': { name: '🌲 Forest', css: 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)' },
    'neon': { name: '💫 Neon', css: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' },
    'cyber': { name: '🤖 Cyber', css: 'linear-gradient(135deg, #00d2ff 0%, #3a7bd5 50%, #00d2ff 100%)' },
    'fire': { name: '🔥 Fire', css: 'linear-gradient(135deg, #f12711 0%, #f5af19 100%)' },
    'aurora': { name: '✨ Aurora', css: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 25%, #7c3aed 50%, #f472b6 75%, #fbbf24 100%)' },
    'custom': { name: '🎨 Custom', css: '#e0e0e0' },
};

// Standard-Preset
export const defaultBackgroundPreset = 'paper';
