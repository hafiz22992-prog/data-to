// توليد أيقونات PNG للتطبيق (بدون مكتبات خارجية) — باص أبيض بشريط كهرماني على خلفية زرقاء.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "icons");

/* ---------- PNG encoder (pure Node) ---------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------- Drawing helpers (normalized coords) ---------- */
const BG = [17, 45, 112, 255]; // أزرق داكن
const ROAD = [148, 163, 184, 255]; // رمادي الطريق
const BODY = [255, 255, 255, 255]; // جسم الباص
const ROOF = [245, 158, 11, 255]; // شريط كهرماني
const WINDOW = [30, 58, 138, 255]; // النوافذ
const DOOR = [191, 219, 254, 255]; // الباب
const WHEEL = [15, 23, 42, 255]; // العجلات
const HUB = [226, 232, 240, 255]; // وسط العجلة

function makeRoundedRect(x0, y0, x1, y1, r) {
  return (u, v) => {
    if (u < x0 || u > x1 || v < y0 || v > y1) return false;
    const cx = Math.max(x0 + r, Math.min(u, x1 - r));
    const cy = Math.max(y0 + r, Math.min(v, y1 - r));
    const dx = u - cx;
    const dy = v - cy;
    return dx * dx + dy * dy <= r * r;
  };
}

function makeCircle(cx, cy, r) {
  return (u, v) => {
    const dx = u - cx;
    const dy = v - cy;
    return dx * dx + dy * dy <= r * r;
  };
}

const inBody = makeRoundedRect(0.16, 0.17, 0.84, 0.58, 0.06);
const inRoof = makeRoundedRect(0.16, 0.17, 0.84, 0.27, 0.045);
const inWin1 = makeRoundedRect(0.21, 0.31, 0.4, 0.52, 0.045);
const inWin2 = makeRoundedRect(0.44, 0.31, 0.6, 0.52, 0.045);
const inDoor = makeRoundedRect(0.64, 0.33, 0.78, 0.6, 0.03);
const inWheel1 = makeCircle(0.3, 0.66, 0.085);
const inWheel2 = makeCircle(0.7, 0.66, 0.085);
const inHub1 = makeCircle(0.3, 0.66, 0.035);
const inHub2 = makeCircle(0.7, 0.66, 0.035);

function colorAt(u, v) {
  if (inHub1(u, v) || inHub2(u, v)) return HUB;
  if (inWheel1(u, v) || inWheel2(u, v)) return WHEEL;
  if (inDoor(u, v)) return DOOR;
  if (inWin1(u, v) || inWin2(u, v)) return WINDOW;
  if (inRoof(u, v)) return ROOF;
  if (inBody(u, v)) return BODY;
  if (v >= 0.7 && v <= 0.84) return ROAD;
  return BG;
}

function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const SS = 2; // supersampling
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size;
          const v = (y + (sy + 0.5) / SS) / size;
          const c = colorAt(u, v);
          r += c[0]; g += c[1]; b += c[2]; a += c[3];
        }
      }
      const n = SS * SS;
      const i = (y * size + x) * 4;
      rgba[i] = Math.round(r / n);
      rgba[i + 1] = Math.round(g / n);
      rgba[i + 2] = Math.round(b / n);
      rgba[i + 3] = Math.round(a / n);
    }
  }
  return encodePNG(size, size, rgba);
}

mkdirSync(OUT_DIR, { recursive: true });
const sizes = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
];
for (const { file, size } of sizes) {
  const png = renderIcon(size);
  writeFileSync(join(OUT_DIR, file), png);
  console.log(`OK ${file} (${size}x${size}) - ${png.length} bytes`);
}
console.log("Done.");
