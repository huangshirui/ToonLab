import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { PINNED_COMMIT, gitBlobSha } from './prepare-avatar.mjs';

export const TALKINGHEAD_RUNTIME_FILES = [
  { filename: 'talkinghead.mjs', gitBlobSha: '939078ccf064ff4b755d00d7468310e74166d125' },
  { filename: 'dynamicbones.mjs', gitBlobSha: 'bc1867f12c2447d4c37965b38db71ca6f3809ef4' },
  { filename: 'retargeter.mjs', gitBlobSha: '8efe9b07637692b11bf445c819ada25a18066d3a' },
  { filename: 'playback-worklet.js', gitBlobSha: '20091c3f490062bb951dd9d100b075a6448ed7f2' },
].map(file => ({
  ...file,
  url: `https://raw.githubusercontent.com/met4citizen/TalkingHead/${PINNED_COMMIT}/modules/${file.filename}`,
}));

export async function prepareTalkingHeadRuntime() {
  const output = new URL('../.talkinghead-runtime/', import.meta.url);
  await mkdir(output, { recursive: true });

  for (const source of TALKINGHEAD_RUNTIME_FILES) {
    const target = new URL(source.filename, output);
    let bytes;
    try { bytes = await readFile(target); } catch { /* First build. */ }

    if (!bytes || gitBlobSha(bytes) !== source.gitBlobSha) {
      const response = await fetch(source.url, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`TalkingHead runtime download failed (${source.filename}): ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
      if (gitBlobSha(bytes) !== source.gitBlobSha) {
        throw new Error(`TalkingHead runtime integrity check failed: ${source.filename}`);
      }
      await writeFile(target, bytes);
    }
  }

  console.log(`Prepared TalkingHead runtime from ${PINNED_COMMIT}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await prepareTalkingHeadRuntime();
}
