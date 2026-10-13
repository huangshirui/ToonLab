import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CHARACTERS, RENDERERS } from '../src/characters.js';
import { DEFAULT_SETTINGS } from '../src/storage.js';

const indexPath = new URL('../index.html', import.meta.url);
const mainPath = new URL('../src/main.js', import.meta.url);
const workerPath = new URL('../worker/index.js', import.meta.url);

test('settings and conversation markup match the agreed UI contract', async () => {
  const html = await readFile(indexPath, 'utf8');

  assert.match(html, /value="openrouter\/free"/);
  assert.match(html, /placeholder="openrouter\/free"/);
  assert.doesNotMatch(html, /model-badge/);
  assert.doesNotMatch(html, /<label[^>]*for="prompt"[^>]*>Prompt<\/label>/);
  assert.match(html, /placeholder="Ask something…"/);

  assert.match(html, /Try ToonLab with a demo code\./);
  assert.match(html, /Use your own OpenRouter API key\./);

  assert.match(html, /en-US-AriaNeural/);
  assert.match(html, /en-US-JennyNeural/);
  assert.match(html, /en-US-GuyNeural/);
  assert.match(html, /en-US-SaraNeural/);
  assert.doesNotMatch(html, /en-US-DavisNeural/);

  assert.match(html, /id="change-character"/);
  assert.match(html, /id="character-dialog"/);
  assert.match(html, /id="renderer"/);
  assert.doesNotMatch(html, /<select id="character"/);
});

test('default settings and worker both use openrouter/free', async () => {
  assert.equal(DEFAULT_SETTINGS.model, 'openrouter/free');
  assert.equal(DEFAULT_SETTINGS.renderer, 'talkinghead');

  const worker = await readFile(workerPath, 'utf8');
  assert.match(worker, /const DEFAULT_MODEL = 'openrouter\/free'/);

  const main = await readFile(mainPath, 'utf8');
  assert.match(main, /tab: 'settings', forceOpen: true, focusCredential: true/);
  assert.doesNotMatch(main, /Ready ·/);
});

test('character registry separates character from renderer', () => {
  const character = CHARACTERS['mpfb-demo'];
  assert.equal(character.defaultRenderer, 'talkinghead');
  assert.deepEqual(character.renderers, ['talkinghead']);
  assert.ok(character.assets.talkinghead.url);
  assert.equal(RENDERERS.talkinghead.name, 'TalkingHead');
});
