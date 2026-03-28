import { cmToPx } from '../canvas.js';
import { getSelected, getConnDrag } from '../drag.js';
import { getAttachPx, getStringEndpoints } from './attachPoints.js';

const NS = 'http://www.w3.org/2000/svg';


export function renderUI(state, layer) {
  layer.innerHTML = '';
  const selId = getSelected();
  if (!selId) return;
  const comp = [...state.components, ...state.environment].find(c => c.id === selId);
  if (!comp) return;

  const compCx = cmToPx(comp.x + comp.width / 2);
  const compCy = cmToPx(comp.y + comp.height / 2);
  const w = cmToPx(comp.width), h = cmToPx(comp.height);
  const w2 = w / 2, h2 = h / 2;
  const pad = 4;
  const rad = (comp.rotation || 0) * Math.PI / 180;
  const flipX = comp.flipped ? -1 : 1;

  // Convert component-local coords (origin = component center, unrotated) to SVG coords.
  // Used for selection ring, resize handles, and sub-part handles that must follow rotation.
  function L(lx, ly) {
    const rdx = lx * Math.cos(rad) - ly * Math.sin(rad);
    const rdy = lx * Math.sin(rad) + ly * Math.cos(rad);
    return { x: compCx + rdx * flipX, y: compCy + rdy };
  }

  // String: render end-point handle balls instead of standard ring/handles
  const isString = comp.subtype === 'string' && !!state.components.find(c => c.id === selId);
  if (isString) {
    const { x1, y1, x2, y2 } = getStringEndpoints(comp, state);
    // Selection highlight line
    const hl = document.createElementNS(NS, 'line');
    hl.setAttribute('x1', x1); hl.setAttribute('y1', y1);
    hl.setAttribute('x2', x2); hl.setAttribute('y2', y2);
    hl.setAttribute('stroke', '#ff7b2e'); hl.setAttribute('stroke-width', 5);
    hl.setAttribute('opacity', 0.35); hl.setAttribute('stroke-linecap', 'round');
    layer.appendChild(hl);
    // Delete button at midpoint
    if (comp.subtype !== 'start' && comp.subtype !== 'finish') {
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const btn = document.createElementNS(NS, 'g');
      btn.dataset.action = 'delete'; btn.dataset.targetId = selId;
      btn.setAttribute('cursor', 'pointer');
      const bg = document.createElementNS(NS, 'circle');
      bg.setAttribute('cx', mx - 18); bg.setAttribute('cy', my); bg.setAttribute('r', 7);
      bg.setAttribute('fill', '#ef476f'); bg.setAttribute('stroke', '#fff'); bg.setAttribute('stroke-width', 1);
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', mx - 18); t.setAttribute('y', my);
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'middle');
      t.setAttribute('fill', '#fff'); t.setAttribute('font-size', 11); t.textContent = '×';
      btn.appendChild(bg); btn.appendChild(t); layer.appendChild(btn);
    }
    // Comment button at midpoint
    {
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const commentBtn = document.createElementNS(NS, 'g');
      commentBtn.dataset.action = 'comment'; commentBtn.dataset.targetId = selId;
      commentBtn.setAttribute('cursor', 'pointer');
      const cbg = document.createElementNS(NS, 'circle');
      cbg.setAttribute('cx', mx + 2); cbg.setAttribute('cy', my - 18); cbg.setAttribute('r', 8);
      cbg.setAttribute('fill', comp.comment ? '#ff7b2e' : '#1a3a5c');
      cbg.setAttribute('stroke', '#ff7b2e'); cbg.setAttribute('stroke-width', 1);
      const ct = document.createElementNS(NS, 'text');
      ct.setAttribute('x', mx + 2); ct.setAttribute('y', my - 18);
      ct.setAttribute('text-anchor', 'middle'); ct.setAttribute('dominant-baseline', 'middle');
      ct.setAttribute('fill', '#fff'); ct.setAttribute('font-size', 9); ct.textContent = '💬';
      commentBtn.appendChild(cbg); commentBtn.appendChild(ct); layer.appendChild(commentBtn);
    }
    // End-point handle balls
    for (const [name, px, py] of [['end1', x1, y1], ['end2', x2, y2]]) {
      const ball = document.createElementNS(NS, 'circle');
      ball.setAttribute('cx', px); ball.setAttribute('cy', py);
      ball.setAttribute('r', 7); ball.setAttribute('fill', '#00c9a7');
      ball.setAttribute('stroke', '#fff'); ball.setAttribute('stroke-width', 1.5);
      ball.dataset.handle = name; ball.dataset.compId = selId;
      ball.setAttribute('cursor', 'grab');
      layer.appendChild(ball);
    }
    // Hover highlights for connectable attachment points during conn drag
    const cd2 = getConnDrag();
    if (cd2) {
      const HOVER_DIST = 40;
      const ENV_ATTACH_SUBTYPES2 = new Set(['couch', 'stairs', 'chair', 'desk']);
      const allItems2 = [...state.components, ...(state.environment || []).filter(e => ENV_ATTACH_SUBTYPES2.has(e.subtype))];
      for (const otherComp of allItems2) {
        if (otherComp.id === cd2.fromId) continue;
        const pts2 = getAttachPx(otherComp);
        for (const [, pos2] of Object.entries(pts2)) {
          const dist2 = Math.hypot(pos2.x - cd2.curPx, pos2.y - cd2.curPy);
          if (dist2 > HOVER_DIST) continue;
          const inSnap2 = dist2 < 15;
          const dot2 = document.createElementNS(NS, 'circle');
          dot2.setAttribute('cx', pos2.x); dot2.setAttribute('cy', pos2.y);
          dot2.setAttribute('r', inSnap2 ? 8 : 6); dot2.setAttribute('fill', '#00ff88');
          dot2.setAttribute('stroke', '#fff'); dot2.setAttribute('stroke-width', inSnap2 ? 2.5 : 1.5);
          dot2.setAttribute('opacity', inSnap2 ? 1 : 0.75);
          layer.appendChild(dot2);
        }
      }
    }
    return;
  }

  // Selection ring — rotated polygon following the component's actual orientation
  const ring = document.createElementNS(NS, 'polygon');
  ring.setAttribute('points', [
    L(-w2-pad, -h2-pad), L(w2+pad, -h2-pad),
    L(w2+pad,  h2+pad),  L(-w2-pad,  h2+pad),
  ].map(p => `${p.x},${p.y}`).join(' '));
  ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', '#ff7b2e');
  ring.setAttribute('stroke-width', 1.5); ring.setAttribute('stroke-dasharray', '4 3');
  layer.appendChild(ring);

  // Axis-aligned bounding box of the rotated component — used to anchor action buttons
  // so they always sit at predictable screen positions (top-left, bottom-right, etc.)
  const rotPts = [L(-w2, -h2), L(w2, -h2), L(w2, h2), L(-w2, h2)];
  const aMinX = Math.min(...rotPts.map(p => p.x));
  const aMaxX = Math.max(...rotPts.map(p => p.x));
  const aMinY = Math.min(...rotPts.map(p => p.y));
  const aMaxY = Math.max(...rotPts.map(p => p.y));
  const aMidX = (aMinX + aMaxX) / 2;

  // Delete button — left-center in component local space
  if (comp.subtype !== 'start' && comp.subtype !== 'finish') {
    const pos = L(-w2 - pad - 8, 0);
    const btn = document.createElementNS(NS, 'g');
    btn.dataset.action = 'delete'; btn.dataset.targetId = selId;
    btn.setAttribute('cursor', 'pointer');
    const bg = document.createElementNS(NS, 'circle');
    bg.setAttribute('cx', pos.x); bg.setAttribute('cy', pos.y);
    bg.setAttribute('r', 7); bg.setAttribute('fill', '#ef476f');
    bg.setAttribute('stroke', '#fff'); bg.setAttribute('stroke-width', 1);
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', pos.x); t.setAttribute('y', pos.y);
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'middle');
    t.setAttribute('fill', '#fff'); t.setAttribute('font-size', 11); t.textContent = '×';
    btn.appendChild(bg); btn.appendChild(t);
    layer.appendChild(btn);
  }

  // Comment bubble button — top-center in component local space
  {
    const pos = L(0, -h2 - pad - 8);
    const commentBtn = document.createElementNS(NS, 'g');
    commentBtn.dataset.action = 'comment'; commentBtn.dataset.targetId = selId;
    commentBtn.setAttribute('cursor', 'pointer');
    const cbg = document.createElementNS(NS, 'circle');
    cbg.setAttribute('cx', pos.x); cbg.setAttribute('cy', pos.y);
    cbg.setAttribute('r', 8);
    cbg.setAttribute('fill', comp.comment ? '#ff7b2e' : '#1a3a5c');
    cbg.setAttribute('stroke', '#ff7b2e'); cbg.setAttribute('stroke-width', 1);
    const ct = document.createElementNS(NS, 'text');
    ct.setAttribute('x', pos.x); ct.setAttribute('y', pos.y);
    ct.setAttribute('text-anchor', 'middle'); ct.setAttribute('dominant-baseline', 'middle');
    ct.setAttribute('fill', '#fff'); ct.setAttribute('font-size', 9); ct.textContent = '💬';
    commentBtn.appendChild(cbg); commentBtn.appendChild(ct);
    layer.appendChild(commentBtn);
  }

  // Subtypes that use a free-rotate yellow dot instead of the 90° ↻ button
  const FREE_ROTATE_SUBTYPES = new Set(['tube', 'yardstick', 'matchboxTrack']);

  // Rotate / Flip buttons (machine and material components only, not env or markers)
  const isComp = !!state.components.find(c => c.id === selId);
  if (isComp && comp.subtype !== 'start' && comp.subtype !== 'finish' && comp.subtype !== 'lever' && comp.subtype !== 'pulley' && comp.subtype !== 'wheelAxle' && comp.subtype !== 'box' && !FREE_ROTATE_SUBTYPES.has(comp.subtype)) {
    // Rotate ↻ — bottom-right in component local space
    const rotPos = L(w2 + pad + 8, h2 + pad + 8);
    const rotBtn = document.createElementNS(NS, 'g');
    rotBtn.dataset.action = 'rotate'; rotBtn.dataset.targetId = selId;
    rotBtn.setAttribute('cursor', 'pointer');
    const rbg = document.createElementNS(NS, 'circle');
    rbg.setAttribute('cx', rotPos.x); rbg.setAttribute('cy', rotPos.y);
    rbg.setAttribute('r', 8); rbg.setAttribute('fill', '#1a3a5c');
    rbg.setAttribute('stroke', '#ff7b2e'); rbg.setAttribute('stroke-width', 1);
    const rt = document.createElementNS(NS, 'text');
    rt.setAttribute('x', rotPos.x); rt.setAttribute('y', rotPos.y);
    rt.setAttribute('text-anchor', 'middle'); rt.setAttribute('dominant-baseline', 'middle');
    rt.setAttribute('fill', '#fff'); rt.setAttribute('font-size', 11); rt.textContent = '↻';
    rotBtn.appendChild(rbg); rotBtn.appendChild(rt);
    layer.appendChild(rotBtn);

    // Flip ↔ — bottom-left in component local space
    const flipPos = L(-w2 - pad - 8, h2 + pad + 8);
    const flipBtn = document.createElementNS(NS, 'g');
    flipBtn.dataset.action = 'flip'; flipBtn.dataset.targetId = selId;
    flipBtn.setAttribute('cursor', 'pointer');
    const fbg = document.createElementNS(NS, 'circle');
    fbg.setAttribute('cx', flipPos.x); fbg.setAttribute('cy', flipPos.y);
    fbg.setAttribute('r', 8); fbg.setAttribute('fill', '#1a3a5c');
    fbg.setAttribute('stroke', '#ff7b2e'); fbg.setAttribute('stroke-width', 1);
    const ft = document.createElementNS(NS, 'text');
    ft.setAttribute('x', flipPos.x); ft.setAttribute('y', flipPos.y);
    ft.setAttribute('text-anchor', 'middle'); ft.setAttribute('dominant-baseline', 'middle');
    ft.setAttribute('fill', '#fff'); ft.setAttribute('font-size', 11); ft.textContent = '↔';
    flipBtn.appendChild(fbg); flipBtn.appendChild(ft);
    layer.appendChild(flipBtn);
  }

  // Rotate-only button for bookshelf (env item)
  const isBookshelf = !!state.environment.find(e => e.id === selId && e.subtype === 'bookshelf');
  if (isBookshelf) {
    const rotPos = L(w2 + pad + 8, h2 + pad + 8);
    const rotBtn = document.createElementNS(NS, 'g');
    rotBtn.dataset.action = 'rotate'; rotBtn.dataset.targetId = selId;
    rotBtn.setAttribute('cursor', 'pointer');
    const rbg = document.createElementNS(NS, 'circle');
    rbg.setAttribute('cx', rotPos.x); rbg.setAttribute('cy', rotPos.y);
    rbg.setAttribute('r', 8); rbg.setAttribute('fill', '#1a3a5c');
    rbg.setAttribute('stroke', '#ff7b2e'); rbg.setAttribute('stroke-width', 1);
    const rt = document.createElementNS(NS, 'text');
    rt.setAttribute('x', rotPos.x); rt.setAttribute('y', rotPos.y);
    rt.setAttribute('text-anchor', 'middle'); rt.setAttribute('dominant-baseline', 'middle');
    rt.setAttribute('fill', '#fff'); rt.setAttribute('font-size', 11); rt.textContent = '↻';
    rotBtn.appendChild(rbg); rotBtn.appendChild(rt);
    layer.appendChild(rotBtn);
  }

  // Free-rotate dot for tube, yardstick, matchboxTrack — yellow circle with blue ∠ at bottom-right
  if (isComp && FREE_ROTATE_SUBTYPES.has(comp.subtype)) {
    const rotPos = L(w2 + pad + 8, h2 + pad + 8);
    const rBtn = document.createElementNS(NS, 'g');
    rBtn.dataset.handle = 'free-rotate'; rBtn.dataset.compId = selId;
    rBtn.setAttribute('cursor', 'crosshair');
    const rbg = document.createElementNS(NS, 'circle');
    rbg.setAttribute('cx', rotPos.x); rbg.setAttribute('cy', rotPos.y);
    rbg.setAttribute('r', 9); rbg.setAttribute('fill', '#ffd166');
    rbg.setAttribute('stroke', '#e6b800'); rbg.setAttribute('stroke-width', 1);
    const rt = document.createElementNS(NS, 'text');
    rt.setAttribute('x', rotPos.x); rt.setAttribute('y', rotPos.y);
    rt.setAttribute('text-anchor', 'middle'); rt.setAttribute('dominant-baseline', 'middle');
    rt.setAttribute('fill', '#1a3a5c'); rt.setAttribute('font-size', 11);
    rt.setAttribute('font-weight', 'bold'); rt.textContent = '∠';
    rBtn.appendChild(rbg); rBtn.appendChild(rt);
    layer.appendChild(rBtn);
  }

  // Color swatches for couch (env item)
  const couchEnvItem = state.environment.find(e => e.id === selId && e.subtype === 'couch');
  if (couchEnvItem) {
    // Rainbow gradient def for swatch
    const defs = document.createElementNS(NS, 'defs');
    const grad = document.createElementNS(NS, 'linearGradient');
    grad.setAttribute('id', 'ui-couch-rainbow');
    grad.setAttribute('x1', '0%'); grad.setAttribute('y1', '0%');
    grad.setAttribute('x2', '100%'); grad.setAttribute('y2', '0%');
    for (const [off, col] of [['0%','#e85a5a'],['20%','#e8a050'],['40%','#e8d850'],['60%','#5ab860'],['80%','#5a90e8'],['100%','#9a5ae8']]) {
      const stop = document.createElementNS(NS, 'stop');
      stop.setAttribute('offset', off); stop.setAttribute('stop-color', col);
      grad.appendChild(stop);
    }
    defs.appendChild(grad);
    layer.appendChild(defs);

    const currentColor = couchEnvItem.couchColor || 'blue';
    const swatches = [
      { key: 'blue',    fill: '#7a9bb5', label: 'Blue' },
      { key: 'silver',  fill: '#b0bcc8', label: 'Silver' },
      { key: 'pink',    fill: '#e8a0b4', label: 'Pink' },
      { key: 'purple',  fill: '#9a7bc0', label: 'Purple' },
      { key: 'gold',    fill: '#c8a050', label: 'Gold' },
      { key: 'rainbow', fill: 'url(#ui-couch-rainbow)', label: 'Rainbow' },
    ];
    const swatchR = 9;
    const spacing = swatchR * 2 + 6;
    const totalW = swatches.length * spacing - 6;
    const swatchCenter = L(0, h2 + 26);
    const startX = swatchCenter.x - totalW / 2 + swatchR;
    const swatchY = swatchCenter.y;

    for (let i = 0; i < swatches.length; i++) {
      const { key, fill } = swatches[i];
      const isActive = key === currentColor;
      const cx = startX + i * spacing;

      const btn = document.createElementNS(NS, 'g');
      btn.dataset.action = 'couch-color';
      btn.dataset.color = key;
      btn.dataset.targetId = selId;
      btn.setAttribute('cursor', 'pointer');

      if (isActive) {
        const ring = document.createElementNS(NS, 'circle');
        ring.setAttribute('cx', cx); ring.setAttribute('cy', swatchY);
        ring.setAttribute('r', swatchR + 3.5);
        ring.setAttribute('fill', 'none');
        ring.setAttribute('stroke', '#ffffff'); ring.setAttribute('stroke-width', 2);
        btn.appendChild(ring);
      }

      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', cx); c.setAttribute('cy', swatchY);
      c.setAttribute('r', swatchR);
      c.setAttribute('fill', fill);
      c.setAttribute('stroke', isActive ? '#ff7b2e' : '#4a6a8a');
      c.setAttribute('stroke-width', isActive ? 2 : 1);
      btn.appendChild(c);
      layer.appendChild(btn);
    }
  }

  // Flip-only button for stairs (env item)
  const stairsItem = state.environment.find(e => e.id === selId && e.subtype === 'stairs');
  const isStairs = !!stairsItem;
  if (isStairs) {
    const flipPos = L(-w2 - pad - 8, h2 + pad + 8);
    const flipBtn = document.createElementNS(NS, 'g');
    flipBtn.dataset.action = 'flip'; flipBtn.dataset.targetId = selId;
    flipBtn.setAttribute('cursor', 'pointer');
    const fbg = document.createElementNS(NS, 'circle');
    fbg.setAttribute('cx', flipPos.x); fbg.setAttribute('cy', flipPos.y);
    fbg.setAttribute('r', 8); fbg.setAttribute('fill', '#1a3a5c');
    fbg.setAttribute('stroke', '#ff7b2e'); fbg.setAttribute('stroke-width', 1);
    const ft = document.createElementNS(NS, 'text');
    ft.setAttribute('x', flipPos.x); ft.setAttribute('y', flipPos.y);
    ft.setAttribute('text-anchor', 'middle'); ft.setAttribute('dominant-baseline', 'middle');
    ft.setAttribute('fill', '#fff'); ft.setAttribute('font-size', 11); ft.textContent = '↔';
    flipBtn.appendChild(fbg); flipBtn.appendChild(ft);
    layer.appendChild(flipBtn);

    // Step count +/- buttons — centered at bottom of stairs bounding box
    const stepCount = stairsItem.stepCount || 6;
    const stepsCenter = L(0, h2 + pad + 8);
    const btnY = stepsCenter.y;
    for (const [offset, action, icon, atLimit] of [
      [-12, 'step-dec', '−', stepCount <= 3],
      [ 12, 'step-inc', '+', stepCount >= 12],
    ]) {
      const bx = stepsCenter.x + offset;
      const btn = document.createElementNS(NS, 'g');
      btn.dataset.action = action; btn.dataset.targetId = selId;
      btn.setAttribute('cursor', atLimit ? 'default' : 'pointer');
      const bg = document.createElementNS(NS, 'circle');
      bg.setAttribute('cx', bx); bg.setAttribute('cy', btnY);
      bg.setAttribute('r', 8);
      bg.setAttribute('fill', atLimit ? '#1a3a5c' : '#0d2a40');
      bg.setAttribute('stroke', atLimit ? '#2a4a6c' : '#00c9a7');
      bg.setAttribute('stroke-width', 1);
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', bx); t.setAttribute('y', btnY);
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'middle');
      t.setAttribute('fill', atLimit ? '#3a5a7a' : '#00c9a7');
      t.setAttribute('font-size', 13); t.textContent = icon;
      btn.appendChild(bg); btn.appendChild(t);
      layer.appendChild(btn);
    }
  }

  // Attachment point dots (for selected component only)
  // Pulley cord ends are rendered as larger balls below — skip them here
  const ENV_ATTACH_SUBTYPES = new Set(['couch', 'stairs', 'chair', 'desk']);
  const isEnvWithAttach = !!state.environment.find(e => e.id === selId && ENV_ATTACH_SUBTYPES.has(e.subtype));
  if (state.components.find(c => c.id === selId) || isEnvWithAttach) {
    const pts = getAttachPx(comp);
    for (const [name, pos] of Object.entries(pts)) {
      if (comp.subtype === 'pulley' && (name === 'cordLeft' || name === 'cordRight')) continue;
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('cx', pos.x); dot.setAttribute('cy', pos.y);
      dot.setAttribute('r', 5); dot.setAttribute('fill', '#00c9a7');
      dot.setAttribute('stroke', '#fff'); dot.setAttribute('stroke-width', 1.5);
      dot.dataset.attachPoint = name; dot.dataset.compId = selId;
      dot.setAttribute('cursor', 'crosshair');
      layer.appendChild(dot);
    }
  }

  // Sub-part handles — positions follow component rotation/flip
  const selComp = state.components.find(c => c.id === selId);
  if (selComp && selComp.subParts) {
    const sp = selComp.subParts;

    if (selComp.subtype === 'lever' && sp.fulcrumOffset !== undefined) {
      // Compute where the bottom of the bar sits at the fulcrum X (mirrors drawLever logic)
      const tiltSide = sp.tiltSide || 'none';
      const barLocalCy = -0.1 * h; // bar center is at 0.4 from top = -0.1h from component center
      const tiltAmt = 0.25 * h;
      const thick = 0.1 * h;
      let leftLocalY, rightLocalY;
      if (tiltSide === 'left') {
        leftLocalY  = barLocalCy - tiltAmt;
        rightLocalY = barLocalCy + tiltAmt;
      } else if (tiltSide === 'right') {
        leftLocalY  = barLocalCy + tiltAmt;
        rightLocalY = barLocalCy - tiltAmt;
      } else {
        leftLocalY = rightLocalY = barLocalCy;
      }
      const dy_local = rightLocalY - leftLocalY;
      const len_local = Math.hypot(w, dy_local);
      const barCenterAtFulcrum = leftLocalY + dy_local * sp.fulcrumOffset;
      const bottomOffset = thick * w / len_local;
      const fpos = L((sp.fulcrumOffset - 0.5) * w, barCenterAtFulcrum + bottomOffset);
      const diamond = document.createElementNS(NS, 'polygon');
      diamond.setAttribute('points', `${fpos.x},${fpos.y-6} ${fpos.x+6},${fpos.y} ${fpos.x},${fpos.y+6} ${fpos.x-6},${fpos.y}`);
      diamond.setAttribute('fill', '#ff7b2e'); diamond.setAttribute('stroke', '#fff'); diamond.setAttribute('stroke-width', 1);
      diamond.dataset.handle = 'fulcrum'; diamond.dataset.compId = selId;
      diamond.setAttribute('cursor', 'ew-resize');
      layer.appendChild(diamond);
    }

    if (selComp.subtype === 'inclinedPlane' && sp.angle !== undefined) {
      const aRad = (sp.angle * Math.PI) / 180;
      const localY = Math.max(-h2, h2 - w * Math.tan(aRad));
      const pos = L(-w2, localY);
      const handle = document.createElementNS(NS, 'circle');
      handle.setAttribute('cx', pos.x); handle.setAttribute('cy', pos.y);
      handle.setAttribute('r', 6); handle.setAttribute('fill', '#ffd166'); handle.setAttribute('stroke', '#fff'); handle.setAttribute('stroke-width', 1);
      handle.dataset.handle = 'angle'; handle.dataset.compId = selId;
      handle.setAttribute('cursor', 'ns-resize');
      layer.appendChild(handle);
    }


    if (selComp.subtype === 'pulley') {
      const pr = Math.min(w, h) * 0.35;
      const lcl = cmToPx(sp.leftCordLength || 20);
      const rcl = cmToPx(sp.rightCordLength || 20);
      const lRad = (sp.leftCordAngle || 0) * Math.PI / 180;
      const rRad = (sp.rightCordAngle || 0) * Math.PI / 180;
      // Pulley wheel center is at y+h*0.3, which is local y = -h*0.2
      const lPos = L(-pr * 0.7 + lcl * Math.sin(lRad), -h * 0.2 + lcl * Math.cos(lRad));
      const rPos = L( pr * 0.7 + rcl * Math.sin(rRad), -h * 0.2 + rcl * Math.cos(rRad));

      for (const [pos, name] of [[lPos, 'cordLeft'], [rPos, 'cordRight']]) {
        const ball = document.createElementNS(NS, 'circle');
        ball.setAttribute('cx', pos.x); ball.setAttribute('cy', pos.y);
        ball.setAttribute('r', 8); ball.setAttribute('fill', '#00c9a7');
        ball.setAttribute('stroke', '#fff'); ball.setAttribute('stroke-width', 1.5);
        ball.dataset.handle = name; ball.dataset.compId = selId;
        ball.setAttribute('cursor', 'grab');
        layer.appendChild(ball);
      }
    }

    if (selComp.subtype === 'lever') {
      const tiltSide = sp.tiltSide || 'none';
      const tiltIcon = tiltSide === 'left' ? '↖' : tiltSide === 'right' ? '↗' : '—';
      const tiltPos = L(0, h2 + pad + 8);
      const tiltBtn = document.createElementNS(NS, 'g');
      tiltBtn.dataset.action = 'tilt'; tiltBtn.dataset.targetId = selId;
      tiltBtn.setAttribute('cursor', 'pointer');
      const tbg = document.createElementNS(NS, 'circle');
      tbg.setAttribute('cx', tiltPos.x); tbg.setAttribute('cy', tiltPos.y);
      tbg.setAttribute('r', 9); tbg.setAttribute('fill', '#1a3a5c'); tbg.setAttribute('stroke', '#ff7b2e'); tbg.setAttribute('stroke-width', 1);
      const tt = document.createElementNS(NS, 'text');
      tt.setAttribute('x', tiltPos.x); tt.setAttribute('y', tiltPos.y);
      tt.setAttribute('text-anchor', 'middle'); tt.setAttribute('dominant-baseline', 'middle');
      tt.setAttribute('fill', '#fff'); tt.setAttribute('font-size', 11); tt.textContent = tiltIcon;
      tiltBtn.appendChild(tbg); tiltBtn.appendChild(tt);
      layer.appendChild(tiltBtn);
    }


  }

  // Resize handles (4 corners) — positioned at rotated corners, squares stay axis-aligned
  // Books have no resize handles — their proportions are fixed
  if (selComp && selComp.subtype !== 'start' && selComp.subtype !== 'finish' && selComp.subtype !== 'book' && selComp.subtype !== 'string') {
    const corners = [
      { name: 'nw', lx: -w2-pad, ly: -h2-pad },
      { name: 'ne', lx:  w2+pad, ly: -h2-pad },
      { name: 'sw', lx: -w2-pad, ly:  h2+pad },
      { name: 'se', lx:  w2+pad, ly:  h2+pad },
    ];
    for (const { name, lx, ly } of corners) {
      const pos = L(lx, ly);
      const sq = document.createElementNS(NS, 'rect');
      sq.setAttribute('x', pos.x - 4); sq.setAttribute('y', pos.y - 4);
      sq.setAttribute('width', 8); sq.setAttribute('height', 8);
      sq.setAttribute('fill', '#fff'); sq.setAttribute('stroke', '#ff7b2e'); sq.setAttribute('stroke-width', 1.5);
      sq.dataset.handle = `resize-${name}`; sq.dataset.compId = selId;
      sq.setAttribute('cursor', `${name}-resize`);
      layer.appendChild(sq);
    }
  }

  // Highlight attachment points on other components during a connection drag
  const cd = getConnDrag();
  if (cd) {
    const HOVER_DIST = 40; // SVG px — lights up before snap (snap is 15px)
    const allItems = [
      ...state.components,
      ...(state.environment || []).filter(e => ENV_ATTACH_SUBTYPES.has(e.subtype)),
    ];
    for (const otherComp of allItems) {
      if (otherComp.id === cd.fromId) continue;
      const pts = getAttachPx(otherComp);
      for (const [, pos] of Object.entries(pts)) {
        const dist = Math.hypot(pos.x - cd.curPx, pos.y - cd.curPy);
        if (dist > HOVER_DIST) continue;
        const inSnap = dist < 15;
        const dot = document.createElementNS(NS, 'circle');
        dot.setAttribute('cx', pos.x); dot.setAttribute('cy', pos.y);
        dot.setAttribute('r', inSnap ? 8 : 6);
        dot.setAttribute('fill', '#00ff88');
        dot.setAttribute('stroke', '#fff'); dot.setAttribute('stroke-width', inSnap ? 2.5 : 1.5);
        dot.setAttribute('opacity', inSnap ? 1 : 0.75);
        layer.appendChild(dot);
      }
    }
  }
}
