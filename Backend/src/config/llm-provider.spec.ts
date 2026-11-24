import { resolveLlmProvider } from './llm-provider.js';

describe('LLM provider selection', () => {
  it('preserves OpenAI defaults and custom compatible endpoints', () => {
    expect(resolveLlmProvider({}).baseURL).toBe('https://api.openai.com/v1');
    expect(resolveLlmProvider({ LLM_BASE_URL: 'http://localhost:8317/v1' }).provider).toBe('openai');
  });
  it.each([
    { LLM_PROVIDER: 'unknown' },
    { LLM_PROVIDER: 'codex_gateway' },
    { LLM_PROVIDER: 'codex_gateway', LLM_BASE_URL: 'https://api.openai.com/v1' },
    { LLM_PROVIDER: 'codex_gateway', LLM_BASE_URL: 'http://localhost:8317' },
  ])('rejects invalid selection %#', (values) => {
    expect(() => resolveLlmProvider(values)).toThrow();
  });
  it('selects an explicit gateway without fallback', () => {
    expect(resolveLlmProvider({ LLM_PROVIDER: 'codex_gateway', LLM_BASE_URL: 'http://localhost:8317/v1' })).toEqual({ provider: 'codex_gateway', baseURL: 'http://localhost:8317/v1' });
  });
});
