#!/usr/bin/env node
/* make-icons.js - generator ikon PWA, NOL dependency (cuma zlib bawaan Node).
 * Glyph beres.: kotak centang bersudut dengan centang tebal keluar sedikit dari kotak.
 * Pakai: node tools/make-icons.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'icons');
fs.mkdirSync(OUT, { recursive: true });

const BG = [0x0b, 0x0b, 0x0c];   // off-black
const FG = [0xc6, 0xf2, 0x4e];   // lime aksen

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, cr]);
}
function png(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* jarak titik ke ruas garis, dipakai buat menggambar stroke tebal */
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const L = dx * dx + dy * dy;
  let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + t * dx, qy = ay + t * dy;
  return Math.hypot(px - qx, py - qy);
}

/* Glyph: kotak (outline bersudut membulat) + centang tebal.
   Koordinat dalam ruang 0..1, nanti diskalakan ke area glyph. */
function inGlyph(u, v, w) {
  // w = tebal garis relatif
  const r = 0.14;                       // radius sudut kotak
  const inset = w / 2;
  // outline kotak: |sdf rounded-rect| < w/2
  const hx = 0.5 - inset, hy = 0.5 - inset;
  const qx = Math.abs(u - 0.5) - (hx - r), qy = Math.abs(v - 0.5) - (hy - r);
  const sd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  // potong sisi kanan-atas biar centang bisa "keluar" tanpa nabrak garis
  const gap = (u > 0.60 && v < 0.40);
  if (!gap && Math.abs(sd) < w / 2) return true;

  // centang: dua ruas, ujung kanan naik keluar kotak
  const t = w * 1.15;
  if (segDist(u, v, 0.26, 0.52, 0.44, 0.70) < t / 2) return true;
  if (segDist(u, v, 0.44, 0.70, 0.80, 0.24) < t / 2) return true;
  return false;
}

function render(size, { pad, rounded }) {
  const SS = 4;
  const W = size, H = size;
  const buf = Buffer.alloc(W * H * 4);
  const corner = rounded ? W * 0.22 : 0;
  const gx0 = W * pad, gspan = W * (1 - pad * 2);
  const stroke = 0.115;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let hitFg = 0, hitBg = 0, n = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS, py = y + (sy + 0.5) / SS;
          n++;
          if (corner) {
            const qx = Math.max(corner - px, px - (W - corner), 0);
            const qy = Math.max(corner - py, py - (H - corner), 0);
            if (qx * qx + qy * qy > corner * corner) continue;
          }
          hitBg++;
          const u = (px - gx0) / gspan, v = (py - gx0) / gspan;
          if (u >= 0 && u <= 1 && v >= 0 && v <= 1 && inGlyph(u, v, stroke)) hitFg++;
        }
      }
      if (!hitBg) continue;
      const i = (y * W + x) * 4;
      const aBg = hitBg / n, k = hitFg / hitBg;
      buf[i]     = Math.round(BG[0] * (1 - k) + FG[0] * k);
      buf[i + 1] = Math.round(BG[1] * (1 - k) + FG[1] * k);
      buf[i + 2] = Math.round(BG[2] * (1 - k) + FG[2] * k);
      buf[i + 3] = Math.round(aBg * 255);
    }
  }
  return png(W, H, buf);
}

const jobs = [
  ['icon-192.png',         192, { pad: 0.24, rounded: true  }],
  ['icon-512.png',         512, { pad: 0.24, rounded: true  }],
  ['maskable-192.png',     192, { pad: 0.33, rounded: false }],
  ['maskable-512.png',     512, { pad: 0.33, rounded: false }],
  ['apple-touch-icon.png', 180, { pad: 0.22, rounded: false }],
  ['favicon-32.png',        32, { pad: 0.16, rounded: true  }],
  ['icon-1024.png',       1024, { pad: 0.24, rounded: true  }],
];

for (const [name, size, opt] of jobs) {
  const buf = render(size, opt);
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log(`${name}  ${size}x${size}  ${(buf.length / 1024).toFixed(1)} KB`);
}
console.log('\nselesai ->', OUT);
