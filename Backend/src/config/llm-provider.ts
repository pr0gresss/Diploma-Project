export function resolveLlmProvider(values: Record<string, unknown>) {
  const provider = values.LLM_PROVIDER ?? 'openai';
  if (provider !== 'openai' && provider !== 'codex_gateway') {
    throw new Error('LLM_PROVIDER must be openai or codex_gateway');
  }
  const configured = typeof values.LLM_BASE_URL === 'string' ? values.LLM_BASE_URL.trim() : '';
  if (provider === 'codex_gateway' && !configured) {
    throw new Error('Codex gateway requires an explicit LLM_BASE_URL');
  }
  const baseURL = configured || 'https://api.openai.com/v1';
  const url = new URL(baseURL);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('LLM_BASE_URL must be an HTTP(S) URL without credentials, query or fragment');
  }
  if (provider === 'codex_gateway' && (url.hostname === 'api.openai.com' || !url.pathname.replace(/\/+$/, '').endsWith('/v1'))) {
    throw new Error('Codex gateway requires a gateway URL ending in /v1, not the direct OpenAI API');
  }
  return { provider, baseURL };
}
