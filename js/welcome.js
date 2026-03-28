import { openHelp } from './help.js';

export function initWelcome() {
  const modal = document.getElementById('welcome-modal');
  const welcomeInput = document.getElementById('welcome-team-input');
  const teamNameField = document.getElementById('team-name');

  function dismiss() {
    modal.style.display = 'none';
    const name = welcomeInput.value.trim();
    if (name) {
      teamNameField.value = name;
      teamNameField.dispatchEvent(new Event('input'));
    }
  }

  document.getElementById('welcome-start').addEventListener('click', dismiss);

  welcomeInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') dismiss();
  });

  document.getElementById('welcome-help').addEventListener('click', () => {
    modal.style.display = 'none';
    openHelp();
  });
}
