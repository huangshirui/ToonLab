import './styles.css';
import { generateReply } from './api.js';
import { AvatarController } from './avatar.js';
import { clearApiKey, loadApiKey, saveApiKey } from './storage.js';

const INTRO_TEXT =
  "Hello, and welcome to ToonLab. I'm a browser-rendered animated character. My voice and lip sync are generated locally on your device. Next, add your OpenRouter key and ask a model to give me something new to say.";

const elements = {
  avatar: document.querySelector('#avatar'),
  avatarLoading: document.querySelector('#avatar-loading'),
  subtitle: document.querySelector('#subtitle'),
  welcome: document.querySelector('#welcome'),
  startButton: document.querySelector('#start-button'),
  controlPanel: document.querySelector('#control-panel'),
  apiKey: document.querySelector('#api-key'),
  keyStatus: document.querySelector('#key-status'),
  saveKey: document.querySelector('#save-key'),
  clearKey: document.querySelector('#clear-key'),
  toggleKey: document.querySelector('#toggle-key'),
  promptForm: document.querySelector('#prompt-form'),
  prompt: document.querySelector('#prompt'),
  sendButton: document.querySelector('#send-button'),
  appStatus: document.querySelector('#app-status'),
  responseCard: document.querySelector('#response-card'),
  responseText: document.querySelector('#response-text'),
  responseModel: document.querySelector('#response-model'),
};

function setAppStatus(message, kind = 'neutral') {
  elements.appStatus.textContent = message;
  elements.appStatus.dataset.kind = kind;
}

function updateKeyUi(key) {
  const configured = Boolean(key);
  elements.keyStatus.textContent = configured ? 'Saved locally' : 'Not configured';
  elements.keyStatus.dataset.configured = String(configured);
  if (configured) elements.apiKey.value = key;
}

const avatar = new AvatarController({
  container: elements.avatar,
  onStatus: (message) => {
    elements.avatarLoading.textContent = message;
    elements.avatarLoading.hidden = message === 'Ready';
  },
  onSubtitle: (text) => {
    elements.subtitle.textContent = text;
    elements.subtitle.hidden = !text;
  },
});

avatar.pauseWhenHidden();
updateKeyUi(loadApiKey());

elements.startButton.addEventListener('click', async () => {
  elements.startButton.disabled = true;
  setAppStatus('');

  try {
    await avatar.initialize();
    elements.welcome.classList.add('is-speaking');
    await avatar.speak(INTRO_TEXT);
    elements.welcome.hidden = true;
    elements.controlPanel.classList.remove('is-locked');
    elements.apiKey.focus();
  } catch (error) {
    console.error(error);
    elements.startButton.disabled = false;
    setAppStatus(error.message ?? 'Could not start ToonLab.', 'error');
    elements.avatarLoading.hidden = false;
    elements.avatarLoading.textContent = 'Start failed';
  }
});

elements.saveKey.addEventListener('click', () => {
  try {
    const key = saveApiKey(elements.apiKey.value);
    updateKeyUi(key);
    setAppStatus('OpenRouter key saved in this browser.', 'success');
  } catch (error) {
    setAppStatus(error.message, 'error');
  }
});

elements.clearKey.addEventListener('click', () => {
  clearApiKey();
  elements.apiKey.value = '';
  updateKeyUi('');
  setAppStatus('Local OpenRouter key cleared.', 'success');
});

elements.toggleKey.addEventListener('click', () => {
  const showing = elements.apiKey.type === 'text';
  elements.apiKey.type = showing ? 'password' : 'text';
  elements.toggleKey.textContent = showing ? 'Show key' : 'Hide key';
});

elements.promptForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const apiKey = loadApiKey();
  const prompt = elements.prompt.value.trim();

  if (!apiKey) {
    setAppStatus('Save your OpenRouter API key first.', 'error');
    elements.apiKey.focus();
    return;
  }
  if (!prompt) {
    setAppStatus('Enter a prompt first.', 'error');
    elements.prompt.focus();
    return;
  }

  elements.sendButton.disabled = true;
  elements.prompt.disabled = true;
  setAppStatus('Asking OpenRouter…');

  try {
    const result = await generateReply({ apiKey, prompt });
    elements.responseText.textContent = result.text;
    elements.responseModel.textContent = `Model: ${result.model ?? 'OpenRouter'}`;
    elements.responseCard.hidden = false;

    setAppStatus('Generating speech locally…');
    await avatar.speak(result.text);
    setAppStatus('Ready for another prompt.', 'success');
  } catch (error) {
    console.error(error);
    setAppStatus(error.message ?? 'Something went wrong.', 'error');
  } finally {
    elements.sendButton.disabled = false;
    elements.prompt.disabled = false;
    elements.prompt.focus();
  }
});
