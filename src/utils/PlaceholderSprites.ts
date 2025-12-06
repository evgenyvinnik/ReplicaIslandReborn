/**
 * Placeholder Sprites - Generates simple placeholder graphics
 * Used for development and testing before real assets are available
 */

export interface PlaceholderConfig {
  width: number;
  height: number;
  color: string;
  label?: string;
}

const SPRITE_CONFIGS: Record<string, PlaceholderConfig> = {
  player: { width: 32, height: 48, color: '#4CAF50', label: 'P' },
  brobot: { width: 32, height: 32, color: '#F44336', label: 'E' },
  coin: { width: 16, height: 16, color: '#FFD700', label: 'C' },
  pearl: { width: 24, height: 24, color: '#E0E0E0', label: '*' },
  spring: { width: 32, height: 16, color: '#2196F3', label: '^' },
  smoke: { width: 32, height: 32, color: '#9E9E9E', label: '' },
  default: { width: 32, height: 32, color: '#9C27B0', label: '?' },
};

/**
 * Generate a placeholder sprite canvas
 */
export function generatePlaceholderSprite(
  name: string,
  frameIndex: number = 0
): HTMLCanvasElement {
  const config = SPRITE_CONFIGS[name] || SPRITE_CONFIGS.default;
  const canvas = document.createElement('canvas');
  canvas.width = config.width;
  canvas.height = config.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Draw body
  ctx.fillStyle = config.color;
  
  // Animate slightly based on frame
  const wobble = Math.sin(frameIndex * 0.5) * 2;
  
  if (name === 'player') {
    // Simple humanoid shape
    ctx.fillRect(8, 8 + wobble, 16, 24);  // Body
    ctx.fillRect(4, 32, 8, 12);           // Left leg
    ctx.fillRect(20, 32, 8, 12);          // Right leg
    ctx.fillStyle = '#2E7D32';
    ctx.fillRect(10, 2, 12, 12);          // Head
  } else if (name === 'brobot') {
    // Robot shape
    ctx.fillRect(4, 8, 24, 20);           // Body
    ctx.fillStyle = '#B71C1C';
    ctx.fillRect(8, 4, 16, 8);            // Head
    ctx.fillStyle = '#FFEB3B';
    ctx.fillRect(10, 12, 4, 4);           // Left eye
    ctx.fillRect(18, 12, 4, 4);           // Right eye
  } else if (name === 'coin') {
    // Circular coin
    ctx.beginPath();
    ctx.arc(8, 8, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFC107';
    ctx.beginPath();
    ctx.arc(8, 8, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (name === 'pearl') {
    // Glowing pearl
    ctx.beginPath();
    ctx.arc(12, 12, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FAFAFA';
    ctx.beginPath();
    ctx.arc(8, 8, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (name === 'spring') {
    // Spring pad
    ctx.fillRect(0, 8, 32, 8);
    ctx.fillStyle = '#1976D2';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(4 + i * 8, 0, 4, 8);
    }
  } else if (name === 'smoke') {
    // Smoke puff (fades)
    const alpha = 1 - (frameIndex / 4);
    ctx.fillStyle = `rgba(158, 158, 158, ${Math.max(0, alpha)})`;
    ctx.beginPath();
    ctx.arc(16, 16, 12 + frameIndex * 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Generic rectangle
    ctx.fillRect(2, 2, config.width - 4, config.height - 4);
  }

  // Add label
  if (config.label) {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(config.label, config.width / 2, config.height / 2);
  }

  return canvas;
}

/**
 * Generate a tileset placeholder
 */
export function generatePlaceholderTileset(
  tileSize: number = 32,
  tilesX: number = 16,
  tilesY: number = 16
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = tileSize * tilesX;
  canvas.height = tileSize * tilesY;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Tile colors by type
  const tileColors = [
    '#87CEEB', // 0: Sky/empty
    '#8B4513', // 1: Ground
    '#654321', // 2: Ground variant
    '#228B22', // 3: Grass top
    '#006400', // 4: Grass
    '#696969', // 5: Stone
    '#808080', // 6: Stone variant
    '#A0522D', // 7: Dirt
    '#4169E1', // 8: Water
    '#1E90FF', // 9: Water surface
    '#FF6347', // 10: Lava
    '#FF4500', // 11: Lava surface
    '#FFD700', // 12: Gold block
    '#C0C0C0', // 13: Silver block
    '#8B0000', // 14: Hazard
    '#2F4F4F', // 15: Dark stone
  ];

  for (let y = 0; y < tilesY; y++) {
    for (let x = 0; x < tilesX; x++) {
      const tileIndex = y * tilesX + x;
      const color = tileColors[tileIndex % tileColors.length];

      ctx.fillStyle = color;
      ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);

      // Add border
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);

      // Add some detail
      if (tileIndex === 3 || tileIndex === 4) {
        // Grass blades
        ctx.fillStyle = '#32CD32';
        for (let i = 0; i < 5; i++) {
          const bx = x * tileSize + 4 + i * 6;
          const by = y * tileSize + 2;
          ctx.fillRect(bx, by, 2, 8);
        }
      } else if (tileIndex === 8 || tileIndex === 9) {
        // Water waves
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const wy = y * tileSize + 8 + i * 8;
          ctx.moveTo(x * tileSize, wy);
          ctx.quadraticCurveTo(
            x * tileSize + tileSize / 2,
            wy - 4,
            x * tileSize + tileSize,
            wy
          );
        }
        ctx.stroke();
      }
    }
  }

  return canvas;
}

/**
 * Generate a sprite sheet with multiple frames
 */
export function generateSpriteSheet(
  name: string,
  frameCount: number,
  frameWidth: number,
  frameHeight: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = frameWidth * frameCount;
  canvas.height = frameHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  for (let i = 0; i < frameCount; i++) {
    const frameCanvas = generatePlaceholderSprite(name, i);
    ctx.drawImage(frameCanvas, i * frameWidth, 0);
  }

  return canvas;
}

/**
 * Create ImageData URL from canvas
 */
export function canvasToDataURL(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}

/**
 * Create an HTMLImageElement from placeholder
 */
export function createPlaceholderImage(name: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const canvas = generatePlaceholderSprite(name);
    const img = new Image();
    img.onload = (): void => resolve(img);
    img.onerror = reject;
    img.src = canvas.toDataURL();
  });
}

/**
 * Placeholder manager - caches generated placeholders
 */
export class PlaceholderManager {
  private cache: Map<string, HTMLCanvasElement> = new Map();

  getSprite(name: string, frame: number = 0): HTMLCanvasElement {
    const key = `${name}_${frame}`;
    if (!this.cache.has(key)) {
      this.cache.set(key, generatePlaceholderSprite(name, frame));
    }
    return this.cache.get(key)!;
  }

  getTileset(tileSize: number = 32): HTMLCanvasElement {
    const key = `tileset_${tileSize}`;
    if (!this.cache.has(key)) {
      this.cache.set(key, generatePlaceholderTileset(tileSize));
    }
    return this.cache.get(key)!;
  }

  getSpriteSheet(name: string, frames: number, width: number, height: number): HTMLCanvasElement {
    const key = `sheet_${name}_${frames}`;
    if (!this.cache.has(key)) {
      this.cache.set(key, generateSpriteSheet(name, frames, width, height));
    }
    return this.cache.get(key)!;
  }

  clear(): void {
    this.cache.clear();
  }
}

// Global placeholder manager instance
export const placeholders = new PlaceholderManager();
