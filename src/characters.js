export const RENDERERS = {
  talkinghead: {
    id: 'talkinghead',
    name: 'TalkingHead',
    description: '3D character renderer with synchronized facial animation.',
  },
};

const talkingHead = (config) => ({
  defaultRenderer: 'talkinghead',
  renderers: ['talkinghead'],
  assets: { talkinghead: config },
});

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
    }),
  },
};

export function getCharacter(id) {
  return CHARACTERS[id] ?? null;
}

export function getRenderer(id) {
  return RENDERERS[id] ?? null;
}

export function listCharacters() {
  return Object.values(CHARACTERS);
}
