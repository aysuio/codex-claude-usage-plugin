const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  windowPosition: { x: 100, y: 100 },
  displayIndex: 0,
  mode: 'mini',
  pollInterval: 300000,
  launchAtStartup: false,
};

function createStore(userDataPath) {
  const configPath = path.join(userDataPath, 'config.json');
  let data = { ...DEFAULTS };

  // Load existing config
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    data = { ...DEFAULTS, ...parsed };
  } catch {
    // File missing or corrupt — use defaults
  }

  function save() {
    try {
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Silently fail — non-critical
    }
  }

  return {
    get(key) {
      return data[key];
    },
    set(key, value) {
      data[key] = value;
      save();
    },
    getAll() {
      return { ...data };
    },
  };
}

module.exports = { createStore };
