import { loadState, getState } from './state.js';

const MAX = 50;
let past = [];    // snapshots before action
let future = [];  // snapshots after undo

export function push() {
  // Call BEFORE mutating state — snapshot current state
  const snapshot = JSON.parse(JSON.stringify(getState()));
  past.push(snapshot);
  if (past.length > MAX) past.shift();
  future = []; // clear redo stack
}

export function undo() {
  if (!past.length) return;
  const snapshot = JSON.parse(JSON.stringify(getState()));
  future.push(snapshot);
  loadState(past.pop());
}

export function redo() {
  if (!future.length) return;
  const snapshot = JSON.parse(JSON.stringify(getState()));
  past.push(snapshot);
  loadState(future.pop());
}

export function canUndo() { return past.length > 0; }
export function canRedo() { return future.length > 0; }
export function reset() { past = []; future = []; }
