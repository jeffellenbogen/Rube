let state = defaultState();

function defaultState() {
  return {
    version: 2,
    mode: 'auto',
    meta: { title: 'Team Name', scale: 4, canvasExpansion: { left: 0, right: 0 } },
    environment: [],
    components: [],
    connections: []
  };
}

function uid() { return Math.random().toString(36).slice(2, 10); }

export function getState() { return { ...state }; }
export function resetState() { state = defaultState(); }
export function setState(patch) { state = { ...state, ...patch }; }

export function addComponent(c) {
  const id = uid();
  state = { ...state, components: [...state.components, { ...c, id }] };
  return id;
}

export function removeComponent(id) {
  state = {
    ...state,
    components: state.components.filter(c => c.id !== id),
    connections: state.connections.filter(c => c.fromId !== id && c.toId !== id)
  };
}

export function updateComponent(id, patch) {
  state = {
    ...state,
    components: state.components.map(c => c.id === id ? { ...c, ...patch } : c)
  };
}

export function addConnection(conn) {
  const id = uid();
  state = { ...state, connections: [...state.connections, { ...conn, id }] };
  return id;
}

export function removeConnection(id) {
  state = { ...state, connections: state.connections.filter(c => c.id !== id) };
}

export function addEnvItem(e) {
  const id = uid();
  state = { ...state, environment: [...state.environment, { ...e, id }] };
  return id;
}

export function removeEnvItem(id) {
  state = { ...state, environment: state.environment.filter(e => e.id !== id) };
}

export function updateEnvItem(id, patch) {
  state = {
    ...state,
    environment: state.environment.map(e => e.id === id ? { ...e, ...patch } : e)
  };
}

export function expandCanvas(side) {
  const current = state.meta.canvasExpansion[side];
  if (current >= 0.5) return;
  state = {
    ...state,
    meta: { ...state.meta, canvasExpansion: { ...state.meta.canvasExpansion, [side]: Math.min(0.5, current + 0.25) } }
  };
}

export function setTitle(title) {
  state = { ...state, meta: { ...state.meta, title } };
}

export function loadState(newState) {
  state = { ...defaultState(), ...newState };
}
