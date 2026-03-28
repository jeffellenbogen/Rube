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

const MACHINE_SUBTYPES = new Set(['lever','pulley','inclinedPlane','wheelAxle','wedge','screw']);
const ITEM_LABELS = {
  lever:'Lever', pulley:'Pulley', inclinedPlane:'Inclined Plane',
  wheelAxle:'Wheel & Axle', wedge:'Wedge', screw:'Screw',
  domino:'Domino', ball:'Ball', toyCar:'Toy Car', string:'String',
  cup:'Cup', bucket:'Bucket', tube:'Tube', box:'Crate',
  cardboard:'Cardboard', yardstick:'Yardstick', protractor:'Protractor',
  matchboxTrack:'Car Track', book:'Book', custom:'Custom',
};

export async function downloadPNG(svgEl) {
  const state = getState();
  if (svgEl.clientWidth === 0 || svgEl.clientHeight === 0) throw new Error('Canvas has zero dimensions — SVG may not be visible');

  const req = getRequirements(state);
  const teamName = (state.meta?.title && state.meta.title !== 'Team Name') ? state.meta.title : 'Team Name';

  // Split BOM into machines vs materials (environment items are in state.environment, not state.components)
  const bom = (() => {
    const machines = {}, materials = {};
    for (const c of state.components) {
      if (c.type === 'marker') continue;
      const label = ITEM_LABELS[c.subtype] || (c.name || c.subtype);
      const bin = MACHINE_SUBTYPES.has(c.subtype) ? machines : materials;
      bin[label] = (bin[label] || 0) + 1;
    }
    const toList = obj => Object.entries(obj).sort((a,b) => a[0].localeCompare(b[0])).map(([name,count]) => ({ name, count }));
    return { machines: toList(machines), materials: toList(materials) };
  })();

  // === Page: landscape letter at 150 DPI (11" × 8.5") ===
  const PAGE_W = 1650, PAGE_H = 1275;
  const MARGIN = 54;
  const HEADER_H = 160;  // header area height (top rule → bottom rule)
  const FRAME = MARGIN - 12; // outer frame inset

  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W; canvas.height = PAGE_H;
  const ctx = canvas.getContext('2d');
  const mono = size => `bold ${size}px "Courier New", Courier, monospace`;

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);

  // Outer page frame
  ctx.strokeStyle = '#0d1f35';
  ctx.lineWidth = 3;
  ctx.strokeRect(FRAME, FRAME, PAGE_W - 2*FRAME, PAGE_H - 2*FRAME);

  // ── HEADER ──────────────────────────────────────────────────────────────
  ctx.fillStyle = '#0d1f35';
  ctx.fillRect(MARGIN, MARGIN, PAGE_W - 2*MARGIN, 4);  // top rule

  // Requirements panel — top-right of header
  const REQ_W = 320, REQ_PAD = 10;
  const reqX = PAGE_W - MARGIN - REQ_W;
  const reqY = MARGIN + 14;
  const reqH = HEADER_H - 22;

  ctx.strokeStyle = '#b0c8e0';
  ctx.lineWidth = 1;
  ctx.strokeRect(reqX, reqY, REQ_W, reqH);

  ctx.font = mono(11);
  ctx.fillStyle = '#0d1f35';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('REQUIREMENTS', reqX + REQ_PAD, reqY + REQ_PAD);

  const machOK = req.machinesMet;
  ctx.font = `${11}px "Courier New", Courier, monospace`;
  ctx.fillStyle = machOK ? '#1a6a3a' : '#aa3333';
  ctx.fillText(`Simple Machines: ${req.machineTypes.length} of 3+  ${machOK ? '✓' : '✗'}`, reqX + REQ_PAD, reqY + REQ_PAD + 18);

  let rY = reqY + REQ_PAD + 34;
  for (const sub of req.allMachines) {
    const used = req.machineTypes.includes(sub);
    ctx.fillStyle = used ? '#1a6a3a' : '#aaaaaa';
    ctx.fillText(`  ${used ? '✓' : '○'}  ${ITEM_LABELS[sub]}`, reqX + REQ_PAD, rY);
    rY += 14;
  }
  rY += 4;
  const stOK = req.stepsMet;
  ctx.fillStyle = stOK ? '#1a6a3a' : '#aa3333';
  ctx.fillText(`Steps: ${req.steps} of 5+  ${stOK ? '✓' : '✗'}`, reqX + REQ_PAD, rY);

  // "RUBE GOLDBERG PLAN" — large, same target size as team name
  const titleAreaW = reqX - MARGIN - 24;
  const TITLE_TEXT = 'RUBE GOLDBERG PLAN';
  let titleSize = 42;
  ctx.font = mono(titleSize);
  while (ctx.measureText(TITLE_TEXT).width > titleAreaW && titleSize > 18) {
    titleSize -= 2; ctx.font = mono(titleSize);
  }

  // Team name — same font size as title (scale down independently if longer)
  let nameSize = titleSize;
  ctx.font = mono(nameSize);
  while (ctx.measureText(teamName).width > titleAreaW && nameSize > 18) {
    nameSize -= 2; ctx.font = mono(nameSize);
  }

  // Date — small, top-right of left region, same line as title
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  ctx.font = `12px "Courier New", Courier, monospace`;
  ctx.fillStyle = '#4a7a9a';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(dateStr, reqX - 16, MARGIN + 10);

  // Title line
  ctx.font = mono(titleSize);
  ctx.fillStyle = '#4a7a9a';
  ctx.textAlign = 'left';
  ctx.fillText(TITLE_TEXT, MARGIN, MARGIN + 10);

  // Team name line
  ctx.font = mono(nameSize);
  ctx.fillStyle = '#0d1f35';
  const nameY = MARGIN + 10 + titleSize + 10;
  ctx.fillText(teamName, MARGIN, nameY, titleAreaW);

  // Header bottom rule
  ctx.fillStyle = '#0d1f35';
  ctx.fillRect(MARGIN, MARGIN + HEADER_H, PAGE_W - 2*MARGIN, 2);

  // ── MAIN AREA: canvas (left) + BOM panel (right) ─────────────────────
  const mainY = MARGIN + HEADER_H + 10;
  const mainH = PAGE_H - mainY - MARGIN - 10;  // reaches inner bottom frame edge
  const BOM_W = 270, BOM_GAP = 12;
  const bomX = PAGE_W - MARGIN - BOM_W;
  const canvasAreaW = bomX - MARGIN - BOM_GAP;

  // BOM panel border
  ctx.strokeStyle = '#b0c8e0';
  ctx.lineWidth = 1;
  ctx.strokeRect(bomX, mainY, BOM_W, mainH);

  const BOM_PAD = 10;
  let bY = mainY + BOM_PAD;

  function bomSection(title, items) {
    ctx.font = mono(10);
    ctx.fillStyle = '#4a7a9a';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, bomX + BOM_PAD, bY);
    bY += 14;
    ctx.fillStyle = '#0d1f35';
    ctx.strokeStyle = '#b0c8e0';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(bomX + BOM_PAD, bY); ctx.lineTo(bomX + BOM_W - BOM_PAD, bY); ctx.stroke();
    bY += 6;
    if (items.length === 0) {
      ctx.font = `italic 10px "Courier New", Courier, monospace`;
      ctx.fillStyle = '#aaaaaa';
      ctx.fillText('none added', bomX + BOM_PAD, bY);
      bY += 14;
    } else {
      ctx.font = `11px "Courier New", Courier, monospace`;
      ctx.fillStyle = '#1a1a3a';
      for (const { name, count } of items) {
        ctx.fillText(`${count}×  ${name}`, bomX + BOM_PAD, bY);
        bY += 14;
      }
    }
    bY += 8;
  }

  ctx.font = mono(12);
  ctx.fillStyle = '#0d1f35';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('BILL OF MATERIALS', bomX + BOM_PAD, bY);
  bY += 18;

  bomSection('SIMPLE MACHINES', bom.machines);
  bomSection('MATERIALS', bom.materials);

  // ── SVG CANVAS ──────────────────────────────────────────────────────────
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svgEl);
  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml' });
  const svgUrl = URL.createObjectURL(svgBlob);
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = svgUrl; });
  URL.revokeObjectURL(svgUrl);

  const srcW = svgEl.clientWidth, srcH = svgEl.clientHeight;
  const scale = Math.min(canvasAreaW / srcW, mainH / srcH);
  const drawW = srcW * scale, drawH = srcH * scale;
  const drawX = MARGIN + (canvasAreaW - drawW) / 2;
  const drawY = mainY + (mainH - drawH) / 2;

  ctx.drawImage(img, drawX, drawY, drawW, drawH);
  ctx.strokeStyle = '#b0c8e0';
  ctx.lineWidth = 1;
  ctx.strokeRect(drawX, drawY, drawW, drawH);

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
