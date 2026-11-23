import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import {
  OpenAiOAuthSession,
  saveOAuthCredentials,
} from './openai-oauth.session.js';
import { AiUnavailableError } from '../../common/errors/index.js';

describe('OpenAiOAuthSession', () => {
  let directory: string;
  let path: string;
  const credentials = () => ({
    client_id: 'oaiapp_test',
    issuer: 'https://auth.openai.com' as const,
    subject: 'test-user',
    ext_agent_host_id: 'urn:uuid:test-host',
    id_token: 'test-id-token',
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_at: Date.now() + 3600_000,
    scopes: ['resource.invoke', 'chatgpt.tokens.use.direct'],
  });
  beforeEach(async () => {
    await mkdir(resolve('.secrets'), { recursive: true });
    directory = await mkdtemp(join(resolve('.secrets'), 'oauth-test-'));
    path = join(directory, 'oauth.json');
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(directory, { recursive: true, force: true });
  });
  const session = () =>
    new OpenAiOAuthSession(new ConfigService({ OPENAI_OAUTH_FILE: path }));
  it('uses a valid plan-authorized token without network requests', async () => {
    await saveOAuthCredentials(path, credentials());
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    expect(await session().accessToken()).toBe('test-access-token');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('refreshes expired tokens and atomically stores rotation', async () => {
    await saveOAuthCredentials(path, {
      ...credentials(),
      expires_at: Date.now() - 1000,
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'new-access',
          refresh_token: 'rotated-refresh',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'resource.invoke chatgpt.tokens.use.direct',
        }),
        { status: 200 },
      ),
    );
    const currentSession = session();
    const values = await Promise.all([
      currentSession.accessToken(),
      currentSession.accessToken(),
    ]);
    expect(values).toEqual(['new-access', 'new-access']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const saved = JSON.parse(await readFile(path, 'utf8'));
    expect(saved.refresh_token).toBe('rotated-refresh');
    expect(saved.client_id).toBe('oaiapp_test');
    const request = fetchMock.mock.calls[0][1]!;
    expect(request.body).toBeInstanceOf(URLSearchParams);
    const form = request.body as URLSearchParams;
    expect(form.get('grant_type')).toBe('refresh_token');
    expect(form.has('scope')).toBe(false);
  });
  it('refuses missing, corrupted or unconsented credentials without exposing them', async () => {
    await expect(session().accessToken()).rejects.toBeInstanceOf(
      AiUnavailableError,
    );
    await writeFile(path, 'sensitive-invalid-json');
    await expect(session().accessToken()).rejects.toThrow(
      expect.not.stringContaining('sensitive'),
    );
    await saveOAuthCredentials(path, { ...credentials(), scopes: ['openid'] });
    await expect(session().accessToken()).rejects.toBeInstanceOf(
      AiUnavailableError,
    );
  });
  it('does not race another process holding the refresh lock', async () => {
    await saveOAuthCredentials(path, { ...credentials(), expires_at: 1 });
    await writeFile(`${path}.lock`, '');
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await expect(session().accessToken()).rejects.toBeInstanceOf(
      AiUnavailableError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('does not overwrite credentials on failed refresh', async () => {
    const initial = { ...credentials(), expires_at: 1 };
    await saveOAuthCredentials(path, initial);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('invalid_grant', { status: 400 }),
    );
    await expect(session().accessToken()).rejects.toBeInstanceOf(
      AiUnavailableError,
    );
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(initial);
  });
});
