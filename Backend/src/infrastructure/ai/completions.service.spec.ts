import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import {
  CompletionsService,
  type OpenAiClientFactory,
} from './completions.service.js';
import {
  AiUnavailableError,
  ConflictError,
  ValidationError,
} from '../../common/errors/index.js';

describe('OpenAI-compatible completions', () => {
  const schema = z.strictObject({ title: z.string() });
  function setup(overrides = {}) {
    const config = new ConfigService({
      LLM_MODEL: 'test-model',
      LLM_API_KEY: 'gateway-client-key',
      LLM_BASE_URL: 'http://127.0.0.1:8317/v1',
      LLM_TIMEOUT_MS: 1234,
      LLM_MAX_CONTEXT_CHARS: 60000,
      LLM_MAX_OUTPUT_TOKENS: 4321,
      ...overrides,
    });
    const create = vi.fn().mockResolvedValue({
      choices: [
        { finish_reason: 'stop', message: { content: '{"title":"Study"}' } },
      ],
    });
    const factory = vi
      .fn()
      .mockReturnValue({ chat: { completions: { create } } });
    return {
      service: new CompletionsService(config, factory as OpenAiClientFactory),
      create,
      factory,
    };
  }
  it('forwards configured connection, model, timeout and output limit', async () => {
    const { service, create, factory } = setup();
    expect(await service.completeJson('user', 'source', schema)).toEqual({
      title: 'Study',
    });
    expect(factory).toHaveBeenCalledWith({
      apiKey: 'gateway-client-key',
      baseURL: 'http://127.0.0.1:8317/v1',
      timeout: 1234,
    });
    expect(create.mock.calls[0][0]).toMatchObject({
      model: 'test-model',
      max_tokens: 4321,
      response_format: { type: 'json_object' },
    });
    expect(create.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
  it.each([{ LLM_MODEL: '' }, { LLM_API_KEY: '' }])(
    'requires explicit configuration',
    async (overrides) => {
      const { service, factory } = setup(overrides);
      await expect(
        service.completeJson('user', 'source', schema),
      ).rejects.toBeInstanceOf(AiUnavailableError);
      expect(factory).not.toHaveBeenCalled();
    },
  );
  it('counts schema and instructions in the context budget', async () => {
    await expect(
      setup({ LLM_MAX_CONTEXT_CHARS: 10 }).service.completeJson(
        'u',
        'source',
        schema,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
  it.each([
    { finish_reason: 'length', message: { content: '{"title":"Study"}' } },
    { finish_reason: 'stop', message: { content: 'invalid' } },
    { finish_reason: 'stop', message: { content: '{"wrong":true}' } },
    { finish_reason: 'stop', message: { content: '{}', refusal: 'refused' } },
    { finish_reason: 'stop', message: { content: null } },
    {
      finish_reason: 'stop',
      message: { content: 'a'.repeat(1024 * 1024 + 1) },
    },
  ])('rejects incomplete, refused or invalid output', async (choice) => {
    const { service, create } = setup();
    create.mockResolvedValue({ choices: [choice] });
    await expect(
      service.completeJson('u', 'source', schema),
    ).rejects.toBeInstanceOf(AiUnavailableError);
  });
  it('sanitizes upstream failures and releases the concurrency slot', async () => {
    const { service, create } = setup();
    create.mockRejectedValueOnce(new Error('secret upstream payload'));
    await expect(service.completeJson('u', 'source', schema)).rejects.toThrow(
      'AI generation failed; check provider configuration, availability and limits',
    );
    await expect(service.completeJson('u', 'source', schema)).resolves.toEqual({
      title: 'Study',
    });
  });
  it('rejects simultaneous completions', async () => {
    const { service, create } = setup();
    let release!: (value: unknown) => void;
    create.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const first = service.completeJson('u', 'source', schema);
    await expect(
      service.completeJson('u', 'source', schema),
    ).rejects.toBeInstanceOf(ConflictError);
    release({ choices: [] });
    await expect(first).rejects.toBeInstanceOf(AiUnavailableError);
  });
});
