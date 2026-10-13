import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const SOURCE = 'https://raw.githubusercontent.com/met4citizen/TalkingHead/2afe6d79779313db8909badebf46f9805a6c7b70/avatars/mpfb.glb';
export const SHA256 = '63c645a2a863b9972e9a9c2ed576a1de4c390b8475508e1473e69c87a3ee299c';
const LIMIT = 25 * 1024 * 1024;

// Split embedded images from geometry so every static asset is below the
// Workers per-file limit. No geometry, skinning or morph targets are removed.
export function splitGlb(bytes) {
  if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error('Invalid avatar GLB.');
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const binHeader = 20 + jsonLength;
  const binary = bytes.subarray(binHeader + 8, binHeader + 8 + bytes.readUInt32LE(binHeader));
  const files = new Map();
  const imageViews = new Set();
  for (const [i, image] of gltf.images.entries()) {
    const view = gltf.bufferViews[image.bufferView];
    const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[image.mimeType];
    if (!view || !extension) throw new Error('Unsupported embedded avatar image.');
    const uri = `texture-${i}.${extension}`;
    files.set(uri, binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength));
    imageViews.add(image.bufferView);
    delete image.bufferView; delete image.mimeType; image.uri = uri;
  }
  let offset = 0;
  const geometry = [];
  // Retain indices, including unused image views, to preserve accessor links.
  for (const [i, view] of gltf.bufferViews.entries()) {
    if (imageViews.has(i)) { view.byteOffset = 0; view.byteLength = 0; continue; }
    const data = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    view.byteOffset = offset;
    geometry.push(data);
    offset += data.length;
    const padding = (4 - offset % 4) % 4;
    if (padding) { geometry.push(Buffer.alloc(padding)); offset += padding; }
  }
  gltf.buffers = [{ uri: 'geometry.bin', byteLength: offset }];
  // Remove now-unused image views and remap all accessor view indices.
  const remap = new Map();
  gltf.bufferViews = gltf.bufferViews.filter((view, i) => {
    if (imageViews.has(i)) return false;
    remap.set(i, remap.size); return true;
  });
  for (const accessor of gltf.accessors) {
    if (accessor.bufferView !== undefined) accessor.bufferView = remap.get(accessor.bufferView);
    if (accessor.sparse) {
      accessor.sparse.indices.bufferView = remap.get(accessor.sparse.indices.bufferView);
      accessor.sparse.values.bufferView = remap.get(accessor.sparse.values.bufferView);
    }
  }
  files.set('geometry.bin', Buffer.concat(geometry));
  files.set('avatar.gltf', Buffer.from(JSON.stringify(gltf)));
  for (const [name, data] of files) if (data.length > LIMIT) throw new Error(`Avatar asset exceeds Workers limit: ${name}`);
  return { gltf, files };
}

export async function prepareAvatar() {
  const cache = new URL('../.avatar-cache/', import.meta.url);
  const output = new URL('../public/avatars/demo/', import.meta.url);
  await mkdir(cache, { recursive: true });
  let bytes;
  try { bytes = await readFile(new URL('mpfb.glb', cache)); } catch { /* First build. */ }
  if (!bytes || createHash('sha256').update(bytes).digest('hex') !== SHA256) {
    const response = await fetch(SOURCE, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`Avatar download failed: ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(bytes).digest('hex') !== SHA256) throw new Error('Avatar integrity check failed.');
    await writeFile(new URL('mpfb.glb', cache), bytes);
  }
  const { files } = splitGlb(bytes);
  await mkdir(output, { recursive: true });
  for (const [name, data] of files) await writeFile(new URL(name, output), data);
  console.log(`Prepared same-origin CC0 avatar (${files.size} files).`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await prepareAvatar();
