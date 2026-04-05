/**
 * Hybrid SVG icons: flat color fill + blueprint-style stroke
 * Machines = orange palette, Materials = teal palette
 */
const ICONS = {
  // ---- Simple Machines ----
  lever: `<svg viewBox="0 0 32 32" width="28" height="28">
    <polygon points="16,22 12,28 20,28" fill="none" stroke="#ff7b2e" stroke-width="1.5"/>
    <line x1="4" y1="20" x2="28" y2="20" stroke="#ff7b2e" stroke-width="2" stroke-linecap="round"/>
    <circle cx="8" cy="18" r="3" fill="rgba(255,123,46,0.3)" stroke="#ff7b2e" stroke-width="1.2"/>
  </svg>`,

  pulley: `<svg viewBox="0 0 32 32" width="28" height="28">
    <circle cx="16" cy="12" r="7" fill="rgba(255,123,46,0.15)" stroke="#ff7b2e" stroke-width="1.5"/>
    <circle cx="16" cy="12" r="2" fill="#ff7b2e"/>
    <line x1="16" y1="4" x2="16" y2="2" stroke="#ff7b2e" stroke-width="1.5"/>
    <line x1="9" y1="14" x2="6" y2="28" stroke="#ff7b2e" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="23" y1="14" x2="26" y2="28" stroke="#ff7b2e" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  wedge: `<svg viewBox="0 0 32 32" width="28" height="28">
    <polygon points="4,28 28,28 28,12" fill="rgba(255,123,46,0.2)" stroke="#ff7b2e" stroke-width="1.5" stroke-linejoin="round"/>
  </svg>`,

  wheel_axle: `<svg viewBox="0 0 32 32" width="28" height="28">
    <circle cx="16" cy="16" r="10" fill="rgba(255,123,46,0.12)" stroke="#ff7b2e" stroke-width="1.5"/>
    <circle cx="16" cy="16" r="3" fill="rgba(255,123,46,0.3)" stroke="#ff7b2e" stroke-width="1.2"/>
    <line x1="6" y1="16" x2="26" y2="16" stroke="#ff7b2e" stroke-width="1" stroke-dasharray="2 2"/>
    <line x1="16" y1="6" x2="16" y2="26" stroke="#ff7b2e" stroke-width="1" stroke-dasharray="2 2"/>
  </svg>`,

  inclined_plane: `<svg viewBox="0 0 32 32" width="28" height="28">
    <rect x="19" y="18" width="10" height="9" fill="rgba(255,123,46,0.25)" stroke="#ff7b2e" stroke-width="1.5" rx="0.5"/>
    <polygon points="3,27 23,18 22,16 2,25" fill="rgba(255,123,46,0.45)" stroke="#ff7b2e" stroke-width="1.2"/>
  </svg>`,

  screw: `<svg viewBox="0 0 32 32" width="28" height="28">
    <line x1="16" y1="2" x2="16" y2="28" stroke="#ff7b2e" stroke-width="2" stroke-linecap="round"/>
    <path d="M10,8 Q16,11 22,8" fill="none" stroke="#ff7b2e" stroke-width="1.3"/>
    <path d="M10,14 Q16,17 22,14" fill="none" stroke="#ff7b2e" stroke-width="1.3"/>
    <path d="M10,20 Q16,23 22,20" fill="none" stroke="#ff7b2e" stroke-width="1.3"/>
  </svg>`,

  // ---- Materials ----
  tube: `<svg viewBox="0 0 32 32" width="28" height="28">
    <rect x="8" y="4" width="16" height="24" rx="8" fill="rgba(0,201,167,0.12)" stroke="#00c9a7" stroke-width="1.5"/>
    <ellipse cx="16" cy="4" rx="8" ry="3" fill="rgba(0,201,167,0.2)" stroke="#00c9a7" stroke-width="1.2"/>
  </svg>`,

  bucket: `<svg viewBox="0 0 32 32" width="28" height="28">
    <path d="M6,10 L9,28 L23,28 L26,10 Z" fill="rgba(0,201,167,0.15)" stroke="#00c9a7" stroke-width="1.5" stroke-linejoin="round"/>
    <ellipse cx="16" cy="10" rx="10" ry="3" fill="rgba(0,201,167,0.2)" stroke="#00c9a7" stroke-width="1.2"/>
    <path d="M8,6 Q16,0 24,6" fill="none" stroke="#00c9a7" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  toy_car: `<svg viewBox="0 0 32 32" width="28" height="28">
    <rect x="4" y="12" width="24" height="10" rx="3" fill="rgba(0,201,167,0.15)" stroke="#00c9a7" stroke-width="1.5"/>
    <path d="M8,12 L12,6 L22,6 L24,12" fill="rgba(0,201,167,0.1)" stroke="#00c9a7" stroke-width="1.2"/>
    <circle cx="9" cy="24" r="3" fill="rgba(0,201,167,0.3)" stroke="#00c9a7" stroke-width="1.2"/>
    <circle cx="23" cy="24" r="3" fill="rgba(0,201,167,0.3)" stroke="#00c9a7" stroke-width="1.2"/>
  </svg>`,

  string: `<svg viewBox="0 0 32 32" width="28" height="28">
    <path d="M4,8 Q12,20 16,12 Q20,4 24,16 Q28,28 28,24" fill="none" stroke="#00c9a7" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  cup: `<svg viewBox="0 0 32 32" width="28" height="28">
    <path d="M6,6 L8,26 L24,26 L26,6" fill="rgba(0,201,167,0.12)" stroke="#00c9a7" stroke-width="1.5" stroke-linejoin="round"/>
    <line x1="6" y1="6" x2="26" y2="6" stroke="#00c9a7" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  dominoes: `<svg viewBox="0 0 32 32" width="28" height="28">
    <rect x="4" y="8" width="8" height="18" rx="1.5" fill="rgba(0,201,167,0.2)" stroke="#00c9a7" stroke-width="1.2" transform="rotate(-8 8 17)"/>
    <rect x="14" y="6" width="8" height="18" rx="1.5" fill="rgba(0,201,167,0.15)" stroke="#00c9a7" stroke-width="1.2" transform="rotate(-4 18 15)"/>
    <rect x="23" y="5" width="8" height="18" rx="1.5" fill="rgba(0,201,167,0.1)" stroke="#00c9a7" stroke-width="1.2"/>
  </svg>`,

  magnet: `<svg viewBox="0 0 32 32" width="28" height="28">
    <path d="M8,18 L8,12 Q8,4 16,4 Q24,4 24,12 L24,18" fill="none" stroke="#00c9a7" stroke-width="3" stroke-linecap="round"/>
    <rect x="5" y="18" width="6" height="6" rx="1" fill="#ef476f" stroke="#ef476f" stroke-width="0.5"/>
    <rect x="21" y="18" width="6" height="6" rx="1" fill="#348cd7" stroke="#348cd7" stroke-width="0.5"/>
  </svg>`,

  track: `<svg viewBox="0 0 32 32" width="28" height="28">
    <line x1="6" y1="10" x2="6" y2="26" stroke="#00c9a7" stroke-width="2"/>
    <line x1="26" y1="10" x2="26" y2="26" stroke="#00c9a7" stroke-width="2"/>
    <line x1="6" y1="14" x2="26" y2="14" stroke="#00c9a7" stroke-width="1.2"/>
    <line x1="6" y1="18" x2="26" y2="18" stroke="#00c9a7" stroke-width="1.2"/>
    <line x1="6" y1="22" x2="26" y2="22" stroke="#00c9a7" stroke-width="1.2"/>
  </svg>`,

  cardboard: `<svg viewBox="0 0 32 32" width="28" height="28">
    <rect x="4" y="8" width="24" height="18" rx="1" fill="rgba(0,201,167,0.12)" stroke="#00c9a7" stroke-width="1.5"/>
    <line x1="4" y1="14" x2="28" y2="14" stroke="#00c9a7" stroke-width="1" stroke-dasharray="3 2"/>
    <line x1="16" y1="14" x2="16" y2="26" stroke="#00c9a7" stroke-width="1" stroke-dasharray="3 2"/>
  </svg>`,

  tape: `<svg viewBox="0 0 32 32" width="28" height="28">
    <circle cx="16" cy="16" r="10" fill="rgba(0,201,167,0.1)" stroke="#00c9a7" stroke-width="1.5"/>
    <circle cx="16" cy="16" r="4" fill="none" stroke="#00c9a7" stroke-width="1.2"/>
    <line x1="26" y1="16" x2="30" y2="20" stroke="#00c9a7" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  box: `<svg viewBox="0 0 32 32" width="28" height="28">
    <rect x="4" y="10" width="24" height="18" rx="1.5" fill="rgba(0,201,167,0.12)" stroke="#00c9a7" stroke-width="1.5"/>
    <polyline points="4,10 16,4 28,10" fill="rgba(0,201,167,0.08)" stroke="#00c9a7" stroke-width="1.5" stroke-linejoin="round"/>
    <line x1="16" y1="4" x2="16" y2="10" stroke="#00c9a7" stroke-width="1"/>
  </svg>`,

  // ---- Markers ----
  start: `<svg viewBox="0 0 32 32" width="28" height="28">
    <circle cx="16" cy="16" r="12" fill="rgba(6,214,160,0.15)" stroke="#06d6a0" stroke-width="2"/>
    <polygon points="12,8 24,16 12,24" fill="#06d6a0"/>
  </svg>`,

  finish: `<svg viewBox="0 0 32 32" width="28" height="28">
    <circle cx="16" cy="16" r="12" fill="rgba(239,71,111,0.15)" stroke="#ef476f" stroke-width="2"/>
    <rect x="10" y="10" width="12" height="12" rx="2" fill="#ef476f"/>
  </svg>`,
};
