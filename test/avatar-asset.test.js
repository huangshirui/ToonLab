import test from 'node:test';
import assert from 'node:assert/strict';
import { splitGlb } from '../scripts/prepare-avatar.mjs';

test('splitting GLB preserves geometry, skinning and morph targets while externalizing images', () => {
  const document = {
    asset: { version: '2.0' }, buffers: [{ byteLength: 12 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 4 }, { buffer: 0, byteOffset: 4, byteLength: 4 }, { buffer: 0, byteOffset: 8, byteLength: 4 }],
    images: [{ mimeType: 'image/png', bufferView: 1 }],
    accessors: [{ bufferView: 0 }, { bufferView: 2 }],
    skins: [{ joints: [0] }], nodes: [{ name: 'Hips' }],
    meshes: [{ extras: { targetNames: ['viseme_PP'] }, primitives: [{ attributes: { POSITION: 0 }, targets: [{ POSITION: 1 }] }] }],
  };
  let json = Buffer.from(JSON.stringify(document));
  json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
  const bytes = Buffer.alloc(28 + json.length + 12);
  bytes.writeUInt32LE(0x46546c67, 0); bytes.writeUInt32LE(2, 4); bytes.writeUInt32LE(bytes.length, 8);
  bytes.writeUInt32LE(json.length, 12); bytes.writeUInt32LE(0x4e4f534a, 16); json.copy(bytes, 20);
  const bin = 20 + json.length;
  bytes.writeUInt32LE(12, bin); bytes.writeUInt32LE(0x004e4942, bin + 4);
  Buffer.from([1, 2, 3, 4, 9, 8, 7, 6, 5, 6, 7, 8]).copy(bytes, bin + 8);
  const { gltf, files } = splitGlb(bytes);
  assert.deepEqual([...files.get('geometry.bin')], [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual([...files.get('texture-0.png')], [9, 8, 7, 6]);
  assert.equal(gltf.accessors[1].bufferView, 1);
  assert.equal(gltf.bufferViews[1].byteOffset, 4);
  assert.equal(gltf.images[0].uri, 'texture-0.png');
  assert.deepEqual(gltf.skins, document.skins);
  assert.deepEqual(gltf.meshes, document.meshes);
});
