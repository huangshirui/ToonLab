export const RENDERERS = {
  talkinghead: {
    id: 'talkinghead',
    name: 'TalkingHead',
    description: '3D character renderer with synchronized facial animation.',
  },
};

export const CHARACTERS = {
  'mpfb-demo': {
    id: 'mpfb-demo',
    name: 'Default character',
    type: '3D Character',
    description: 'A friendly 3D character for speech and motion experiments.',
    defaultRenderer: 'talkinghead',
    renderers: ['talkinghead'],
    assets: {
      talkinghead: {
        url: '/avatars/demo/avatar.gltf',
        body: 'F',
      },
    },
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
