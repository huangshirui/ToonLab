// Azure's 22 IDs mapped to TalkingHead's Oculus mouth shapes.
// Diphthongs use a representative pose; the rig has fewer shapes than Azure.
const OCULUS = ['sil', 'aa', 'aa', 'O', 'E', 'RR', 'I', 'U', 'O', 'aa', 'O', 'I', 'aa', 'RR', 'nn', 'SS', 'CH', 'TH', 'FF', 'DD', 'kk', 'PP'];
export function toTalkingHeadVisemes(events, durationMs) {
  if (!events.length || !Number.isFinite(durationMs) || durationMs <= 0) throw new Error('Azure returned no usable viseme timing.');
  const visemes = [], vtimes = [], vdurations = [];
  for (let i = 0; i < events.length; i++) {
    const { id, time } = events[i];
    const end = events[i + 1]?.time ?? durationMs;
    if (!Number.isInteger(id) || !OCULUS[id] || !Number.isFinite(time) || time < 0 || time > durationMs || !Number.isFinite(end) || end < time) {
      throw new Error('Azure returned invalid viseme timing.');
    }
    // Silence has no active mouth target; neighbouring poses return to zero.
    if (id === 0 || end === time) continue;
    visemes.push(OCULUS[id]); vtimes.push(time); vdurations.push(end - time);
  }
  if (!visemes.length) throw new Error('Azure returned no speech mouth shapes.');
  return { visemes, vtimes, vdurations };
}
