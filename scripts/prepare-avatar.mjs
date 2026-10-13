import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const PINNED_COMMIT = '2afe6d79779313db8909badebf46f9805a6c7b70';
export const AVATAR_SOURCES = [
  {
    id: 'mpfb-demo',
    filename: 'mpfb.glb',
    gitBlobSha: 'cd2ebbe1fe8bcbf3d5b2dfbf1262a7f76814e68f',
    outputDir: 'demo',
    split: true,
  },
  {
    id: 'ready-player-me',
    filename: 'brunette.glb',
    gitBlobSha: '1184ff80a6c0cfd5bc51c7b379b4e29c3f79a4ef',
    outputDir: 'ready-player-me',
  },
  {
    id: 'avaturn',
    filename: 'avaturn.glb',
    gitBlobSha: '0865b24452da718e725da8e1324197105f5c9aa2',
    outputDir: 'avaturn',
  },
  {
    id: 'avatarsdk',
    filename: 'avatarsdk.glb',
    gitBlobSha: '2865a45b9f82e97e811cc703411233f3be780163',
    outputDir: 'avatarsdk',
  },
  {
    id: 'vroid',
    filename: 'vroid.glb',
    gitBlobSha: '8943355bf2d8bb172764281916f9fb889768396f',
    outputDir: 'vroid',
  },
].map(source => ({
  ...source,
  url: `https://raw.githubusercontent.com/met4citizen/TalkingHead/${PINNED_COMMIT}/avatars/${source.filename}`,
}));

const LIMIT = 25 * 1024 * 1024;

export function gitBlobSha(bytes) {
  return createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`))
    .update(bytes)
    .digest('hex');
}

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

async function loadPinnedAvatar(source, cache) {
  const cacheFile = new URL(source.filename, cache);
  let bytes;
  try { bytes = await readFile(cacheFile); } catch { /* First build. */ }

  if (!bytes || gitBlobSha(bytes) !== source.gitBlobSha) {
    const response = await fetch(source.url, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`Avatar download failed (${source.filename}): ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (gitBlobSha(bytes) !== source.gitBlobSha) {
      throw new Error(`Avatar integrity check failed: ${source.filename}`);
    }
    await writeFile(cacheFile, bytes);
  }

  return bytes;
}

export async function prepareAvatar() {
  const cache = new URL('../.avatar-cache/', import.meta.url);
  const publicRoot = new URL('../public/avatars/', import.meta.url);
  await mkdir(cache, { recursive: true });
  await mkdir(publicRoot, { recursive: true });

  for (const source of AVATAR_SOURCES) {
    const bytes = await loadPinnedAvatar(source, cache);
    const output = new URL(`${source.outputDir}/`, publicRoot);
    await mkdir(output, { recursive: true });

    if (source.split) {
      const { files } = splitGlb(bytes);
      for (const [name, data] of files) await writeFile(new URL(name, output), data);
      console.log(`Prepared ${source.id} (${files.size} same-origin files).`);
    } else {
      if (bytes.length > LIMIT) throw new Error(`Avatar asset exceeds Workers limit: ${source.filename}`);
      await writeFile(new URL('avatar.glb', output), bytes);
      console.log(`Prepared ${source.id} (same-origin GLB).`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await prepareAvatar();
