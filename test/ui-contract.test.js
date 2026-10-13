import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AVATAR_SOURCES, PINNED_COMMIT } from '../scripts/prepare-avatar.mjs';
import { LIVE2D_RUNTIME_FILES } from '../scripts/prepare-live2d.mjs';
import { TALKINGHEAD_RUNTIME_FILES } from '../scripts/prepare-talkinghead.mjs';
import { CHARACTERS, RENDERERS, listCharacters, listRenderers } from '../src/characters.js';
import { DEFAULT_SETTINGS } from '../src/storage.js';

const indexPath = new URL('../index.html', import.meta.url);
const mainPath = new URL('../src/main.js', import.meta.url);
const avatarPath = new URL('../src/avatar.js', import.meta.url);
const live2dPath = new URL('../src/live2d.js', import.meta.url);
const live2dFramePath = new URL('../public/live2d-frame.html', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);
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

  const rendererIndex = html.indexOf('class="renderer-picker"');
  const characterListIndex = html.indexOf('id="character-list"');
  assert.ok(rendererIndex >= 0 && characterListIndex > rendererIndex, 'Renderer must appear before character choices.');
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

test('start hides onboarding before speech and uses credential-aware intro copy', async () => {
  const main = await readFile(mainPath, 'utf8');
  assert.match(main, /INTRO_SETUP_TEXT/);
  assert.match(main, /INTRO_READY_TEXT/);

  const startIndex = main.indexOf("elements.startButton.addEventListener('click'");
  const endIndex = main.indexOf("elements.model.addEventListener('change'", startIndex);
  const startHandler = main.slice(startIndex, endIndex);

  const hideIndex = startHandler.indexOf('elements.welcome.hidden = true');
  const speakIndex = startHandler.indexOf('await speakCharacter(introText)');
  assert.ok(hideIndex >= 0 && speakIndex > hideIndex);
  assert.doesNotMatch(startHandler, /is-speaking/);
  assert.match(startHandler, /credentialReady \? INTRO_READY_TEXT : INTRO_SETUP_TEXT/);
  assert.match(startHandler, /elements\.welcome\.hidden = false/);
});

test('character switching locks all controls until load or rollback finishes', async () => {
  const main = await readFile(mainPath, 'utf8');
  assert.match(main, /elements\.controlPanel\.inert = switching/);
  assert.match(main, /setAttribute\('aria-busy', 'true'\)/);

  const handlerStart = main.indexOf("elements.selectCharacter.addEventListener('click'");
  const handlerEnd = main.indexOf("elements.voice.addEventListener('change'", handlerStart);
  const handler = main.slice(handlerStart, handlerEnd);
  assert.match(handler, /setCharacterSwitching\(true\)/);
  assert.match(handler, /finally\s*{\s*setCharacterSwitching\(false\)/s);
});

test('speech output has a deliberate gain boost', async () => {
  const avatar = await readFile(avatarPath, 'utf8');
  assert.match(avatar, /const SPEECH_GAIN = 1\.8/);
  assert.match(avatar, /mixerGainSpeech: SPEECH_GAIN/);
  assert.match(avatar, /live2dSpeechGain\.gain\.value = SPEECH_GAIN/);
});

test('TalkingHead runtime is pinned to the same upstream commit as avatar assets', async () => {
  assert.equal(PINNED_COMMIT, '2afe6d79779313db8909badebf46f9805a6c7b70');
  assert.deepEqual(
    TALKINGHEAD_RUNTIME_FILES.map(file => file.filename),
    ['talkinghead.mjs', 'dynamicbones.mjs', 'retargeter.mjs', 'playback-worklet.js'],
  );
  for (const file of TALKINGHEAD_RUNTIME_FILES) {
    assert.ok(file.url.includes(`/${PINNED_COMMIT}/modules/`));
    assert.match(file.gitBlobSha, /^[0-9a-f]{40}$/);
  }

  const avatar = await readFile(avatarPath, 'utf8');
  assert.match(avatar, /\.\.\/\.talkinghead-runtime\/talkinghead\.mjs/);

  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
  assert.match(packageJson.scripts.build, /prepare:talkinghead/);
  assert.match(packageJson.scripts.test, /prepare:talkinghead/);
});

test('character registry separates TalkingHead and all official Live2D free samples', () => {
  const expectedTalkingHeadIds = ['mpfb-demo', 'ready-player-me', 'avaturn', 'avatarsdk', 'vroid'];
  const expectedLive2DIds = [
    'live2d-haru',
    'live2d-hiyori',
    'live2d-mao',
    'live2d-mark',
    'live2d-natori',
    'live2d-ren',
    'live2d-rice',
    'live2d-wanko',
  ];

  assert.deepEqual(listRenderers().map(renderer => renderer.id), ['talkinghead', 'live2d']);
  assert.deepEqual(listCharacters('talkinghead').map(character => character.id), expectedTalkingHeadIds);
  assert.deepEqual(listCharacters('live2d').map(character => character.id), expectedLive2DIds);
  assert.deepEqual(AVATAR_SOURCES.map(source => source.id), expectedTalkingHeadIds);

  for (const id of expectedTalkingHeadIds) {
    const character = CHARACTERS[id];
    assert.equal(character.defaultRenderer, 'talkinghead');
    assert.deepEqual(character.renderers, ['talkinghead']);
    assert.ok(character.assets.talkinghead.url);
  }

  assert.equal(CHARACTERS['ready-player-me'].name, 'Ready Player Me');
  assert.equal(CHARACTERS.avaturn.name, 'Avaturn');
  assert.equal(CHARACTERS.avatarsdk.name, 'AvatarSDK');
  assert.equal(CHARACTERS.vroid.name, 'VRoid');
  assert.equal(RENDERERS.talkinghead.name, 'TalkingHead');
  assert.equal(RENDERERS.live2d.name, 'Live2D');

  for (const id of expectedLive2DIds) {
    const character = CHARACTERS[id];
    assert.equal(character.defaultRenderer, 'live2d');
    assert.deepEqual(character.renderers, ['live2d']);
    assert.match(character.assets.live2d.url, /^https:\/\/raw\.githubusercontent\.com\/Live2D\/CubismWebSamples\/[0-9a-f]{40}\//);
  }
  assert.equal(CHARACTERS['live2d-hiyori'].assets.live2d.mouthParameter, 'ParamMouthOpenY');
  assert.equal(CHARACTERS['live2d-wanko'].assets.live2d.mouthParameter, 'PARAM_MOUTH_OPEN_Y');

  const mpfb = CHARACTERS['mpfb-demo'].assets.talkinghead;
  assert.ok(Array.isArray(mpfb.modelDynamicBones));
  assert.equal(mpfb.modelDynamicBones.length, 5, 'MPFB must keep the pinned upstream dynamic-bone preset.');
  assert.ok(mpfb.modelDynamicBones.some(bone => bone.bone === 'Ponytail1' && bone.pivot === true));

  const avaturn = CHARACTERS.avaturn.assets.talkinghead;
  assert.equal(avaturn.retarget.scaleToHipsLevel, 1);
  assert.equal(avaturn.retarget.LeftShoulder.rx, -0.5);

  const avatarSdk = CHARACTERS.avatarsdk.assets.talkinghead;
  assert.equal(avatarSdk.body, 'M');
  assert.equal(avatarSdk.retarget.scaleToEyesLevel, 1);
  assert.equal(avatarSdk.retarget.LeftShoulder.rz, -0.3);
  assert.equal(avatarSdk.retarget.RightShoulder.rz, 0.3);

  const vroid = CHARACTERS.vroid.assets.talkinghead;
  assert.equal(vroid.avatarMood, 'neutral');
  assert.ok(Array.isArray(vroid.modelDynamicBones));
  assert.ok(vroid.modelDynamicBones.length > 30, 'VRoid must keep the pinned upstream dynamic-bone preset.');
  assert.ok(vroid.modelDynamicBones.some(bone => bone.bone === 'J_Sec_Hair2_12' && bone.pivot === true));
});

test('character picker filters characters by the renderer selected above them', async () => {
  const main = await readFile(mainPath, 'utf8');
  assert.match(main, /for \(const renderer of listRenderers\(\)\)/);
  assert.match(main, /const available = listCharacters\(pendingRenderer\)/);
  assert.match(main, /pendingRenderer = elements\.renderer\.value;[\s\S]*renderCharacterPicker\(\)/);
  assert.doesNotMatch(main, /pendingRenderer = character\.renderers\.includes\(pendingRenderer\)/);
});

test('Live2D runtime remains sandboxed, same-origin at runtime and protected from Cloudflare HTML injection', async () => {
  const bridge = await readFile(live2dPath, 'utf8');
  const frame = await readFile(live2dFramePath, 'utf8');
  const avatar = await readFile(avatarPath, 'utf8');
  const worker = await readFile(workerPath, 'utf8');
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));

  assert.match(bridge, /setAttribute\('sandbox', 'allow-scripts'\)/);
  assert.doesNotMatch(bridge, /allow-same-origin/);
  assert.match(frame, /src="\/live2d-runtime\/live2dcubismcore\.min\.js"/);
  assert.match(frame, /src="\/live2d-runtime\/pixi\.min\.js"/);
  assert.match(frame, /src="\/live2d-runtime\/cubism4\.min\.js"/);
  assert.doesNotMatch(frame, /<script src="https:\/\//);
  assert.match(frame, /MOUTH_OPEN_BY_VISEME/);
  assert.match(avatar, /data\.azureVisemes/);
  assert.doesNotMatch(frame, /localStorage|openrouter|Authorization/);

  assert.deepEqual(
    LIVE2D_RUNTIME_FILES.map(file => file.filename),
    ['live2dcubismcore.min.js', 'pixi.min.js', 'cubism4.min.js'],
  );
  assert.match(packageJson.scripts.build, /prepare:live2d/);
  assert.match(worker, /url\.pathname !== '\/live2d-frame\.html'/);
  assert.match(worker, /Cache-Control', 'public, max-age=300, no-transform'/);
});
