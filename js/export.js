import { getState, loadState } from './state.js';

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

export async function downloadPNG(svgEl) {
  const state = getState();
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svgEl);
  const blob = new Blob([svgStr], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  URL.revokeObjectURL(url);

  const HEADER_H = 48;
  const canvas = document.createElement('canvas');
  canvas.width = svgEl.clientWidth;
  canvas.height = svgEl.clientHeight + HEADER_H;
  const ctx = canvas.getContext('2d');
  if (svgEl.clientWidth === 0 || svgEl.clientHeight === 0) throw new Error('Canvas has zero dimensions — SVG may not be visible');

  // Header strip with team name
  ctx.fillStyle = '#0d1f35';
  ctx.fillRect(0, 0, canvas.width, HEADER_H);
  ctx.fillStyle = '#1a3a5c';
  ctx.fillRect(0, HEADER_H - 1, canvas.width, 1);

  const teamName = state.meta.title && state.meta.title !== 'Team Name' ? state.meta.title : '';
  ctx.textBaseline = 'middle';
  if (teamName) {
    ctx.fillStyle = '#c8d8e8';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(teamName, 16, HEADER_H / 2);
  }
  ctx.fillStyle = '#5a7a9a';
  ctx.font = '11px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('RUBE GOLDBERG PLANNING SITE', canvas.width - 16, HEADER_H / 2);
  ctx.textAlign = 'left';

  ctx.drawImage(img, 0, HEADER_H);

  const pngBlob = await new Promise(res => canvas.toBlob(res, 'image/png'));
  const pngBuffer = await pngBlob.arrayBuffer();
  const chunkBuf = encodeITXt(KEYWORD, JSON.stringify(state));
  const finalBuf = injectChunk(pngBuffer, chunkBuf);

  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([finalBuf], { type: 'image/png' }));
  a.download = 'rube-goldberg-plan.png';
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
