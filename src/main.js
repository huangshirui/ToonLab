import './styles.css';
import './character-picker.css';
import { generateReply } from './api.js';
import { AvatarController } from './avatar.js';
import { getCharacter, getRenderer, listCharacters, listRenderers } from './characters.js';
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

const INTRO_SETUP_TEXT =
  "Welcome to ToonLab. Before we begin, choose a demo code or add your OpenRouter API key in Settings.";
const INTRO_READY_TEXT =
  "Welcome back to ToonLab. You're ready to go. Ask me anything you'd like to explore.";

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
  currentCharacterName: document.querySelector('#current-character-name'),
  currentCharacterMeta: document.querySelector('#current-character-meta'),
  changeCharacter: document.querySelector('#change-character'),
  characterDialog: document.querySelector('#character-dialog'),
  characterList: document.querySelector('#character-list'),
  renderer: document.querySelector('#renderer'),
  rendererDescription: document.querySelector('#renderer-description'),
  closeCharacterDialog: document.querySelector('#close-character-dialog'),
  cancelCharacter: document.querySelector('#cancel-character'),
  selectCharacter: document.querySelector('#select-character'),
};

let settings = loadSettings();
let pendingCharacter = settings.character;
let pendingRenderer = settings.renderer;

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

function setCharacterSwitching(switching) {
  elements.controlPanel.classList.toggle('is-character-switching', switching);
  elements.controlPanel.inert = switching;
  if (switching) elements.controlPanel.setAttribute('aria-busy', 'true');
  else elements.controlPanel.removeAttribute('aria-busy');
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

function normalizeCharacterSettings() {
  const character = getCharacter(settings.character);
  if (!character) {
    settings.character = persistSetting('character', DEFAULT_SETTINGS.character);
  }

  const activeCharacter = getCharacter(settings.character);
  if (!activeCharacter?.renderers.includes(settings.renderer)) {
    settings.renderer = persistSetting('renderer', activeCharacter?.defaultRenderer ?? DEFAULT_SETTINGS.renderer);
  }
}

function syncCurrentCharacterUi() {
  const character = getCharacter(settings.character);
  const renderer = getRenderer(settings.renderer);
  elements.currentCharacterName.textContent = character?.name ?? 'Character';
  elements.currentCharacterMeta.textContent = [character?.type, renderer?.name].filter(Boolean).join(' · ');
}

function syncSettingsUi() {
  elements.model.value = settings.model || DEFAULT_SETTINGS.model;
  normalizeCharacterSettings();
  syncCurrentCharacterUi();

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

function focusCredentialInput() {
  const target = settings.authMode === 'demo' ? elements.demoCode : elements.apiKey;
  requestAnimationFrame(() => target.focus());
}

function unlockExperience({ tab = 'conversation', returningUser = false, forceOpen = false, focusCredential = false } = {}) {
  elements.welcome.hidden = true;
  elements.controlPanel.classList.remove('is-locked');
  activateTab(tab);

  if (mobileQuery.matches) {
    setPanelOpen(forceOpen);
  } else {
    setPanelOpen(true);
  }

  if (focusCredential) {
    focusCredentialInput();
  } else if (returningUser && !mobileQuery.matches) {
    requestAnimationFrame(() => elements.prompt.focus());
  }
}

function syncRendererPicker() {
  elements.renderer.replaceChildren();

  for (const renderer of listRenderers()) {
    const option = document.createElement('option');
    option.value = renderer.id;
    option.textContent = renderer.name;
    elements.renderer.append(option);
  }

  if (!getRenderer(pendingRenderer)) pendingRenderer = DEFAULT_SETTINGS.renderer;
  elements.renderer.value = pendingRenderer;
  elements.rendererDescription.textContent = getRenderer(pendingRenderer)?.description ?? '';
}

function ensurePendingCharacterMatchesRenderer() {
  const available = listCharacters(pendingRenderer);
  if (!available.length) return [];
  if (!available.some(character => character.id === pendingCharacter)) {
    pendingCharacter = available[0].id;
  }
  return available;
}

function renderCharacterPicker() {
  elements.characterList.replaceChildren();
  const available = ensurePendingCharacterMatchesRenderer();

  for (const character of available) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'character-option';
    button.dataset.character = character.id;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', String(character.id === pendingCharacter));
    button.classList.toggle('is-selected', character.id === pendingCharacter);

    const preview = document.createElement('div');
    preview.className = 'character-option-preview';
    preview.setAttribute('aria-hidden', 'true');
    preview.textContent = pendingRenderer === 'live2d' ? '2D' : '3D';

    const name = document.createElement('strong');
    name.textContent = character.name;
    const type = document.createElement('span');
    type.textContent = character.type;
    const description = document.createElement('small');
    description.textContent = character.description;

    button.append(preview, name, type, description);
    button.addEventListener('click', () => {
      pendingCharacter = character.id;
      renderCharacterPicker();
    });
    elements.characterList.append(button);
  }
}

function openCharacterPicker() {
  pendingCharacter = settings.character;
  pendingRenderer = settings.renderer;
  syncRendererPicker();
  renderCharacterPicker();
  elements.characterDialog.showModal();
}

function closeCharacterPicker() {
  elements.characterDialog.close();
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
    await avatar.speak(text, {
      voice: settings.voice,
      character: settings.character,
      renderer: settings.renderer,
    });
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

avatar.loadCharacter(settings.character, settings.renderer).catch((error) => {
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

  const credentialReady = normalizeStoredAuthMode();
  syncAuthUi();
  const introText = credentialReady ? INTRO_READY_TEXT : INTRO_SETUP_TEXT;
  elements.welcome.hidden = true;

  try {
    await avatar.activateAudio();
    await avatar.loadCharacter(settings.character, settings.renderer);
    await speakCharacter(introText);

    if (credentialReady) {
      unlockExperience({ tab: 'conversation', returningUser: true });
    } else {
      unlockExperience({ tab: 'settings', forceOpen: true, focusCredential: true });
    }
  } catch (error) {
    console.error(error);
    elements.startButton.disabled = false;
    elements.welcome.hidden = false;
    setAppStatus(error.message ?? 'Could not start ToonLab.', 'error');
  }
});

elements.model.addEventListener('change', () => {
  const value = elements.model.value.trim() || DEFAULT_SETTINGS.model;
  settings.model = persistSetting('model', value);
  elements.model.value = settings.model;
});

elements.changeCharacter.addEventListener('click', openCharacterPicker);
elements.closeCharacterDialog.addEventListener('click', closeCharacterPicker);
elements.cancelCharacter.addEventListener('click', closeCharacterPicker);
elements.characterDialog.addEventListener('click', (event) => {
  if (event.target === elements.characterDialog) closeCharacterPicker();
});

elements.renderer.addEventListener('change', () => {
  pendingRenderer = elements.renderer.value;
  elements.rendererDescription.textContent = getRenderer(pendingRenderer)?.description ?? '';
  renderCharacterPicker();
});

elements.selectCharacter.addEventListener('click', async () => {
  const nextCharacter = pendingCharacter;
  const nextRenderer = pendingRenderer;
  const previousCharacter = settings.character;
  const previousRenderer = settings.renderer;

  closeCharacterPicker();
  if (nextCharacter === previousCharacter && nextRenderer === previousRenderer) return;

  setCharacterSwitching(true);
  setAppStatus('Loading character…');
  try {
    await avatar.loadCharacter(nextCharacter, nextRenderer);
    settings.character = persistSetting('character', nextCharacter);
    settings.renderer = persistSetting('renderer', nextRenderer);
    syncCurrentCharacterUi();
    setAppStatus('Character ready.', 'success');
  } catch (error) {
    console.error(error);
    setAppStatus('Could not load that character.', 'error');
    try {
      await avatar.loadCharacter(previousCharacter, previousRenderer);
    } catch (restoreError) {
      console.error(restoreError);
    }
  } finally {
    setCharacterSwitching(false);
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

  if (!prompt) {
    setAppStatus('Enter a message first.', 'error');
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
    focusCredentialInput();
    return;
  }

  elements.sendButton.disabled = true;
  elements.prompt.disabled = true;

  try {
    await avatar.activateAudio();
    setAppStatus('Thinking…');
    const result = await generateReply({ apiKey, demoCode, prompt, model: settings.model });
    setAppStatus('Preparing response…');
    await speakCharacter(result.text);
    setAppStatus('Ready', 'success');
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