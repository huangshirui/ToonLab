export async function generateReply({ apiKey, prompt, model = 'openrouter/auto' }) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
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
