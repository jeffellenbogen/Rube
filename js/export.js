import { getState, loadState } from './state.js';
import { cmToPx } from './canvas.js';
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

  const teamName = (state.meta?.title && state.meta.title !== 'Team Name') ? state.meta.title : 'Team Name';

  // Build BOM (components only — env items excluded per spec)
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
  const HEADER_H = 130;
  const FRAME = MARGIN - 12;

  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W; canvas.height = PAGE_H;
  const ctx = canvas.getContext('2d');
  const mono = size => `bold ${size}px "Courier New", Courier, monospace`;

  // White background + outer frame
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  ctx.strokeStyle = '#0d1f35';
  ctx.lineWidth = 3;
  ctx.strokeRect(FRAME, FRAME, PAGE_W - 2*FRAME, PAGE_H - 2*FRAME);

  // ── HEADER ───────────────────────────────────────────────────────────────
  ctx.fillStyle = '#0d1f35';
  ctx.fillRect(MARGIN, MARGIN, PAGE_W - 2*MARGIN, 4); // top rule

  const titleAreaW = PAGE_W - 2*MARGIN - 140; // leave room for date on right
  const TITLE_TEXT = 'RUBE GOLDBERG PLAN';
  let titleSize = 52;
  ctx.font = mono(titleSize);
  while (ctx.measureText(TITLE_TEXT).width > titleAreaW && titleSize > 18) {
    titleSize -= 2; ctx.font = mono(titleSize);
  }

  let nameSize = titleSize;
  ctx.font = mono(nameSize);
  while (ctx.measureText(teamName).width > titleAreaW && nameSize > 18) {
    nameSize -= 2; ctx.font = mono(nameSize);
  }

  // Date — small, top-right
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  ctx.font = `12px "Courier New", Courier, monospace`;
  ctx.fillStyle = '#4a7a9a';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(dateStr, PAGE_W - MARGIN, MARGIN + 10);

  // Title
  ctx.font = mono(titleSize);
  ctx.fillStyle = '#4a7a9a';
  ctx.textAlign = 'left';
  ctx.fillText(TITLE_TEXT, MARGIN, MARGIN + 10);

  // Team name
  ctx.font = mono(nameSize);
  ctx.fillStyle = '#0d1f35';
  ctx.fillText(teamName, MARGIN, MARGIN + 10 + titleSize + 8);

  // Header bottom rule
  ctx.fillStyle = '#0d1f35';
  ctx.fillRect(MARGIN, MARGIN + HEADER_H, PAGE_W - 2*MARGIN, 2);

  // ── MAIN AREA: canvas (left) + unified materials panel (right) ───────────
  const mainY = MARGIN + HEADER_H + 10;
  const mainH = PAGE_H - mainY - MARGIN - 10;
  const PANEL_W = 260, PANEL_GAP = 12;
  const panelX = PAGE_W - MARGIN - PANEL_W;
  const canvasAreaW = panelX - MARGIN - PANEL_GAP;

  // Panel border
  ctx.strokeStyle = '#b0c8e0';
  ctx.lineWidth = 1;
  ctx.strokeRect(panelX, mainY, PANEL_W, mainH);

  const PAD = 10;
  const COUNT_COL = panelX + PANEL_W - PAD;
  let pY = mainY + PAD;

  // Panel title
  ctx.font = mono(12);
  ctx.fillStyle = '#0d1f35';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('MATERIALS USED', panelX + PAD, pY);
  pY += 5;
  ctx.strokeStyle = '#0d1f35';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(panelX + PAD, pY + 9); ctx.lineTo(panelX + PANEL_W - PAD, pY + 9); ctx.stroke();
  pY += 18;

  function panelSection(title, items) {
    ctx.font = `bold 10px "Courier New", Courier, monospace`;
    ctx.fillStyle = '#4a7a9a';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, panelX + PAD, pY);
    pY += 3;
    ctx.strokeStyle = '#c0d4e8';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(panelX + PAD, pY + 10); ctx.lineTo(panelX + PANEL_W - PAD, pY + 10); ctx.stroke();
    pY += 14;

    if (items.length === 0) {
      ctx.font = `11px "Courier New", Courier, monospace`;
      ctx.fillStyle = '#aaaaaa';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('none added', panelX + PAD + 4, pY);
      pY += 15;
    } else {
      for (const { name, count } of items) {
        ctx.font = `11px "Courier New", Courier, monospace`;
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#4a7a9a';
        ctx.textAlign = 'right';
        ctx.fillText(`${count}×`, COUNT_COL, pY);
        ctx.fillStyle = '#1a1a3a';
        ctx.textAlign = 'left';
        ctx.fillText(name, panelX + PAD + 4, pY);
        pY += 15;
      }
    }
    pY += 10;
  }

  const req = getRequirements(state);

  panelSection('SIMPLE MACHINES', bom.machines);
  panelSection('MATERIALS', bom.materials);

  // Steps counter
  ctx.font = `bold 10px "Courier New", Courier, monospace`;
  ctx.fillStyle = '#4a7a9a';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('STEPS', panelX + PAD, pY);
  pY += 3;
  ctx.strokeStyle = '#c0d4e8';
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(panelX + PAD, pY + 10); ctx.lineTo(panelX + PANEL_W - PAD, pY + 10); ctx.stroke();
  pY += 14;
  ctx.font = `11px "Courier New", Courier, monospace`;
  ctx.fillStyle = req.stepsMet ? '#00c9a7' : '#1a1a3a';
  ctx.textAlign = 'left';
  ctx.fillText(`${req.steps} of 5+`, panelX + PAD + 4, pY);
  pY += 15;

  // ── SVG CANVAS ───────────────────────────────────────────────────────────
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

  // ── VISIBLE COMMENTS ─────────────────────────────────────────────────────
  const allItems = [...state.components, ...(state.environment || [])];
  const BOX_W = 130, BOX_PAD = 6, FONT_SIZE = 9, LINE_H = FONT_SIZE + 3;

  for (const item of allItems) {
    if (!item.commentVisible || !item.comment) continue;
    // Map component center-top from cm → SVG px → print canvas px
    const cx = drawX + cmToPx(item.x + item.width / 2) * scale;
    const cy = drawY + cmToPx(item.y) * scale;

    // Word-wrap text into lines
    ctx.font = `${FONT_SIZE}px "Courier New", Courier, monospace`;
    const words = item.comment.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > BOX_W - BOX_PAD * 2 && line) {
        lines.push(line); line = word;
      } else { line = test; }
    }
    if (line) lines.push(line);

    const boxH = lines.length * LINE_H + BOX_PAD * 2;
    const ARROW = 6;
    // Position above component, clamped inside drawn canvas area
    let boxX = Math.max(drawX, Math.min(cx - BOX_W / 2, drawX + drawW - BOX_W));
    let boxY = cy - boxH - ARROW - 2;
    if (boxY < drawY) boxY = cy + ARROW + 2; // flip below if too high

    // Background box
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.strokeStyle = '#00c9a7';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, BOX_W, boxH, 3);
    ctx.fill();
    ctx.stroke();

    // Connector dot
    ctx.fillStyle = '#00c9a7';
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();

    // Text
    ctx.fillStyle = '#0d1f35';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], boxX + BOX_PAD, boxY + BOX_PAD + i * LINE_H);
    }
  }

  // ── INJECT METADATA & SAVE ───────────────────────────────────────────────
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
