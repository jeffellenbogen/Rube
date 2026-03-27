import { drawMachineIcon } from './render/machines.js';
import { drawMaterialIcon } from './render/materials.js';
import { drawEnvIcon } from './render/environment.js';

const NS = 'http://www.w3.org/2000/svg';

// ── Modal state ───────────────────────────────────────────────────────
let currentCard = 0;
let currentTab  = 'guide';

// ── Public API ────────────────────────────────────────────────────────
export function openHelp() {
  currentCard = 0;
  currentTab  = 'guide';
  document.getElementById('help-modal').classList.remove('help-hidden');
  setTab('guide');
}

export function closeHelp() {
  document.getElementById('help-modal').classList.add('help-hidden');
}

export function initHelp() {
  document.getElementById('btn-help').addEventListener('click', openHelp);
  document.getElementById('help-close').addEventListener('click', closeHelp);
  document.getElementById('help-backdrop').addEventListener('click', closeHelp);
  document.querySelectorAll('.help-tab').forEach(btn => {
    btn.addEventListener('click', () => setTab(btn.dataset.tab));
  });
}

// ── Tab switching (stub — renderGuideTab / renderRefTab added in Tasks 3 & 4) ──
function setTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.help-tab').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.tab === tab)
  );
  const body = document.getElementById('help-body');
  body.innerHTML = `<div style="padding:20px;color:var(--text-dim);font-size:12px;">${tab} tab — coming soon</div>`;
}
