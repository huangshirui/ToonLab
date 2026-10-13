const STORAGE_KEYS = {
  apiKey: 'toonlab.openrouter.apiKey',
  demoCode: 'toonlab.openrouter.demoCode',
  authMode: 'toonlab.openrouter.authMode',
  model: 'toonlab.openrouter.model',
  character: 'toonlab.character',
  renderer: 'toonlab.renderer',
  voice: 'toonlab.voice',
};

export const DEFAULT_SETTINGS = {
  authMode: 'key',
  model: 'openrouter/free',
  character: 'mpfb-demo',
  renderer: 'talkinghead',
  voice: 'en-US-AriaNeural',
};

function saveRequired(key, value, errorMessage) {
  const clean = value.trim();
  if (!clean) throw new Error(errorMessage);
  localStorage.setItem(key, clean);
  return clean;
}

export function loadApiKey() {
  return localStorage.getItem(STORAGE_KEYS.apiKey) ?? '';
}

export function saveApiKey(value) {
  return saveRequired(STORAGE_KEYS.apiKey, value, 'Enter an OpenRouter API key first.');
}

export function clearApiKey() {
  localStorage.removeItem(STORAGE_KEYS.apiKey);
}

export function loadDemoCode() {
  return localStorage.getItem(STORAGE_KEYS.demoCode) ?? '';
}

export function saveDemoCode(value) {
  return saveRequired(STORAGE_KEYS.demoCode, value, 'Enter a demo code first.');
}

export function clearDemoCode() {
  localStorage.removeItem(STORAGE_KEYS.demoCode);
}

export function loadSettings() {
  const authMode = localStorage.getItem(STORAGE_KEYS.authMode);
  return {
    authMode: authMode === 'demo' ? 'demo' : DEFAULT_SETTINGS.authMode,
    model: localStorage.getItem(STORAGE_KEYS.model) || DEFAULT_SETTINGS.model,
    character: localStorage.getItem(STORAGE_KEYS.character) || DEFAULT_SETTINGS.character,
    renderer: localStorage.getItem(STORAGE_KEYS.renderer) || DEFAULT_SETTINGS.renderer,
    voice: localStorage.getItem(STORAGE_KEYS.voice) || DEFAULT_SETTINGS.voice,
  };
}

export function saveSetting(name, value) {
  if (!(name in DEFAULT_SETTINGS)) throw new Error(`Unknown setting: ${name}`);
  const clean = String(value).trim();
  if (!clean) throw new Error(`${name} cannot be empty.`);
  localStorage.setItem(STORAGE_KEYS[name], clean);
  return clean;
}
