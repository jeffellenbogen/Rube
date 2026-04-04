import { test, assertEqual, assert } from './run.js';
import { getAttachPx, getSnapPx } from '../render/attachPoints.js';
import { findNearestAttachment } from '../connections.js';

// In Node tests basePx=1, so cmToPx(x)===x and all positions are in cm.

function makePulley(x, y, w, h, leftCordAngle = 45, leftCordLength = 30) {
  return { id: 'p1', type: 'simple_machine', subtype: 'pulley', x, y, width: w, height: h,
           subParts: { leftCordAngle, leftCordLength, rightCordAngle: 0, rightCordLength: 20 } };
}

test('getSnapPx cordLeft is closer to wheel center than getAttachPx cordLeft', () => {
  const p = makePulley(100, 100, 20, 20, 45, 30);
  const snap = getSnapPx(p);
  const full = getAttachPx(p);
  // Wheel center Y = comp.y + comp.height*0.3 = 106
  const wheelCy = p.y + p.height * 0.3;
  const wheelCx = p.x + p.width / 2;
  const snapDist = Math.hypot(snap.cordLeft.x - wheelCx, snap.cordLeft.y - wheelCy);
  const fullDist = Math.hypot(full.cordLeft.x - wheelCx, full.cordLeft.y - wheelCy);
  assert(snapDist < fullDist, `getSnapPx (${snapDist.toFixed(1)}) should be closer to wheel than getAttachPx (${fullDist.toFixed(1)})`);
});

test('getSnapPx cordLeft is at wheel rim origin (zero cord length)', () => {
  const p = makePulley(100, 100, 20, 20, 90, 25); // cord pointing 90°
  const snap = getSnapPx(p);
  // cordLeft at angle=0 and len=0 would be: cx - r*0.7, cy - h*0.2
  const cx = p.x + p.width / 2;   // 110
  const cy = p.y + p.height / 2;  // 110
  const r  = Math.min(20, 20) * 0.35;  // 7
  const expectedX = cx - r * 0.7; // 110 - 4.9 = 105.1
  const expectedY = cy - 20 * 0.2; // 110 - 4 = 106
  assert(Math.abs(snap.cordLeft.x - expectedX) < 0.01, `x expected ${expectedX}, got ${snap.cordLeft.x}`);
  assert(Math.abs(snap.cordLeft.y - expectedY) < 0.01, `y expected ${expectedY}, got ${snap.cordLeft.y}`);
});

test('getSnapPx cordRight is at wheel rim origin regardless of cord angle', () => {
  const p = makePulley(50, 50, 20, 20, 0, 20);
  p.subParts.rightCordAngle = 135;
  p.subParts.rightCordLength = 40;
  const snap = getSnapPx(p);
  const cx = p.x + p.width / 2;  // 60
  const cy = p.y + p.height / 2; // 60
  const r  = Math.min(20, 20) * 0.35;
  const expectedX = cx + r * 0.7;
  const expectedY = cy - 20 * 0.2;
  assert(Math.abs(snap.cordRight.x - expectedX) < 0.01, `x expected ${expectedX}, got ${snap.cordRight.x}`);
  assert(Math.abs(snap.cordRight.y - expectedY) < 0.01, `y expected ${expectedY}, got ${snap.cordRight.y}`);
});

test('getSnapPx returns unchanged results for non-pulley components', () => {
  const ball = { id: 'b1', type: 'material', subtype: 'ball', x: 50, y: 50, width: 18, height: 18 };
  const snap = getSnapPx(ball);
  const full = getAttachPx(ball);
  for (const [name, pos] of Object.entries(full)) {
    assert(Math.abs(snap[name].x - pos.x) < 0.001 && Math.abs(snap[name].y - pos.y) < 0.001,
      `${name}: snap (${snap[name].x},${snap[name].y}) should equal full (${pos.x},${pos.y})`);
  }
});

test('getSnapPx mountTop is unchanged for pulley', () => {
  const p = makePulley(100, 100, 20, 20);
  const snap = getSnapPx(p);
  const full = getAttachPx(p);
  assert(Math.abs(snap.mountTop.x - full.mountTop.x) < 0.01, 'mountTop.x should be unchanged');
  assert(Math.abs(snap.mountTop.y - full.mountTop.y) < 0.01, 'mountTop.y should be unchanged');
});

function makePulleyState(x, y, w, h, leftCordAngle = 0, leftCordLength = 20) {
  const comp = { id: 'p2', type: 'simple_machine', subtype: 'pulley', x, y, width: w, height: h,
                 subParts: { leftCordAngle, leftCordLength, rightCordAngle: 0, rightCordLength: 20 } };
  return { components: [comp], environment: [], connections: [] };
}

test('findNearestAttachment finds pulley wheel-rim when mouse is near wheel, not cord tip', () => {
  // Pulley at (100,100) size 20×20, cord at angle=0 length=20 (tip is 20cm below wheel)
  // Wheel-rim for cordLeft: cx=110, cy=110, r=7 → x=110-4.9=105.1, y=110-4=106
  const state = makePulleyState(100, 100, 20, 20, 0, 20);
  // Mouse at wheel rim — should snap
  const near = findNearestAttachment(state, 105.1, 106, 'other', 15);
  assert(near !== null, 'should find snap near wheel rim');
  assertEqual(near.compId, 'p2');
  assertEqual(near.pointName, 'cordLeft');
});

test('findNearestAttachment does NOT find pulley when mouse is at cord tip (old behavior)', () => {
  // Old behavior would snap at cord tip (105.1, 126); new behavior targets wheel rim (105.1, 106)
  // Mouse at cord tip position — should NOT snap since snap target moved to wheel rim
  const state = makePulleyState(100, 100, 20, 20, 0, 20);
  // Cord tip is at (105.1, 126); wheel rim is at (105.1, 106); mouse at tip → 20cm from wheel rim
  const near = findNearestAttachment(state, 105.1, 126, 'other', 15);
  assert(near === null, 'mouse at cord tip should not snap (target is now at wheel rim)');
});

test('findNearestAttachment finds pulley regardless of which direction mouse approaches from', () => {
  const state = makePulleyState(100, 100, 20, 20, 90, 30); // cord points right
  // Wheel-rim cordLeft still at same position regardless of cord angle
  const near = findNearestAttachment(state, 105.1, 106, 'other', 10);
  assert(near !== null, 'should find regardless of cord direction');
  assertEqual(near.pointName, 'cordLeft');
});
