import { Injectable } from '@angular/core';

export interface ContentBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ProcessImageOptions {
  removeBg: boolean;
  autoCrop: boolean;
  padding: number;
}

@Injectable({ providedIn: 'root' })
export class ImageProcessingService {

  /**
   * Full pipeline: load file → remove background → crop → return PNG blob.
   */
  async processImage(file: File, options: ProcessImageOptions): Promise<Blob> {
    console.log('[ImageProcessing] Loading image...');
    const img = await this.loadImage(file);

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    console.log('[ImageProcessing] Image loaded:', img.width, 'x', img.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    console.log('[ImageProcessing] Pixel data length:', data.length);
    console.log('[ImageProcessing] Sample pixel [0] before:', data[0], data[1], data[2], data[3]);

    if (options.removeBg) {
      console.log('[ImageProcessing] Removing background...');
      this.removeBackground(data, canvas.width, canvas.height);
      console.log('[ImageProcessing] Sample pixel [0] after:', data[0], data[1], data[2], data[3]);
    }

    // Write modified pixel data back to the canvas
    ctx.putImageData(imageData, 0, 0);
    console.log('[ImageProcessing] putImageData complete');

    let result = canvas;

    if (options.autoCrop) {
      const bounds = this.findContentBounds(data, canvas.width, canvas.height);
      console.log('[ImageProcessing] Content bounds:', bounds);
      if (bounds) {
        result = this.cropAndRecenter(canvas, bounds, options.padding);
        console.log('[ImageProcessing] Cropped to:', result.width, 'x', result.height);
      }
    }

    return new Promise<Blob>((resolve, reject) => {
      result.toBlob(blob => {
        if (blob) {
          console.log('[ImageProcessing] Blob created:', blob.size, 'bytes');
          resolve(blob);
        } else {
          reject(new Error('Canvas toBlob failed'));
        }
      }, 'image/png');
    });
  }

  /**
   * Remove background in-place using edge flood-fill with content boundary detection.
   * Auto-detects light vs dark backgrounds.
   */
  removeBackground(data: Uint8ClampedArray, width: number, height: number): void {
    const bgColor = this.detectBackgroundColor(data, width, height);
    const avgBrightness = (bgColor.r + bgColor.g + bgColor.b) / 3;
    const isLight = avgBrightness > 128;
    const tolerance = 35;

    console.log('[ImageProcessing] Detected BG colour:', bgColor, 'isLight:', isLight);

    // 1. Identify coloured (non-background) content pixels
    const totalPixels = width * height;
    const isContent = new Uint8Array(totalPixels);
    let contentCount = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const idx = i / 4;

      if (isLight) {
        const isWhiteish = r > 240 && g > 240 && b > 240;
        const isGrayish = Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && Math.abs(r - b) < 20 && r > 200;
        if (!isWhiteish && !isGrayish) { isContent[idx] = 1; contentCount++; }
      } else {
        const isBlackish = r < 30 && g < 30 && b < 30;
        const isDarkGray = Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && Math.abs(r - b) < 20 && r < 50;
        if (!isBlackish && !isDarkGray) { isContent[idx] = 1; contentCount++; }
      }
    }

    console.log('[ImageProcessing] Content pixels:', contentCount, '/', totalPixels);

    // 2. Flood-fill from edges — mark external background pixels
    const externalBg = new Uint8Array(totalPixels);
    const visited = new Uint8Array(totalPixels);
    const queue: number[] = [];

    // Seed edge pixels
    for (let x = 0; x < width; x++) {
      const top = x;
      const bot = (height - 1) * width + x;
      if (!isContent[top] && !visited[top]) { visited[top] = 1; queue.push(top); }
      if (!isContent[bot] && !visited[bot]) { visited[bot] = 1; queue.push(bot); }
    }
    for (let y = 1; y < height - 1; y++) {
      const left = y * width;
      const right = y * width + width - 1;
      if (!isContent[left] && !visited[left]) { visited[left] = 1; queue.push(left); }
      if (!isContent[right] && !visited[right]) { visited[right] = 1; queue.push(right); }
    }

    console.log('[ImageProcessing] Edge seeds:', queue.length);

    // BFS — stop at content boundaries
    let head = 0;
    while (head < queue.length) {
      const idx = queue[head++];
      if (isContent[idx]) continue;

      const pi = idx * 4;
      const r = data[pi], g = data[pi + 1], b = data[pi + 2];

      let isBg: boolean;
      if (isLight) {
        isBg = Math.abs(r - bgColor.r) < tolerance &&
               Math.abs(g - bgColor.g) < tolerance &&
               Math.abs(b - bgColor.b) < tolerance;
      } else {
        const brightness = (r + g + b) / 3;
        isBg = brightness < 50 ||
               (Math.abs(r - bgColor.r) < tolerance &&
                Math.abs(g - bgColor.g) < tolerance &&
                Math.abs(b - bgColor.b) < tolerance);
      }

      if (!isBg) continue;
      externalBg[idx] = 1;

      const x = idx % width, y = (idx - x) / width;
      if (x > 0 && !visited[idx - 1] && !isContent[idx - 1]) { visited[idx - 1] = 1; queue.push(idx - 1); }
      if (x < width - 1 && !visited[idx + 1] && !isContent[idx + 1]) { visited[idx + 1] = 1; queue.push(idx + 1); }
      if (y > 0 && !visited[idx - width] && !isContent[idx - width]) { visited[idx - width] = 1; queue.push(idx - width); }
      if (y < height - 1 && !visited[idx + width] && !isContent[idx + width]) { visited[idx + width] = 1; queue.push(idx + width); }
    }

    // 3. Clean up small isolated background-coloured patches inside content
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (externalBg[idx] || isContent[idx]) continue;

        const pi = idx * 4;
        const r = data[pi], g = data[pi + 1], b = data[pi + 2];
        const shouldCheck = isLight
          ? (r > 240 && g > 240 && b > 240)
          : (r < 30 && g < 30 && b < 30);

        if (shouldCheck && this.isIsolated(x, y, width, height, externalBg, isContent)) {
          externalBg[idx] = 1;
        }
      }
    }

    // 4. Apply transparency
    let removedCount = 0;
    for (let i = 0; i < totalPixels; i++) {
      if (externalBg[i]) {
        data[i * 4 + 3] = 0;
        removedCount++;
      }
    }

    console.log('[ImageProcessing] Pixels removed:', removedCount, '/', totalPixels);
  }

  /**
   * Sample edge pixels and return the dominant background colour.
   */
  detectBackgroundColor(data: Uint8ClampedArray, width: number, height: number): { r: number; g: number; b: number } {
    const samples: { r: number; g: number; b: number }[] = [];
    const step = 10;

    const sample = (x: number, y: number) => {
      const i = (y * width + x) * 4;
      samples.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
    };

    const xStep = Math.max(1, Math.floor(width / step));
    const yStep = Math.max(1, Math.floor(height / step));

    for (let x = 0; x < width; x += xStep) { sample(x, 0); sample(x, height - 1); }
    for (let y = 0; y < height; y += yStep) { sample(0, y); sample(width - 1, y); }

    // Quantise to buckets of 10 and find dominant
    const counts: Record<string, number> = {};
    for (const s of samples) {
      const key = `${Math.round(s.r / 10) * 10},${Math.round(s.g / 10) * 10},${Math.round(s.b / 10) * 10}`;
      counts[key] = (counts[key] || 0) + 1;
    }

    let maxCount = 0;
    let dominant = { r: 255, g: 255, b: 255 };
    for (const key in counts) {
      if (counts[key] > maxCount) {
        maxCount = counts[key];
        const [r, g, b] = key.split(',').map(Number);
        dominant = { r, g, b };
      }
    }
    return dominant;
  }

  /**
   * Find the bounding box of non-background content.
   */
  findContentBounds(data: Uint8ClampedArray, width: number, height: number): ContentBounds | null {
    const bgColor = this.detectBackgroundColor(data, width, height);
    const avgBrightness = (bgColor.r + bgColor.g + bgColor.b) / 3;
    const isLight = avgBrightness > 128;

    let minX = width, minY = height, maxX = 0, maxY = 0;
    let found = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a === 0) continue;

        const isContentPixel = isLight
          ? !(r > 250 && g > 250 && b > 250)
          : !(r < 10 && g < 10 && b < 10);

        if (isContentPixel) {
          found = true;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!found) return null;

    // Refine edges inward — skip pure background rows/columns
    const isBgPixel = (px: number, py: number): boolean => {
      const i = (py * width + px) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a === 0) return true;
      return isLight ? (r > 250 && g > 250 && b > 250) : (r < 10 && g < 10 && b < 10);
    };

    // Refine left
    refineLeft: for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        if (!isBgPixel(x, y)) { minX = x; break refineLeft; }
      }
    }
    // Refine right
    refineRight: for (let x = maxX; x >= minX; x--) {
      for (let y = minY; y <= maxY; y++) {
        if (!isBgPixel(x, y)) { maxX = x; break refineRight; }
      }
    }
    // Refine top
    refineTop: for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (!isBgPixel(x, y)) { minY = y; break refineTop; }
      }
    }
    // Refine bottom
    refineBottom: for (let y = maxY; y >= minY; y--) {
      for (let x = minX; x <= maxX; x++) {
        if (!isBgPixel(x, y)) { maxY = y; break refineBottom; }
      }
    }

    return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  }

  /**
   * Crop a canvas to the given bounds with optional padding.
   */
  cropAndRecenter(sourceCanvas: HTMLCanvasElement, bounds: ContentBounds, padding: number): HTMLCanvasElement {
    const cropW = bounds.width + padding * 2;
    const cropH = bounds.height + padding * 2;

    const out = document.createElement('canvas');
    out.width = cropW;
    out.height = cropH;
    const ctx = out.getContext('2d', { willReadFrequently: true })!;

    const srcX = Math.max(0, bounds.left - padding);
    const srcY = Math.max(0, bounds.top - padding);
    const srcW = Math.min(sourceCanvas.width - srcX, cropW);
    const srcH = Math.min(sourceCanvas.height - srcY, cropH);
    const dstX = (cropW - srcW) / 2;
    const dstY = (cropH - srcH) / 2;

    ctx.drawImage(sourceCanvas, srcX, srcY, srcW, srcH, dstX, dstY, srcW, srcH);
    return out;
  }

  // --- private helpers ---

  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private isIsolated(
    x: number, y: number, width: number, height: number,
    externalBg: Uint8Array, isContent: Uint8Array
  ): boolean {
    let extCount = 0;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const nIdx = ny * width + nx;
        if (isContent[nIdx]) return false;
        if (externalBg[nIdx]) extCount++;
      }
    }
    return extCount > 12;
  }
}
