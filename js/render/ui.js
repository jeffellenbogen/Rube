import { cmToPx } from '../canvas.js';
import { getSelected, getConnDrag } from '../drag.js';
import { getAttachPx } from './attachPoints.js';

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

  // Delete button — always screen-top-center of visual bounds
  if (comp.subtype !== 'start' && comp.subtype !== 'finish') {
    const pos = { x: aMidX, y: aMinY - pad };
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

  // Comment bubble button — always screen-top-left of visual bounds
  {
    const pos = { x: aMinX - pad - 8, y: aMinY - pad };
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

  // Rotate / Flip buttons (machine and material components only, not env or markers)
  const isComp = !!state.components.find(c => c.id === selId);
  if (isComp && comp.subtype !== 'start' && comp.subtype !== 'finish' && comp.subtype !== 'lever' && comp.subtype !== 'pulley' && comp.subtype !== 'wheelAxle' && comp.subtype !== 'box') {
    // Rotate ↻ — always screen-bottom-right of visual bounds
    const rotPos = { x: aMaxX + pad, y: aMaxY + pad + 8 };
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

    // Flip ↔ — always screen-bottom-left of visual bounds
    const flipPos = { x: aMinX - pad - 8, y: aMaxY + pad + 8 };
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
    const rotPos = { x: aMaxX + pad + 8, y: aMaxY + pad + 8 };
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

  // Flip-only button for stairs (env item)
  const stairsItem = state.environment.find(e => e.id === selId && e.subtype === 'stairs');
  const isStairs = !!stairsItem;
  if (isStairs) {
    const flipPos = { x: aMinX - pad - 8, y: aMaxY + pad + 8 };
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
    const btnY = aMaxY + pad + 8;
    for (const [offset, action, icon, atLimit] of [
      [-12, 'step-dec', '−', stepCount <= 3],
      [ 12, 'step-inc', '+', stepCount >= 12],
    ]) {
      const bx = aMidX + offset;
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
  if (state.components.find(c => c.id === selId)) {
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

    if (selComp.subtype === 'matchboxTrack' && sp.angle !== undefined) {
      const pos = L(w2, 0);
      const handle = document.createElementNS(NS, 'circle');
      handle.setAttribute('cx', pos.x); handle.setAttribute('cy', pos.y);
      handle.setAttribute('r', 6); handle.setAttribute('fill', '#ffd166'); handle.setAttribute('stroke', '#fff'); handle.setAttribute('stroke-width', 1);
      handle.dataset.handle = 'trackAngle'; handle.dataset.compId = selId;
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
        ball.dataset.attachPoint = name; ball.dataset.compId = selId;
        ball.setAttribute('cursor', 'crosshair');
        layer.appendChild(ball);
      }
    }

    if (selComp.subtype === 'lever') {
      const tiltSide = sp.tiltSide || 'none';
      const tiltIcon = tiltSide === 'left' ? '↖' : tiltSide === 'right' ? '↗' : '—';
      const tiltPos = { x: aMidX, y: aMaxY + pad + 8 };
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
  if (selComp && selComp.subtype !== 'start' && selComp.subtype !== 'finish') {
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
    for (const otherComp of state.components) {
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
