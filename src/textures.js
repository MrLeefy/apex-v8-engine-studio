import * as THREE from 'three';

/**
 * High-Quality Procedural PBR Texture Generator
 * Creates physically-accurate micro-surface textures:
 * - Multi-octave Perlin-like noise for sand casting grain
 * - 2x2 twill weave carbon fiber with realistic fiber highlights
 * - Directional brushed metal with realistic grain variation
 * - Serpentine 6-rib micro-V belt grooves
 * - Rough casting surface for iron components
 * - Rubber/silicone hose surface texture
 */
export class TextureGenerator {

  // Simple 2D value noise helper
  static _noise2D(x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  static _smoothNoise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);

    const n00 = TextureGenerator._noise2D(ix, iy);
    const n10 = TextureGenerator._noise2D(ix + 1, iy);
    const n01 = TextureGenerator._noise2D(ix, iy + 1);
    const n11 = TextureGenerator._noise2D(ix + 1, iy + 1);

    const nx0 = n00 * (1 - sx) + n10 * sx;
    const nx1 = n01 * (1 - sx) + n11 * sx;
    return nx0 * (1 - sy) + nx1 * sy;
  }

  static _fbm(x, y, octaves = 4) {
    let val = 0, amp = 0.5, freq = 1;
    for (let i = 0; i < octaves; i++) {
      val += TextureGenerator._smoothNoise(x * freq, y * freq) * amp;
      amp *= 0.5;
      freq *= 2.0;
    }
    return val;
  }

  static createCastingGrainTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        // Multi-octave fractal noise for sand casting grain
        const n = TextureGenerator._fbm(x * 0.06, y * 0.06, 5);
        // Add fine-grain speckle noise
        const speckle = (Math.random() - 0.5) * 20;
        const v = Math.min(255, Math.max(0, n * 180 + 40 + speckle));
        data[idx] = v;
        data[idx + 1] = v;
        data[idx + 2] = v;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3);
    return texture;
  }

  static createCarbonFiberTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Deep carbon base
    ctx.fillStyle = '#0c0d10';
    ctx.fillRect(0, 0, size, size);

    // 2x2 Twill Weave Pattern with realistic highlights
    const tileSize = 12;
    for (let y = 0; y < size; y += tileSize) {
      for (let x = 0; x < size; x += tileSize) {
        const row = Math.floor(y / tileSize);
        const col = Math.floor(x / tileSize);
        const isWeft = (col + row) % 2 === 0;

        // Warp and weft fibers have different direction gradients
        const grad = isWeft
          ? ctx.createLinearGradient(x, y, x + tileSize, y + tileSize * 0.5)
          : ctx.createLinearGradient(x, y + tileSize, x + tileSize * 0.5, y);

        const baseBright = 0x18 + Math.floor(Math.random() * 0x0a);
        const peakBright = 0x30 + Math.floor(Math.random() * 0x14);
        grad.addColorStop(0, `rgb(${baseBright},${baseBright},${baseBright + 2})`);
        grad.addColorStop(0.45, `rgb(${peakBright},${peakBright},${peakBright + 4})`);
        grad.addColorStop(1, `rgb(${baseBright},${baseBright},${baseBright + 2})`);

        ctx.fillStyle = grad;
        ctx.fillRect(x, y, tileSize, tileSize);

        // Fiber separation lines
        ctx.strokeStyle = `rgba(0, 0, 0, ${0.3 + Math.random() * 0.15})`;
        ctx.lineWidth = 0.8;
        ctx.strokeRect(x + 0.5, y + 0.5, tileSize - 1, tileSize - 1);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 8);
    return texture;
  }

  static createBrushedMetalTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;

    // Create directional brushing with varying line intensity
    for (let y = 0; y < size; y++) {
      // Each horizontal line has a dominant brightness
      const lineBrightness = 128 + (Math.sin(y * 0.4) * 12) + (Math.random() - 0.5) * 25;
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        // Fine-grain variation along the brush direction
        const microNoise = (Math.random() - 0.5) * 8;
        // Occasional deeper scratch lines
        const scratch = Math.random() > 0.992 ? -30 : 0;
        const val = Math.min(255, Math.max(0, lineBrightness + microNoise + scratch));
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 6);
    return texture;
  }

  static createBeltGrooveTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0e0f12';
    ctx.fillRect(0, 0, size, size);

    // 6 longitudinal Micro-V ridges with rounded profile shading
    const ribCount = 6;
    const ribW = size / ribCount;
    for (let i = 0; i < ribCount; i++) {
      const x = i * ribW;
      const grad = ctx.createLinearGradient(x, 0, x + ribW, 0);
      grad.addColorStop(0, '#060608');
      grad.addColorStop(0.2, '#1a1c22');
      grad.addColorStop(0.5, '#2a2e38');
      grad.addColorStop(0.8, '#1a1c22');
      grad.addColorStop(1, '#060608');
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, ribW, size);
    }

    // Add longitudinal wear marks
    for (let i = 0; i < 20; i++) {
      const lx = Math.random() * size;
      ctx.strokeStyle = `rgba(60, 65, 75, ${Math.random() * 0.3})`;
      ctx.lineWidth = 0.5 + Math.random();
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx + (Math.random() - 0.5) * 3, size);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 12);
    return texture;
  }

  static createRoughCastIronTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const n = TextureGenerator._fbm(x * 0.04, y * 0.04, 6);
        const pitting = Math.random() > 0.97 ? -40 : 0;
        const v = Math.min(255, Math.max(0, n * 140 + 60 + pitting));
        data[idx] = v;
        data[idx + 1] = v;
        data[idx + 2] = v;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    return texture;
  }

  static createRubberTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#1a1a1e';
    ctx.fillRect(0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 15;
      data[i] = Math.min(255, Math.max(0, 26 + noise));
      data[i + 1] = Math.min(255, Math.max(0, 26 + noise));
      data[i + 2] = Math.min(255, Math.max(0, 30 + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    return texture;
  }

  static createValveCoverTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Deep crimson anodized base with subtle metallic variation
    const grad = ctx.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, '#b8152e');
    grad.addColorStop(0.5, '#d41838');
    grad.addColorStop(1, '#b8152e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Fine anodized grain
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 12;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise * 0.3));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise * 0.3));
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }
}
