import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const LIVE2D_RUNTIME_FILES = [
  {
    filename: 'live2dcubismcore.min.js',
    url: 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
    minBytes: 50_000,
  },
  {
    filename: 'pixi.min.js',
    url: 'https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js',
    minBytes: 100_000,
  },
  {
    filename: 'cubism4.min.js',
    url: 'https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js',
    minBytes: 20_000,
  },
];

function isUsableJavascript(bytes, minBytes) {
  if (!bytes || bytes.byteLength < minBytes || bytes.byteLength > 3_000_000) return false;
  const prefix = bytes.subarray(0, Math.min(bytes.byteLength, 512)).toString('utf8').toLowerCase();
  return !prefix.includes('<!doctype html') && !prefix.includes('<html');
}

export async function prepareLive2DRuntime() {
  const output = new URL('../public/live2d-runtime/', import.meta.url);
  await mkdir(output, { recursive: true });

  for (const source of LIVE2D_RUNTIME_FILES) {
    const target = new URL(source.filename, output);
    let bytes;
    try { bytes = await readFile(target); } catch { /* First build. */ }

    if (!isUsableJavascript(bytes, source.minBytes)) {
      const response = await fetch(source.url, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`Live2D runtime download failed (${source.filename}): ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
      if (!isUsableJavascript(bytes, source.minBytes)) {
        throw new Error(`Live2D runtime validation failed: ${source.filename}`);
      }
      await writeFile(target, bytes);
    }
  }

  console.log('Prepared Live2D browser runtime for same-origin serving.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await prepareLive2DRuntime();
}
