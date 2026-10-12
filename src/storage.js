const API_KEY_STORAGE_KEY = 'toonlab.openrouter.apiKey';

export function loadApiKey() {
  return localStorage.getItem(API_KEY_STORAGE_KEY) ?? '';
}

export function saveApiKey(value) {
  const key = value.trim();
  if (!key) {
    throw new Error('Enter an OpenRouter API key first.');
  }
  localStorage.setItem(API_KEY_STORAGE_KEY, key);
  return key;
}

export function clearApiKey() {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
}
