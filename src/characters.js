export const RENDERERS = {
  talkinghead: {
    id: 'talkinghead',
    name: 'TalkingHead',
    description: '3D character renderer with synchronized facial animation.',
  },
  live2d: {
    id: 'live2d',
    name: 'Live2D',
    description: '2D Cubism character renderer with motion, physics and Azure-viseme lip sync.',
  },
};

const talkingHead = (config) => ({
  defaultRenderer: 'talkinghead',
  renderers: ['talkinghead'],
  assets: { talkinghead: config },
});

const live2d = (config) => ({
  defaultRenderer: 'live2d',
  renderers: ['live2d'],
  assets: { live2d: config },
});

const LIVE2D_SAMPLE_COMMIT = 'b1de66b0b1f1cb881d95fb6158622aeb6a2827bd';
const LIVE2D_SAMPLE_ROOT = `https://raw.githubusercontent.com/Live2D/CubismWebSamples/${LIVE2D_SAMPLE_COMMIT}/Samples/Resources`;

const live2dSample = (name, config = {}) => live2d({
  url: `${LIVE2D_SAMPLE_ROOT}/${name}/${name}.model3.json`,
  mouthParameter: 'ParamMouthOpenY',
  scale: 1,
  y: 0.54,
  ...config,
});

const MPFB_DYNAMIC_BONES = [
  {
    bone: 'LeftBreast', type: 'point', stiffness: 600, damping: 20,
    deltaLocal: [0, 0.01, 0], deltaWorld: [0, -0.02, 0],
    limits: [[-0.02, 0.02], [-0.02, 0.06], [-0.02, 0.02], [-0.5, 0.5]],
  },
  {
    bone: 'RightBreast', type: 'point', stiffness: 600, damping: 20,
    deltaLocal: [0, 0.01, 0], deltaWorld: [0, -0.02, 0],
    limits: [[-0.02, 0.02], [-0.02, 0.06], [-0.02, 0.02], [-0.5, 0.5]],
  },
  {
    bone: 'Ponytail1', type: 'mix2', stiffness: 100, damping: 4,
    limits: [null, null, [null, 0.02], null], pivot: true,
  },
  {
    bone: 'Ponytail2', type: 'mix2', stiffness: 150, damping: 4,
    limits: [null, null, [null, 0.01], null],
  },
  {
    bone: 'Ponytail3', type: 'mix2', stiffness: 200, damping: 4,
    limits: [null, null, [null, 0.01], null],
  },
];

const VROID_DYNAMIC_BONES = [
  {
    bone: 'J_Sec_L_Bust1', type: 'point', stiffness: 400, damping: 10,
    deltaLocal: [0, 0.01, 0], deltaWorld: [0, -0.02, 0],
    limits: [[-0.01, 0.01], [-0.01, 0.01], [-0.01, 0.01], [-0.01, 0.01]],
  },
  {
    bone: 'J_Sec_R_Bust1', type: 'point', stiffness: 400, damping: 10,
    deltaLocal: [0, 0.01, 0], deltaWorld: [0, -0.02, 0],
    limits: [[-0.01, 0.01], [-0.01, 0.01], [-0.01, 0.01], [-0.01, 0.01]],
  },
  { bone: 'J_Sec_Hair2_01', type: 'mix2', stiffness: 100, damping: 4, limits: [null, null, [null, 0.01], null] },
  { bone: 'J_Sec_Hair3_01', type: 'mix2', stiffness: 150, damping: 4, limits: [null, null, [null, 0.01], null] },
  { bone: 'J_Sec_Hair2_02', type: 'mix2', stiffness: 100, damping: 4, limits: [null, null, [null, 0.01], null] },
  { bone: 'J_Sec_Hair3_02', type: 'mix2', stiffness: 150, damping: 4, limits: [null, null, [null, 0.01], null] },
  { bone: 'J_Sec_Hair2_03', type: 'mix2', stiffness: 100, damping: 4, limits: [null, null, [null, 0.01], null] },
  { bone: 'J_Sec_Hair3_03', type: 'mix2', stiffness: 150, damping: 4, limits: [null, null, [null, 0.01], null] },
  { bone: 'J_Sec_Hair2_04', type: 'mix2', stiffness: 100, damping: 4, limits: [null, null, [null, 0.01], null] },
  { bone: 'J_Sec_Hair3_04', type: 'mix2', stiffness: 150, damping: 4, limits: [null, null, [null, 0.01], null] },
  { bone: 'J_Sec_Hair2_05', type: 'mix2', stiffness: 100, damping: 4, limits: [null, null, [null, 0.01], null] },
  { bone: 'J_Sec_Hair3_05', type: 'mix2', stiffness: 150, damping: 4, limits: [null, null, [null, 0.01], null] },
  { bone: 'J_Sec_Hair2_06', type: 'mix2', stiffness: 100, damping: 4 },
  { bone: 'J_Sec_Hair3_06', type: 'mix2', stiffness: 150, damping: 4 },
  { bone: 'J_Sec_Hair3_06_end', type: 'mix2', stiffness: 200, damping: 4 },
  { bone: 'J_Sec_Hair2_07', type: 'mix2', stiffness: 100, damping: 4 },
  { bone: 'J_Sec_Hair3_07', type: 'mix2', stiffness: 150, damping: 4 },
  { bone: 'J_Sec_Hair3_07_end', type: 'mix2', stiffness: 200, damping: 4 },
  { bone: 'J_Sec_Hair2_08', type: 'mix2', stiffness: 100, damping: 4 },
  { bone: 'J_Sec_Hair3_08', type: 'mix2', stiffness: 150, damping: 4 },
  { bone: 'J_Sec_Hair4_08', type: 'mix2', stiffness: 150, damping: 4 },
  { bone: 'J_Sec_Hair4_08_end', type: 'mix2', stiffness: 200, damping: 4 },
  { bone: 'J_Sec_Hair2_09', type: 'mix2', stiffness: 100, damping: 4 },
  { bone: 'J_Sec_Hair3_09', type: 'mix2', stiffness: 150, damping: 4 },
  { bone: 'J_Sec_Hair4_09', type: 'mix2', stiffness: 150, damping: 4 },
  { bone: 'J_Sec_Hair4_09_end', type: 'mix2', stiffness: 200, damping: 4 },
  { bone: 'J_Sec_Hair2_10', type: 'mix2', stiffness: 100, damping: 4 },
  { bone: 'J_Sec_Hair3_10', type: 'mix2', stiffness: 150, damping: 4 },
  { bone: 'J_Sec_Hair3_10_end', type: 'mix2', stiffness: 200, damping: 4 },
  { bone: 'J_Sec_Hair2_11', type: 'mix2', stiffness: 100, damping: 4 },
  { bone: 'J_Sec_Hair3_11', type: 'mix2', stiffness: 150, damping: 4 },
  { bone: 'J_Sec_Hair3_11_end', type: 'mix2', stiffness: 200, damping: 4 },
  { bone: 'J_Sec_Hair2_12', type: 'mix2', stiffness: 100, damping: 4, pivot: true },
  { bone: 'J_Sec_Hair3_12', type: 'mix2', stiffness: 150, damping: 4 },
  { bone: 'J_Sec_Hair2_13', type: 'mix2', stiffness: 100, damping: 4, pivot: true },
  { bone: 'J_Sec_Hair3_13', type: 'mix2', stiffness: 150, damping: 4 },
];

export const CHARACTERS = {
  'mpfb-demo': {
    id: 'mpfb-demo',
    name: 'MPFB',
    type: '3D Character',
    description: 'Open-source human character built with MPFB and licensed CC0.',
    ...talkingHead({
      url: '/avatars/demo/avatar.gltf',
      body: 'F',
      avatarMood: 'happy',
      modelDynamicBones: MPFB_DYNAMIC_BONES,
      baseline: {
        headRotateX: -0.01,
        eyeBlinkLeft: 0.05,
        eyeBlinkRight: 0.05,
      },
    }),
  },

  'ready-player-me': {
    id: 'ready-player-me',
    name: 'Ready Player Me',
    type: '3D Character',
    description: 'A stylized Ready Player Me character from the TalkingHead examples.',
    ...talkingHead({
      url: '/avatars/ready-player-me/avatar.glb',
      body: 'F',
      avatarMood: 'neutral',
    }),
  },

  avaturn: {
    id: 'avaturn',
    name: 'Avaturn',
    type: '3D Character',
    description: 'A realistic Avaturn character configured for TalkingHead.',
    ...talkingHead({
      url: '/avatars/avaturn/avatar.glb',
      body: 'F',
      avatarMood: 'happy',
      retarget: {
        Hips: { y: 0.03 },
        Spine: { y: 0.02 },
        Spine1: { y: 0.02, z: 0.01 },
        Spine2: { y: 0.02, z: 0.01 },
        Neck: { z: 0.02, y: 0.01 },
        Head: { z: 0.02 },
        LeftShoulder: { rx: -0.5 },
        RightShoulder: { rx: -0.5 },
        scaleToHipsLevel: 1.0,
        origin: { y: -0.1 },
      },
      baseline: {
        headRotateX: -0.05,
        eyeBlinkLeft: 0.15,
        eyeBlinkRight: 0.15,
      },
    }),
  },

  avatarsdk: {
    id: 'avatarsdk',
    name: 'AvatarSDK',
    type: '3D Character',
    description: 'A MetaPerson / AvatarSDK character from the TalkingHead examples.',
    ...talkingHead({
      url: '/avatars/avatarsdk/avatar.glb',
      body: 'M',
      avatarMood: 'neutral',
      retarget: {
        Neck: { z: -0.01, rx: -0.15 },
        Neck1: { z: -0.01, rx: -0.15 },
        Neck2: { z: -0.01, rx: -0.15 },
        LeftShoulder: { rz: -0.3 },
        RightShoulder: { rz: 0.3 },
        scaleToEyesLevel: 1.0,
        origin: { y: -0.1 },
      },
      baseline: {
        headRotateX: -0.04,
        eyeBlinkLeft: 0.05,
        eyeBlinkRight: 0.05,
      },
    }),
  },

  vroid: {
    id: 'vroid',
    name: 'VRoid',
    type: '3D Character',
    description: 'An anime-style VRoid character converted for TalkingHead.',
    ...talkingHead({
      url: '/avatars/vroid/avatar.glb',
      body: 'F',
      avatarMood: 'neutral',
      baseline: {
        headRotateX: -0.1,
        eyeBlinkLeft: 0.05,
        eyeBlinkRight: 0.05,
      },
      modelDynamicBones: VROID_DYNAMIC_BONES,
    }),
  },

  'live2d-haru': {
    id: 'live2d-haru',
    name: 'Haru',
    type: '2D Character',
    description: 'Official Live2D original sample character for Cubism Web testing.',
    ...live2dSample('Haru'),
  },

  'live2d-hiyori': {
    id: 'live2d-hiyori',
    name: 'Hiyori',
    type: '2D Character',
    description: 'Official Live2D sample character for testing Cubism motion, physics and lip sync.',
    ...live2dSample('Hiyori'),
  },

  'live2d-mao': {
    id: 'live2d-mao',
    name: 'Mao',
    type: '2D Character',
    description: 'Official Live2D original sample character with expressions and motions.',
    ...live2dSample('Mao'),
  },

  'live2d-mark': {
    id: 'live2d-mark',
    name: 'Mark',
    type: '2D Character',
    description: 'Official Live2D original sample character for Cubism Web testing.',
    ...live2dSample('Mark'),
  },

  'live2d-natori': {
    id: 'live2d-natori',
    name: 'Natori',
    type: '2D Character',
    description: 'Official Live2D sample character for Cubism Web testing.',
    ...live2dSample('Natori'),
  },

  'live2d-ren': {
    id: 'live2d-ren',
    name: 'Ren',
    type: '2D Character',
    description: 'Official Live2D sample character for Cubism Web testing.',
    ...live2dSample('Ren'),
  },

  'live2d-rice': {
    id: 'live2d-rice',
    name: 'Rice',
    type: '2D Character',
    description: 'Official Live2D original sample character for Cubism Web testing.',
    ...live2dSample('Rice'),
  },

  'live2d-wanko': {
    id: 'live2d-wanko',
    name: 'Wanko',
    type: '2D Mascot',
    description: 'Official Live2D mascot sample; useful for judging the HomeMew-style 2D character direction.',
    ...live2dSample('Wanko', {
      mouthParameter: 'PARAM_MOUTH_OPEN_Y',
      scale: 1.05,
      y: 0.55,
    }),
  },
};

export function getCharacter(id) {
  return CHARACTERS[id] ?? null;
}

export function getRenderer(id) {
  return RENDERERS[id] ?? null;
}

export function listCharacters(rendererId) {
  const characters = Object.values(CHARACTERS);
  if (!rendererId) return characters;
  return characters.filter(character => character.renderers.includes(rendererId));
}

export function listRenderers() {
  return Object.values(RENDERERS);
}
