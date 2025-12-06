const dmSections = document.querySelectorAll('.dm-only');
const isAdmin = localStorage.getItem('isAdmin') === 'true';

document.addEventListener('DOMContentLoaded', () => {
  dmSections.forEach(section => {
    section.style.display = isAdmin ? 'block' : 'none';
  });

  const missionForm = document.getElementById('mission-form');
  if (missionForm) {
    missionForm.addEventListener('submit', handleMissionSubmit);
  }

  const explorationForm = document.getElementById('exploration-form');
  if (explorationForm) {
    explorationForm.addEventListener('submit', handleExplorationSubmit);
  }
});

function addPhase() {
  const container = document.getElementById('phases-container');
  const index = container.children.length + 1;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <h4>Phase ${index}</h4>
    <input type="text" name="phase-title" placeholder="Title" required />
    <textarea name="phase-description" placeholder="Description"></textarea>
    <input type="text" name="phase-images" placeholder="Images (comma separated)" />
  `;
  container.appendChild(wrapper);
}

function addLoot() {
  const container = document.getElementById('loot-container');
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <input type="text" name="loot-name" placeholder="Loot name" required />
    <input type="text" name="loot-description" placeholder="Description" />
    <input type="text" name="loot-value" placeholder="Value" />
  `;
  container.appendChild(wrapper);
}

function addBoss() {
  const container = document.getElementById('bosses-container');
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <input type="text" name="boss-name" placeholder="Boss name" required />
    <textarea name="boss-description" placeholder="Description"></textarea>
  `;
  container.appendChild(wrapper);
}

function handleMissionSubmit(event) {
  event.preventDefault();
  const mission = {
    id: document.getElementById('mission-id').value,
    title: document.getElementById('mission-title').value,
    description: document.getElementById('mission-description').value,
    location: document.getElementById('mission-location').value,
    questType: document.getElementById('quest-type').value,
    encountered: document.getElementById('mission-encountered').value,
    images: document.getElementById('mission-images').value
      .split(',')
      .map(path => path.trim())
      .filter(Boolean),
    phases: Array.from(document.querySelectorAll('#phases-container > div')).map((phase, index) => ({
      phase: index + 1,
      title: phase.querySelector('input[name="phase-title"]').value,
      description: phase.querySelector('textarea[name="phase-description"]').value,
      images: (phase.querySelector('input[name="phase-images"]').value || '')
        .split(',')
        .map(path => path.trim())
        .filter(Boolean),
    })),
    loot: Array.from(document.querySelectorAll('#loot-container > div')).map(item => ({
      name: item.querySelector('input[name="loot-name"]').value,
      description: item.querySelector('input[name="loot-description"]').value,
      value: item.querySelector('input[name="loot-value"]').value,
    })),
    bosses: Array.from(document.querySelectorAll('#bosses-container > div')).map(item => ({
      name: item.querySelector('input[name="boss-name"]').value,
      description: item.querySelector('textarea[name="boss-description"]').value,
    })),
  };

  const output = document.getElementById('output');
  if (output) {
    output.textContent = JSON.stringify(mission, null, 2);
  }

  const downloadContainer = document.getElementById('download-json-container');
  if (downloadContainer) {
    downloadContainer.style.display = 'block';
  }
}

function handleExplorationSubmit(event) {
  event.preventDefault();
  const exploration = {
    name: document.getElementById('exploration-name').value,
    description: document.getElementById('exploration-description').value,
    image: document.getElementById('exploration-image').value,
    encountered: document.getElementById('exploration-encountered').value,
  };

  const output = document.getElementById('exploration-output');
  if (output) {
    output.textContent = JSON.stringify(exploration, null, 2);
  }
}
