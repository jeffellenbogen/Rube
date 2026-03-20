let state = { version: 2, meta: { title: 'Team Name', scale: 4, canvasExpansion: { left: 0, right: 0 } }, environment: [], components: [], connections: [] };
export function getState() { return state; }
export function resetState() { state = { version: 2, meta: { title: 'Team Name', scale: 4, canvasExpansion: { left: 0, right: 0 } }, environment: [], components: [], connections: [] }; }
export function addComponent(c) { return ''; }
export function removeComponent(id) {}
export function updateComponent(id, patch) {}
export function addConnection(conn) { return ''; }
export function removeConnection(id) {}
export function addEnvItem(e) { return ''; }
export function removeEnvItem(id) {}
export function updateEnvItem(id, patch) {}
export function expandCanvas(side) {}
export function setTitle(title) {}
export function loadState(newState) { state = newState; }
export function setState(patch) {}
