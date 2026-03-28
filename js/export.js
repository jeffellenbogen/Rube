import { getState, loadState } from './state.js';
import { getRequirements } from './tracker.js';

const KEYWORD = 'RubeGoldbergState';
const PNG_SIG = [137,80,78,71,13,10,26,10];

// CRC-32 table
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (const b of bytes) crc = crcTable[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export function encodeITXt(keyword, text) {
  const enc = new TextEncoder();
  const kw = enc.encode(keyword);
  const tx = enc.encode(text);
  // iTXt: keyword + null + compression flag(0) + compression method(0) + language tag(empty) + null + translated keyword(empty) + null + text
  const data = new Uint8Array(kw.length + 1 + 1 + 1 + 1 + 1 + tx.length);
  data.set(kw, 0);
  // rest are 0 (nulls and flags already 0)
  data.set(tx, kw.length + 5);

  const typeBytes = [105,84,88,116]; // 'iTXt'
  const crc = crc32([...typeBytes, ...data]);
  const buf = new ArrayBuffer(4 + 4 + data.length + 4);
  const view = new DataView(buf);
  view.setUint32(0, data.length);
  typeBytes.forEach((b, i) => view.setUint8(4 + i, b));
  data.forEach((b, i) => view.setUint8(8 + i, b));
  view.setUint32(8 + data.length, crc);
  return buf;
}

export function decodeITXt(chunkBuf, keyword) {
  const view = new DataView(chunkBuf);
  const type = String.fromCharCode(view.getUint8(4), view.getUint8(5), view.getUint8(6), view.getUint8(7));
  if (type !== 'iTXt') return null;
  const dataLen = view.getUint32(0);
  const data = new Uint8Array(chunkBuf, 8, dataLen);
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  const kw = enc.encode(keyword);
  // Check keyword matches
  for (let i = 0; i < kw.length; i++) if (data[i] !== kw[i]) return null;
  if (data[kw.length] !== 0) return null;
  // Skip null + 3 flag/method bytes + empty lang + null + empty translated + null
  const textStart = kw.length + 5;
  return dec.decode(data.slice(textStart));
}

function injectChunk(pngBuffer, chunkBuf) {
  // Find first IDAT offset
  const view = new DataView(pngBuffer);
  let offset = 8; // skip PNG signature
  let idatOffset = -1;
  while (offset < pngBuffer.byteLength) {
    const len = view.getUint32(offset);
    const type = String.fromCharCode(view.getUint8(offset+4), view.getUint8(offset+5), view.getUint8(offset+6), view.getUint8(offset+7));
    if (type === 'IDAT') { idatOffset = offset; break; }
    offset += 4 + 4 + len + 4;
  }
  if (idatOffset === -1) throw new Error('No IDAT chunk found');

  const before = new Uint8Array(pngBuffer, 0, idatOffset);
  const after = new Uint8Array(pngBuffer, idatOffset);
  const chunk = new Uint8Array(chunkBuf);

  const result = new Uint8Array(before.length + chunk.length + after.length);
  result.set(before, 0);
  result.set(chunk, before.length);
  result.set(after, before.length + chunk.length);
  return result.buffer;
}

const MACHINE_LABELS = {
  lever: 'Lever', pulley: 'Pulley', inclinedPlane: 'Inclined Plane',
  wheelAxle: 'Wheel & Axle', wedge: 'Wedge', screw: 'Screw',
};

export async function downloadPNG(svgEl) {
  const state = getState();
  if (svgEl.clientWidth === 0 || svgEl.clientHeight === 0) throw new Error('Canvas has zero dimensions — SVG may not be visible');

  const req = getRequirements(state);
  const teamName = (state.meta?.title && state.meta.title !== 'Team Name') ? state.meta.title : 'Team Name';

  // === Page: landscape letter at 150 DPI (11" × 8.5") ===
  const PAGE_W = 1650, PAGE_H = 1275;
  const MARGIN = 54;
  const HEADER_H = 180;
  const FOOTER_H = 48;

  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W; canvas.height = PAGE_H;
  const ctx = canvas.getContext('2d');

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);

  // Outer page frame
  ctx.strokeStyle = '#0d1f35';
  ctx.lineWidth = 3;
  ctx.strokeRect(MARGIN - 12, MARGIN - 12, PAGE_W - 2*(MARGIN-12), PAGE_H - 2*(MARGIN-12));

  // ── HEADER ──────────────────────────────────────────────────────────────
  // Top rule
  ctx.fillStyle = '#0d1f35';
  ctx.fillRect(MARGIN, MARGIN, PAGE_W - 2*MARGIN, 4);

  // Brand + date row
  ctx.font = 'bold 13px "Courier New", Courier, monospace';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#4a7a9a';
  ctx.textAlign = 'left';
  ctx.fillText('RUBE GOLDBERG PLANNING SITE', MARGIN, MARGIN + 10);
  ctx.textAlign = 'right';
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  ctx.fillText(dateStr, PAGE_W - MARGIN, MARGIN + 10);

  // Requirements panel — right side of header
  const REQ_W = 330, REQ_PAD = 10;
  const reqX = PAGE_W - MARGIN - REQ_W;
  const reqY = MARGIN + 32;
  const reqH = HEADER_H - 40;

  ctx.strokeStyle = '#b0c8e0';
  ctx.lineWidth = 1;
  ctx.strokeRect(reqX, reqY, REQ_W, reqH);

  const mono = (size) => `${size}px "Courier New", Courier, monospace`;
  ctx.font = `bold ${mono(11)}`;
  ctx.fillStyle = '#0d1f35';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('REQUIREMENTS', reqX + REQ_PAD, reqY + REQ_PAD);

  // Machines
  const machOK = req.machinesMet;
  ctx.font = mono(11);
  ctx.fillStyle = machOK ? '#1a6a3a' : '#aa3333';
  ctx.fillText(`Simple Machines: ${req.machineTypes.length} used  (3+ required)  ${machOK ? '✓' : '✗'}`, reqX + REQ_PAD, reqY + REQ_PAD + 18);

  let mY = reqY + REQ_PAD + 34;
  for (const sub of req.allMachines) {
    const used = req.machineTypes.includes(sub);
    ctx.fillStyle = used ? '#1a6a3a' : '#aaaaaa';
    ctx.fillText(`  ${used ? '✓' : '○'}  ${MACHINE_LABELS[sub]}`, reqX + REQ_PAD, mY);
    mY += 14;
  }

  // Steps
  mY += 4;
  const stOK = req.stepsMet;
  ctx.fillStyle = stOK ? '#1a6a3a' : '#aa3333';
  ctx.fillText(`Steps: ${req.steps}  (5+ required)  ${stOK ? '✓' : '✗'}`, reqX + REQ_PAD, mY);

  // Team name — large, left-aligned, vertically centered in header area left of req panel
  const nameAreaW = reqX - MARGIN - 20;
  const nameAreaMidY = MARGIN + 32 + (HEADER_H - 40) / 2;
  let nameFontSize = 62;
  ctx.font = `bold ${nameFontSize}px "Courier New", Courier, monospace`;
  while (ctx.measureText(teamName).width > nameAreaW && nameFontSize > 22) {
    nameFontSize -= 2;
    ctx.font = `bold ${nameFontSize}px "Courier New", Courier, monospace`;
  }
  ctx.fillStyle = '#0d1f35';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(teamName, MARGIN, nameAreaMidY, nameAreaW);

  // Header bottom rule
  ctx.fillStyle = '#0d1f35';
  ctx.fillRect(MARGIN, MARGIN + HEADER_H, PAGE_W - 2*MARGIN, 2);

  // ── SVG CANVAS AREA ─────────────────────────────────────────────────────
  const areaX = MARGIN;
  const areaY = MARGIN + HEADER_H + 10;
  const areaW = PAGE_W - 2*MARGIN;
  const areaH = PAGE_H - areaY - FOOTER_H - MARGIN - 10;

  // Render the live SVG
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svgEl);
  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml' });
  const svgUrl = URL.createObjectURL(svgBlob);
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = svgUrl; });
  URL.revokeObjectURL(svgUrl);

  const srcW = svgEl.clientWidth, srcH = svgEl.clientHeight;
  const scale = Math.min(areaW / srcW, areaH / srcH);
  const drawW = srcW * scale, drawH = srcH * scale;
  const drawX = areaX + (areaW - drawW) / 2;
  const drawY = areaY + (areaH - drawH) / 2;

  ctx.drawImage(img, drawX, drawY, drawW, drawH);

  // Light border around SVG
  ctx.strokeStyle = '#b0c8e0';
  ctx.lineWidth = 1;
  ctx.strokeRect(drawX, drawY, drawW, drawH);

  // ── FOOTER ──────────────────────────────────────────────────────────────
  const footerY = PAGE_H - MARGIN - FOOTER_H;
  ctx.fillStyle = '#0d1f35';
  ctx.fillRect(MARGIN, footerY, PAGE_W - 2*MARGIN, 2);

  ctx.font = mono(11);
  ctx.fillStyle = '#6a8aaa';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText('RUBE GOLDBERG PLANNING SITE', PAGE_W / 2, footerY + FOOTER_H / 2);

  ctx.fillStyle = '#0d1f35';
  ctx.fillRect(MARGIN, PAGE_H - MARGIN, PAGE_W - 2*MARGIN, 4);

  // ── INJECT METADATA & SAVE ──────────────────────────────────────────────
  const pngBlob = await new Promise(res => canvas.toBlob(res, 'image/png'));
  const pngBuffer = await pngBlob.arrayBuffer();
  const chunkBuf = encodeITXt(KEYWORD, JSON.stringify(state));
  const finalBuf = injectChunk(pngBuffer, chunkBuf);

  const safeName = teamName.replace(/[^a-z0-9\s]/gi, '').trim().replace(/\s+/g, '-') || 'rube-goldberg';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([finalBuf], { type: 'image/png' }));
  a.download = `${safeName}-plan.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function uploadPNG(file) {
  const buffer = await file.arrayBuffer();
  const sig = new Uint8Array(buffer, 0, 8);
  const valid = PNG_SIG.every((b, i) => b === sig[i]);
  if (!valid) return { error: "This file doesn't contain a saved project from this version of the planner." };

  // Scan chunks for iTXt with our keyword
  const view = new DataView(buffer);
  let offset = 8;
  while (offset + 12 <= buffer.byteLength) {
    const len = view.getUint32(offset);
    const type = String.fromCharCode(view.getUint8(offset+4), view.getUint8(offset+5), view.getUint8(offset+6), view.getUint8(offset+7));
    if (type === 'iTXt') {
      const chunkBuf = buffer.slice(offset, offset + 4 + 4 + len + 4);
      const text = decodeITXt(chunkBuf, KEYWORD);
      if (text) {
        let parsed;
        try { parsed = JSON.parse(text); } catch { continue; }
        if (parsed.version !== 2) return { error: 'This project was saved with an incompatible version of the planner.' };
        return { state: parsed };
      }
    }
    offset += 4 + 4 + len + 4;
  }
  return { error: "This file doesn't contain a saved project from this version of the planner." };
}
