import './styles.css';
import { generateReply } from './api.js';
import { AvatarController } from './avatar.js';
import {
  DEFAULT_SETTINGS,
  clearApiKey,
  clearDemoCode,
  loadApiKey,
  loadDemoCode,
  loadSettings,
  saveApiKey,
  saveDemoCode,
  saveSetting,
} from './storage.js';

const INTRO_TEXT =
  "Hello, and welcome to ToonLab. I'm an interactive animated character. Open the controls when you're ready to ask me something new.";

const mobileQuery = window.matchMedia('(max-width: 860px)');
const elements = {
  avatar: document.querySelector('#avatar'),
  avatarLoading: document.querySelector('#avatar-loading'),
  avatarLoadingText: document.querySelector('#avatar-loading-text'),
  subtitle: document.querySelector('#subtitle'),
  welcome: document.querySelector('#welcome'),
  startButton: document.querySelector('#start-button'),
  controlPanel: document.querySelector('#control-panel'),
  panelToggle: document.querySelector('#panel-toggle'),
  drawerLabel: document.querySelector('#drawer-label'),
  tabs: [...document.querySelectorAll('.tab-button')],
  tabPanels: [...document.querySelectorAll('.tab-panel')],
  model: document.querySelector('#model'),
  modelBadge: document.querySelector('#model-badge'),
  character: document.querySelector('#character'),
  voice: document.querySelector('#voice'),
  authModes: [...document.querySelectorAll('input[name="auth-mode"]')],
  authStatus: document.querySelector('#auth-status'),
  demoCodeFields: document.querySelector('#demo-code-fields'),
  demoCode: document.querySelector('#demo-code'),
  saveDemoCode: document.querySelector('#save-demo-code'),
  clearDemoCode: document.querySelector('#clear-demo-code'),
  toggleDemoCode: document.querySelector('#toggle-demo-code'),
  apiKeyFields: document.querySelector('#api-key-fields'),
  apiKey: document.querySelector('#api-key'),
  saveKey: document.querySelector('#save-key'),
  clearKey: document.querySelector('#clear-key'),
  toggleKey: document.querySelector('#toggle-key'),
  promptForm: document.querySelector('#prompt-form'),
  prompt: document.querySelector('#prompt'),
  sendButton: document.querySelector('#send-button'),
  appStatus: document.querySelector('#app-status'),
};

let settings = loadSettings();
let activeTab = 'conversation';

function setAppStatus(message, kind = 'neutral') {
  elements.appStatus.textContent = message;
  elements.appStatus.dataset.kind = kind;
}

function setPanelOpen(open) {
  elements.controlPanel.classList.toggle('is-open', open);
  elements.panelToggle.setAttribute('aria-expanded', String(open));
  elements.panelToggle.querySelector('.drawer-chevron').textContent = open ? '⌄' : '⌃';
}

function activateTab(name) {
  activeTab = name;
  for (const tab of elements.tabs) {
    const selected = tab.dataset.tab === name;
    tab.classList.toggle('is-active', selected);
    tab.setAttribute('aria-selected', String(selected));
  }
  for (const panel of elements.tabPanels) {
    panel.hidden = panel.id !== `panel-${name}`;
  }
  elements.drawerLabel.textContent = name === 'settings' ? 'Settings' : 'Conversation';
}

function setSpeaking(speaking) {
  elements.controlPanel.classList.toggle('is-character-speaking', speaking);
  if (speaking && mobileQuery.matches) setPanelOpen(false);
}

function persistSetting(name, value) {
  const clean = saveSetting(name, value);
  settings = { ...settings, [name]: clean };
  return clean;
}

function normalizeStoredAuthMode() {
  const apiKey = loadApiKey();
  const demoCode = loadDemoCode();
  const activeCredentialExists = settings.authMode === 'demo' ? Boolean(demoCode) : Boolean(apiKey);
  if (activeCredentialExists) return true;

  if (demoCode) {
    settings.authMode = persistSetting('authMode', 'demo');
    return true;
  }
  if (apiKey) {
    settings.authMode = persistSetting('authMode', 'key');
    return true;
  }
  return false;
}

function syncAuthUi() {
  const mode = settings.authMode === 'demo' ? 'demo' : 'key';
  for (const radio of elements.authModes) radio.checked = radio.value === mode;
  elements.demoCodeFields.hidden = mode !== 'demo';
  elements.apiKeyFields.hidden = mode !== 'key';

  const configured = mode === 'demo' ? Boolean(loadDemoCode()) : Boolean(loadApiKey());
  elements.authStatus.textContent = configured
    ? mode === 'demo' ? 'Demo code ready' : 'API key ready'
    : 'Not configured';
  elements.authStatus.dataset.configured = String(configured);
}

function syncSettingsUi() {
  elements.model.value = settings.model || DEFAULT_SETTINGS.model;
  elements.modelBadge.textContent = elements.model.value;

  const characterExists = [...elements.character.options].some(option => option.value === settings.character);
  elements.character.value = characterExists ? settings.character : DEFAULT_SETTINGS.character;
  if (!characterExists) settings.character = persistSetting('character', DEFAULT_SETTINGS.character);

  const voiceExists = [...elements.voice.options].some(option => option.value === settings.voice);
  elements.voice.value = voiceExists ? settings.voice : DEFAULT_SETTINGS.voice;
  if (!voiceExists) settings.voice = persistSetting('voice', DEFAULT_SETTINGS.voice);

  const apiKey = loadApiKey();
  const demoCode = loadDemoCode();
  if (apiKey) elements.apiKey.value = apiKey;
  if (demoCode) elements.demoCode.value = demoCode;
  syncAuthUi();
}

function setAuthMode(mode) {
  settings.authMode = persistSetting('authMode', mode === 'demo' ? 'demo' : 'key');
  syncAuthUi();
}

function toggleSecret(input, button, noun) {
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  button.textContent = showing ? `Show ${noun}` : `Hide ${noun}`;
}

function unlockExperience({ returningUser = false } = {}) {
  elements.welcome.hidden = true;
  elements.controlPanel.classList.remove('is-locked');
  activateTab('conversation');
  if (!mobileQuery.matches) {
    setPanelOpen(true);
    if (returningUser) elements.prompt.focus();
  } else {
    setPanelOpen(false);
  }
}

const avatar = new AvatarController({
  container: elements.avatar,
  onStatus: (message) => {
    elements.avatarLoadingText.textContent = message;
    elements.avatarLoading.hidden = message === 'Ready';
    elements.avatarLoading.dataset.state = message === 'Character unavailable' ? 'error' : 'loading';
  },
  onSubtitle: (text) => {
    elements.subtitle.textContent = text;
    elements.subtitle.hidden = !text;
  },
});

async function speakCharacter(text) {
  setSpeaking(true);
  try {
    await avatar.speak(text, { voice: settings.voice, character: settings.character });
  } finally {
    setSpeaking(false);
  }
}

avatar.pauseWhenHidden();
const hasStoredCredential = normalizeStoredAuthMode();
syncSettingsUi();
activateTab('conversation');
setPanelOpen(false);

if (hasStoredCredential) unlockExperience({ returningUser: true });

avatar.loadCharacter(settings.character).catch((error) => {
  console.error(error);
  setAppStatus('Could not load the character. Try reloading the page.', 'error');
});

elements.panelToggle.addEventListener('click', () => {
  setPanelOpen(!elements.controlPanel.classList.contains('is-open'));
});

for (const tab of elements.tabs) {
  tab.addEventListener('click', () => {
    activateTab(tab.dataset.tab);
    if (mobileQuery.matches) setPanelOpen(true);
    if (tab.dataset.tab === 'conversation') elements.prompt.focus();
  });
}

mobileQuery.addEventListener('change', event => {
  if (!event.matches && elements.welcome.hidden) setPanelOpen(true);
  else if (event.matches) setPanelOpen(false);
});

elements.startButton.addEventListener('click', async () => {
  elements.startButton.disabled = true;
  setAppStatus('');

  try {
    // Audio permission needs a user gesture even though the character itself is preloaded.
    await avatar.activateAudio();
    await avatar.loadCharacter(settings.character);
    elements.welcome.classList.add('is-speaking');
    await speakCharacter(INTRO_TEXT);
    unlockExperience();
  } catch (error) {
    console.error(error);
    elements.startButton.disabled = false;
    elements.welcome.classList.remove('is-speaking');
    setAppStatus(error.message ?? 'Could not start ToonLab.', 'error');
  }
});

elements.model.addEventListener('change', () => {
  const value = elements.model.value.trim() || DEFAULT_SETTINGS.model;
  settings.model = persistSetting('model', value);
  elements.model.value = settings.model;
  elements.modelBadge.textContent = settings.model;
});

elements.character.addEventListener('change', async () => {
  const previous = settings.character;
  const next = elements.character.value;
  if (next === previous) return;

  elements.character.disabled = true;
  setAppStatus('Loading character…');
  try {
    await avatar.loadCharacter(next);
    settings.character = persistSetting('character', next);
    setAppStatus('Character ready.', 'success');
  } catch (error) {
    console.error(error);
    elements.character.value = previous;
    setAppStatus('Could not load that character.', 'error');
    try {
      await avatar.loadCharacter(previous);
    } catch (restoreError) {
      console.error(restoreError);
    }
  } finally {
    elements.character.disabled = false;
  }
});

elements.voice.addEventListener('change', () => {
  settings.voice = persistSetting('voice', elements.voice.value);
});

for (const radio of elements.authModes) {
  radio.addEventListener('change', () => {
    if (radio.checked) setAuthMode(radio.value);
  });
}

elements.saveKey.addEventListener('click', () => {
  try {
    saveApiKey(elements.apiKey.value);
    setAuthMode('key');
  } catch (error) {
    elements.authStatus.textContent = error.message;
    elements.authStatus.dataset.configured = 'false';
  }
});

elements.clearKey.addEventListener('click', () => {
  clearApiKey();
  elements.apiKey.value = '';
  syncAuthUi();
});

elements.toggleKey.addEventListener('click', () => toggleSecret(elements.apiKey, elements.toggleKey, 'key'));

elements.saveDemoCode.addEventListener('click', () => {
  try {
    saveDemoCode(elements.demoCode.value);
    setAuthMode('demo');
  } catch (error) {
    elements.authStatus.textContent = error.message;
    elements.authStatus.dataset.configured = 'false';
  }
});

elements.clearDemoCode.addEventListener('click', () => {
  clearDemoCode();
  elements.demoCode.value = '';
  syncAuthUi();
});

elements.toggleDemoCode.addEventListener('click', () => toggleSecret(elements.demoCode, elements.toggleDemoCode, 'code'));

elements.promptForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const prompt = elements.prompt.value.trim();
  const model = elements.model.value.trim() || DEFAULT_SETTINGS.model;
  settings.model = persistSetting('model', model);
  elements.model.value = settings.model;
  elements.modelBadge.textContent = settings.model;

  if (!prompt) {
    setAppStatus('Enter a prompt first.', 'error');
    elements.prompt.focus();
    return;
  }

  const authMode = settings.authMode === 'demo' ? 'demo' : 'key';
  const apiKey = authMode === 'key' ? loadApiKey() : '';
  const demoCode = authMode === 'demo' ? loadDemoCode() : '';
  if (!apiKey && !demoCode) {
    activateTab('settings');
    setPanelOpen(true);
    syncAuthUi();
    (authMode === 'demo' ? elements.demoCode : elements.apiKey).focus();
    return;
  }

  elements.sendButton.disabled = true;
  elements.prompt.disabled = true;

  try {
    // Capture audio permission from this submit gesture before the network request begins.
    await avatar.activateAudio();
    setAppStatus('Thinking…');
    const result = await generateReply({ apiKey, demoCode, prompt, model: settings.model });
    setAppStatus('Preparing speech…');
    await speakCharacter(result.text);
    setAppStatus(`Ready · ${result.model ?? settings.model}`, 'success');
  } catch (error) {
    console.error(error);
    setAppStatus(error.message ?? 'Something went wrong.', 'error');
    if (mobileQuery.matches) setPanelOpen(true);
  } finally {
    elements.sendButton.disabled = false;
    elements.prompt.disabled = false;
    if (!mobileQuery.matches || elements.controlPanel.classList.contains('is-open')) elements.prompt.focus();
  }
});
