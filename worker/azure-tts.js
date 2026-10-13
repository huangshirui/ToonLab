export async function issueSpeechToken(env, signal) {
  const response = await fetch(`https://${env.AZURE_SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': env.AZURE_SPEECH_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: '',
    signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error('Azure authorization failed.');
  }
  const token = (await response.text()).trim();
  if (!token || token.length > 16_384) throw new Error('Invalid Azure token.');
  return { token, region: env.AZURE_SPEECH_REGION, voice: 'en-US-AriaNeural' };
}
