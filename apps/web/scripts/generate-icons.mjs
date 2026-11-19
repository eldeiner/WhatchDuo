/**
 * Genera los iconos PNG de la PWA sin dependencias externas.
 * Uso: node apps/web/scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../public/icons');
mkdirSync(outDir, { recursive: true });

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowLength = width * 4 + 1;
  const raw = Buffer.alloc(rowLength * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * rowLength] = 0;
    rgba.copy(raw, y * rowLength + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const mix = (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t));

function insideRoundedRect(px, py, size, radius) {
  const cx = Math.min(Math.max(px, radius), size - radius);
  const cy = Math.min(Math.max(py, radius), size - radius);
  return Math.hypot(px - cx, py - cy) <= radius;
}

function pointInTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const v0x = cx - ax;
  const v0y = cy - ay;
  const v1x = bx - ax;
  const v1y = by - ay;
  const v2x = px - ax;
  const v2y = py - ay;
  const dot00 = v0x * v0x + v0y * v0y;
  const dot01 = v0x * v1x + v0y * v1y;
  const dot02 = v0x * v2x + v0y * v2y;
  const dot11 = v1x * v1x + v1y * v1y;
  const dot12 = v1x * v2x + v1y * v2y;
  const inv = 1 / (dot00 * dot11 - dot01 * dot01);
  const u = (dot11 * dot02 - dot01 * dot12) * inv;
  const v = (dot00 * dot12 - dot01 * dot02) * inv;
  return u >= 0 && v >= 0 && u + v <= 1;
}

function render(size, { maskable = false } = {}) {
  const pixels = Buffer.alloc(size * size * 4);
  const samples = 3;
  const radius = size * 0.23;
  const scale = maskable ? 0.8 : 1;
  const contentOffset = maskable ? size * 0.1 : 0;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = x + (sx + 0.5) / samples;
          const py = y + (sy + 0.5) / samples;
          const nx = (px - contentOffset) / (size * scale);
          const ny = (py - contentOffset) / (size * scale);

          if (!maskable && !insideRoundedRect(px, py, size, radius)) continue;

          // Fondo con gradiente diagonal + brillo cálido.
          let cr = mix(20, 8, (nx + ny) / 2);
          let cg = mix(18, 8, (nx + ny) / 2);
          let cb = mix(28, 12, (nx + ny) / 2);
          const glow = Math.max(0, 1 - Math.hypot(nx - 0.34, ny - 0.26) / 0.62);
          cr = mix(cr, 234, glow * 0.16);
          cg = mix(cg, 167, glow * 0.16);
          cb = mix(cb, 44, glow * 0.16);

          // Anillo.
          const ringDistance = Math.abs(Math.hypot(nx - 0.5, ny - 0.5) - 0.34);
          if (ringDistance < 0.014) {
            const t = 1 - ringDistance / 0.014;
            cr = mix(cr, 247, 0.42 * t);
            cg = mix(cg, 193, 0.42 * t);
            cb = mix(cb, 75, 0.42 * t);
          }

          // Triángulo de play.
          if (
            pointInTriangle(nx, ny, 0.415, 0.315, 0.415, 0.685, 0.7, 0.5) &&
            nx > 0.4 &&
            nx < 0.72
          ) {
            const t = Math.min(1, Math.max(0, (ny - 0.3) / 0.4));
            cr = mix(255, 226, t);
            cg = mix(215, 144, t);
            cb = mix(117, 28, t);
          }

          // Punto rosa: guiño a "dúo".
          if (Math.hypot(nx - 0.735, ny - 0.735) < 0.045) {
            cr = 226;
            cg = 85;
            cb = 112;
          }

          r += cr;
          g += cg;
          b += cb;
          a += 255;
        }
      }

      const total = samples * samples;
      const idx = (y * size + x) * 4;
      pixels[idx] = Math.round(r / total);
      pixels[idx + 1] = Math.round(g / total);
      pixels[idx + 2] = Math.round(b / total);
      pixels[idx + 3] = Math.round(a / total);
    }
  }

  return encodePng(size, size, pixels);
}

const targets = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-maskable-512.png', size: 512, maskable: true },
];

for (const target of targets) {
  const png = render(target.size, { maskable: target.maskable });
  writeFileSync(path.join(outDir, target.name), png);
  console.log(`✓ ${target.name} (${target.size}px)`);
}
