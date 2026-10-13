export async function generateReply({ apiKey = '', demoCode = '', prompt, model = 'openrouter/free' }) {
  const hasApiKey = Boolean(apiKey);
  const hasDemoCode = Boolean(demoCode);
  if (hasApiKey === hasDemoCode) {
    throw new Error('Choose either a demo code or an OpenRouter API key.');
  }

  const headers = { 'Content-Type': 'application/json' };
  if (hasApiKey) headers.Authorization = `Bearer ${apiKey}`;
  if (hasDemoCode) headers['X-ToonLab-Demo-Code'] = demoCode;

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers,
    cache: 'no-store',
    body: JSON.stringify({ prompt, model }),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Keep a useful fallback below if the upstream response is not JSON.
  }

  if (!response.ok) {
    throw new Error(payload?.error ?? `Request failed with status ${response.status}.`);
  }

  if (!payload?.text) {
    throw new Error('The model returned an empty response.');
  }

  return payload;
}
